import effectsJson from "./effects.json";
import type { Entity } from "../entities/Entity";
import type { Rng } from "../core/Rng";

export interface AbilityContext {
  readonly nowMs: number;
  readonly source: Entity | null;
  readonly target: Entity;
  readonly rng: Rng;
  queryEnemiesNear(
    x: number,
    y: number,
    radius: number,
    exclude: Entity,
  ): Entity[];
  dealDamage(
    target: Entity,
    amount: number,
    fromX: number,
    fromY: number,
    knockback: number,
  ): void;
  spawnBurst(x: number, y: number, tint: number, count: number): void;
}

export interface AbilityEffect {
  readonly id: string;
  apply(context: AbilityContext): void;
}

interface DotConfig {
  readonly magnitude: number;
  readonly durationMs: number;
  readonly tickMs: number;
  readonly burstTint?: number;
  readonly burstCount?: number;
}

interface SlowConfig {
  readonly magnitude: number;
  readonly durationMs: number;
  readonly burstTint?: number;
  readonly burstCount?: number;
}

interface DurationOnlyConfig {
  readonly magnitude: number;
  readonly durationMs: number;
}

interface ChainLightningConfig {
  readonly radius: number;
  readonly maxChainTargets: number;
  readonly damage: number;
  readonly knockback: number;
  readonly burstTint: number;
  readonly burstCount: number;
}

interface GroundSlamConfig {
  readonly radius: number;
  readonly damage: number;
  readonly knockback: number;
  readonly slowMagnitude: number;
  readonly slowDurationMs: number;
  readonly burstTint: number;
  readonly burstCount: number;
}

interface EffectsConfig {
  readonly bleed: DotConfig;
  readonly ignite: DotConfig;
  readonly armor_break: DurationOnlyConfig;
  readonly stagger: SlowConfig;
  readonly frost_slow: SlowConfig;
  readonly chain_lightning: ChainLightningConfig;
  readonly ground_slam: GroundSlamConfig;
  readonly pierce_line: DurationOnlyConfig;
}

function assertPositive(owner: string, field: string, value: unknown): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(
      `effects.json/${owner}: field '${field}' must be a positive number, got ${JSON.stringify(value)}`,
    );
  }
}

function assertNonNegative(owner: string, field: string, value: unknown): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(
      `effects.json/${owner}: field '${field}' must be >= 0, got ${JSON.stringify(value)}`,
    );
  }
}

function validate(cfg: EffectsConfig): void {
  for (const [id, dot] of [
    ["bleed", cfg.bleed] as const,
    ["ignite", cfg.ignite] as const,
  ]) {
    assertPositive(id, "magnitude", dot.magnitude);
    assertPositive(id, "durationMs", dot.durationMs);
    assertPositive(id, "tickMs", dot.tickMs);
  }
  for (const [id, slow] of [
    ["stagger", cfg.stagger] as const,
    ["frost_slow", cfg.frost_slow] as const,
  ]) {
    assertPositive(id, "magnitude", slow.magnitude);
    assertPositive(id, "durationMs", slow.durationMs);
  }
  for (const [id, d] of [
    ["armor_break", cfg.armor_break] as const,
    ["pierce_line", cfg.pierce_line] as const,
  ]) {
    assertPositive(id, "magnitude", d.magnitude);
    assertPositive(id, "durationMs", d.durationMs);
  }
  assertPositive("chain_lightning", "radius", cfg.chain_lightning.radius);
  assertPositive(
    "chain_lightning",
    "maxChainTargets",
    cfg.chain_lightning.maxChainTargets,
  );
  assertNonNegative("chain_lightning", "damage", cfg.chain_lightning.damage);
  assertNonNegative(
    "chain_lightning",
    "knockback",
    cfg.chain_lightning.knockback,
  );
  assertPositive("ground_slam", "radius", cfg.ground_slam.radius);
  assertNonNegative("ground_slam", "damage", cfg.ground_slam.damage);
  assertNonNegative("ground_slam", "knockback", cfg.ground_slam.knockback);
  assertPositive("ground_slam", "slowMagnitude", cfg.ground_slam.slowMagnitude);
  assertPositive(
    "ground_slam",
    "slowDurationMs",
    cfg.ground_slam.slowDurationMs,
  );
}

const EFFECTS = effectsJson as EffectsConfig;
validate(EFFECTS);

const NO_EFFECT: AbilityEffect = { id: "none", apply: () => undefined };

class Registry {
  private readonly effects = new Map<string, AbilityEffect>([
    ["none", NO_EFFECT],
  ]);

  register(effect: AbilityEffect): void {
    if (this.effects.has(effect.id))
      throw new Error(`Duplicate ability effect: ${effect.id}`);
    this.effects.set(effect.id, effect);
  }

  resolve(id: string): AbilityEffect {
    return this.effects.get(id) ?? NO_EFFECT;
  }

  has(id: string): boolean {
    return this.effects.has(id);
  }
}

export const AbilityEffectRegistry = new Registry();

AbilityEffectRegistry.register({
  id: "bleed",
  apply: ({ target, nowMs }) => {
    const cfg = EFFECTS.bleed;
    target.status.apply(
      {
        id: "bleed",
        kind: "dot",
        magnitude: cfg.magnitude,
        durationMs: cfg.durationMs,
        tickMs: cfg.tickMs,
      },
      nowMs,
    );
  },
});

AbilityEffectRegistry.register({
  id: "ignite",
  apply: ({ target, nowMs, spawnBurst }) => {
    const cfg = EFFECTS.ignite;
    target.status.apply(
      {
        id: "ignite",
        kind: "dot",
        magnitude: cfg.magnitude,
        durationMs: cfg.durationMs,
        tickMs: cfg.tickMs,
      },
      nowMs,
    );
    if (cfg.burstTint !== undefined)
      spawnBurst(target.x, target.y, cfg.burstTint, cfg.burstCount ?? 0);
  },
});

AbilityEffectRegistry.register({
  id: "armor_break",
  apply: ({ target, nowMs }) => {
    const cfg = EFFECTS.armor_break;
    target.status.apply(
      {
        id: "armor_break",
        kind: "armor_break",
        magnitude: cfg.magnitude,
        durationMs: cfg.durationMs,
      },
      nowMs,
    );
  },
});

AbilityEffectRegistry.register({
  id: "stagger",
  apply: ({ target, nowMs }) => {
    const cfg = EFFECTS.stagger;
    target.status.apply(
      {
        id: "stagger",
        kind: "slow",
        magnitude: cfg.magnitude,
        durationMs: cfg.durationMs,
      },
      nowMs,
    );
  },
});

AbilityEffectRegistry.register({
  id: "frost_slow",
  apply: ({ target, nowMs, spawnBurst }) => {
    const cfg = EFFECTS.frost_slow;
    target.status.apply(
      {
        id: "frost_slow",
        kind: "slow",
        magnitude: cfg.magnitude,
        durationMs: cfg.durationMs,
      },
      nowMs,
    );
    if (cfg.burstTint !== undefined)
      spawnBurst(target.x, target.y, cfg.burstTint, cfg.burstCount ?? 0);
  },
});

AbilityEffectRegistry.register({
  id: "chain_lightning",
  apply: ({ target, queryEnemiesNear, dealDamage, spawnBurst }) => {
    const cfg = EFFECTS.chain_lightning;
    const arcTargets = queryEnemiesNear(
      target.x,
      target.y,
      cfg.radius,
      target,
    ).slice(0, cfg.maxChainTargets);
    for (const arcTarget of arcTargets) {
      dealDamage(arcTarget, cfg.damage, target.x, target.y, cfg.knockback);
      spawnBurst(arcTarget.x, arcTarget.y, cfg.burstTint, cfg.burstCount);
    }
  },
});

AbilityEffectRegistry.register({
  id: "ground_slam",
  apply: ({ target, queryEnemiesNear, dealDamage, spawnBurst, nowMs }) => {
    const cfg = EFFECTS.ground_slam;
    spawnBurst(target.x, target.y, cfg.burstTint, cfg.burstCount);
    for (const splashTarget of queryEnemiesNear(
      target.x,
      target.y,
      cfg.radius,
      target,
    )) {
      dealDamage(splashTarget, cfg.damage, target.x, target.y, cfg.knockback);
      splashTarget.status.apply(
        {
          id: "stagger",
          kind: "slow",
          magnitude: cfg.slowMagnitude,
          durationMs: cfg.slowDurationMs,
        },
        nowMs,
      );
    }
  },
});

AbilityEffectRegistry.register({
  id: "pierce_line",
  apply: ({ target, nowMs }) => {
    const cfg = EFFECTS.pierce_line;
    target.status.apply(
      {
        id: "pierce_line",
        kind: "armor_break",
        magnitude: cfg.magnitude,
        durationMs: cfg.durationMs,
      },
      nowMs,
    );
  },
});
