import Phaser from "phaser";
import { DEPTH, TUNING } from "../core/GameConfig";
import { EventBus } from "../core/EventBus";
import { TextureKeys } from "../core/TextureFactory";
import type { Rng } from "../core/Rng";
import type { Entity } from "../entities/Entity";
import { AbilityEffectRegistry } from "./AbilityEffectRegistry";
import { DamageCalculator } from "./DamageCalculator";
import { Hitbox, Projectile } from "./Hitbox";
import { SpatialGrid } from "./SpatialGrid";
import type { AttackContext, HitboxSpec, ProjectileSpec } from "./CombatTypes";

const HIT_STOP_SCALE = 5;

export class CombatSystem {
  private readonly hitboxes: Phaser.Physics.Arcade.Group;
  private readonly projectiles: Phaser.Physics.Arcade.Group;
  private readonly damageTexts: Phaser.GameObjects.Group;
  private readonly particles: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly targets = new Set<Entity>();
  private readonly targetGrid = new SpatialGrid<Entity>();
  private hitStopUntilMs = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rng: Rng,
  ) {
    this.hitboxes = scene.physics.add.group({
      classType: Hitbox,
      maxSize: TUNING.combat.maxHitboxes,
      runChildUpdate: false,
      allowGravity: false,
    });
    this.projectiles = scene.physics.add.group({
      classType: Projectile,
      maxSize: TUNING.combat.maxProjectiles,
      runChildUpdate: false,
      allowGravity: false,
    });
    this.damageTexts = scene.add.group({
      maxSize: TUNING.combat.maxDamageText,
    });

    this.particles = scene.add.particles(0, 0, TextureKeys.particle, {
      lifespan: 320,
      speed: { min: 30, max: 110 },
      scale: { start: 1, end: 0 },
      quantity: 0,
      emitting: false,
    });
    this.particles.setDepth(DEPTH.vfx);
  }

  get projectileGroup(): Phaser.Physics.Arcade.Group {
    return this.projectiles;
  }

  registerTarget(entity: Entity): void {
    this.targets.add(entity);
  }

  unregisterTarget(entity: Entity): void {
    this.targets.delete(entity);
  }

  clearTargets(): void {
    this.targets.clear();
  }

  createContext(owner: Entity, nowMs: number): AttackContext {
    return {
      scene: this.scene,
      owner,
      nowMs,
      spawnHitbox: (spec) => this.spawnHitbox(spec),
      spawnProjectile: (spec) => this.spawnProjectile(spec),
      shake: (intensity, durationMs) =>
        this.scene.cameras.main.shake(durationMs, intensity),
    };
  }

  spawnHitbox(spec: HitboxSpec): void {
    const hitbox = this.hitboxes.get(spec.x, spec.y) as Hitbox | null;
    if (!hitbox) return;
    hitbox.fire(spec, this.scene.time.now);
    this.scene.tweens.add({
      targets: hitbox,
      alpha: 0,
      duration: spec.durationMs,
      ease: "Quad.easeOut",
    });
  }

  spawnProjectile(spec: ProjectileSpec): void {
    const projectile = this.projectiles.get(
      spec.x,
      spec.y,
      TextureKeys.projectile,
    ) as Projectile | null;
    if (!projectile) return;
    projectile.fire(spec, this.scene.time.now);
  }

  /** Called by the scene's collider when a projectile hits level geometry. */
  onProjectileHitWall(projectile: Projectile): void {
    this.spawnBurst(projectile.x, projectile.y, projectile.tintTopLeft, 4);
    projectile.deactivate();
  }

  update(nowMs: number): void {
    if (this.hitStopUntilMs > 0 && nowMs >= this.hitStopUntilMs) {
      this.scene.physics.world.timeScale = 1;
      this.hitStopUntilMs = 0;
    }

    this.targetGrid.clear();
    for (const target of this.targets) {
      if (target.isDead || !target.active) continue;
      this.targetGrid.insert(target.x, target.y, target);
    }

    for (const child of this.hitboxes.getChildren()) {
      const hitbox = child as Hitbox;
      if (!hitbox.active) continue;
      if (nowMs >= hitbox.expiresAtMs) {
        hitbox.deactivate();
        continue;
      }
      hitbox.syncToOwner();
      this.resolveOverlaps(hitbox, nowMs);
    }

    for (const child of this.projectiles.getChildren()) {
      const projectile = child as Projectile;
      if (!projectile.active) continue;
      if (nowMs >= projectile.expiresAtMs) {
        projectile.deactivate();
        continue;
      }
      this.resolveOverlaps(projectile, nowMs);
    }
  }

  private resolveOverlaps(source: Hitbox | Projectile, nowMs: number): void {
    const sourceBody = source.body as Phaser.Physics.Arcade.Body;
    for (const target of this.targetGrid.near(source.x, source.y)) {
      if (target.isDead || !target.active) continue;
      if (target.faction === source.faction) continue;
      if (source.hitTargets.has(target.entityId)) continue;
      if (
        source instanceof Hitbox &&
        source.hitTargets.size >= source.maxTargets
      )
        break;

      const targetBody = target.body as Phaser.Physics.Arcade.Body;
      if (!targetBody.enable) continue;
      if (!bodiesOverlap(sourceBody, targetBody)) continue;

      source.hitTargets.add(target.entityId);
      this.applyHit(source, target, nowMs);

      if (source instanceof Projectile && !source.piercing) {
        this.spawnBurst(source.x, source.y, source.tintTopLeft, 5);
        source.deactivate();
        return;
      }
    }
  }

  private applyHit(
    source: Hitbox | Projectile,
    target: Entity,
    nowMs: number,
  ): void {
    const attackerMultiplier = source.owner?.status.damageMultiplier ?? 1;
    const roll = DamageCalculator.roll(
      { baseDamage: source.damage, attackerMultiplier },
      this.rng,
    );

    const applied = target.takeDamage(roll.amount, nowMs, {
      knockbackFrom: { x: source.x, y: source.y },
      knockbackForce: source.knockback,
      critical: roll.critical,
      invulnerabilityMs:
        target.faction === "player" ? TUNING.player.hitInvulnerabilityMs : 0,
    });
    if (applied <= 0) return;

    AbilityEffectRegistry.resolve(source.abilityEffectId).apply({
      nowMs,
      source: source.owner,
      target,
      rng: this.rng,
      queryEnemiesNear: (x, y, radius, exclude) =>
        this.queryNear(x, y, radius, target.faction, exclude),
      dealDamage: (chained, amount, fromX, fromY, knockback) => {
        const chainedApplied = chained.takeDamage(amount, nowMs, {
          knockbackFrom: { x: fromX, y: fromY },
          knockbackForce: knockback,
        });
        if (chainedApplied > 0)
          this.showDamage(chained.x, chained.y, chainedApplied, false);
      },
      spawnBurst: (x, y, tint, count) => this.spawnBurst(x, y, tint, count),
    });

    this.showDamage(target.x, target.y, applied, roll.critical);
    this.spawnBurst(target.x, target.y, 0xfff0d0, roll.critical ? 8 : 4);
    this.applyHitStop(
      nowMs,
      roll.critical ? TUNING.combat.hitStopMs * 1.6 : TUNING.combat.hitStopMs,
    );

    EventBus.emit("combat:damage-dealt", {
      amount: applied,
      critical: roll.critical,
      x: target.x,
      y: target.y,
      targetId: target.entityId,
    });
  }

  queryNear(
    x: number,
    y: number,
    radius: number,
    excludeFaction: string,
    exclude: Entity,
  ): Entity[] {
    const radiusSq = radius * radius;
    const found: Entity[] = [];
    for (const candidate of this.targets) {
      if (
        candidate === exclude ||
        candidate.isDead ||
        candidate.faction !== excludeFaction
      )
        continue;
      const dx = candidate.x - x;
      const dy = candidate.y - y;
      if (dx * dx + dy * dy <= radiusSq) found.push(candidate);
    }
    return found;
  }

  applyHitStop(nowMs: number, durationMs: number): void {
    this.scene.physics.world.timeScale = HIT_STOP_SCALE;
    this.hitStopUntilMs = nowMs + durationMs;
  }

  spawnBurst(x: number, y: number, tint: number, count: number): void {
    this.particles.setParticleTint(tint);
    this.particles.emitParticleAt(x, y, count);
  }

  private showDamage(
    x: number,
    y: number,
    amount: number,
    critical: boolean,
  ): void {
    let text = this.damageTexts.getFirstDead(
      false,
    ) as Phaser.GameObjects.Text | null;
    if (!text) {
      if (this.damageTexts.getLength() >= TUNING.combat.maxDamageText) return;
      text = this.scene.add.text(x, y, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffffff",
      });
      text.setDepth(DEPTH.damageText).setOrigin(0.5);
      this.damageTexts.add(text);
    }

    text.setActive(true).setVisible(true);
    text.setPosition(x, y - 10);
    text.setText(critical ? `${amount}!` : `${amount}`);
    text.setColor(critical ? "#ffd257" : "#f4f4f4");
    text.setScale(critical ? 1.25 : 1);
    text.setAlpha(1);

    this.scene.tweens.add({
      targets: text,
      y: y - 26,
      alpha: 0,
      duration: 520,
      ease: "Quad.easeOut",
      onComplete: () => text?.setActive(false).setVisible(false),
    });
  }

  /**
   * Called from scene teardown. Phaser's own SHUTDOWN handling can destroy these same
   * Groups (and the physics world) before our listener runs, depending on listener
   * registration order -- so this is best-effort cleanup, not a guarantee, and tolerates
   * anything already torn down rather than crashing the shutdown sequence.
   */
  releaseAll(): void {
    try {
      if (this.hitboxes.scene)
        for (const child of this.hitboxes.getChildren())
          (child as Hitbox).deactivate();
    } catch {
      // Already destroyed by Phaser's own teardown; nothing to release.
    }
    try {
      if (this.projectiles.scene)
        for (const child of this.projectiles.getChildren())
          (child as Projectile).deactivate();
    } catch {
      // Already destroyed by Phaser's own teardown; nothing to release.
    }
    try {
      this.scene.physics.world.timeScale = 1;
    } catch {
      // Physics world already torn down.
    }
    this.hitStopUntilMs = 0;
  }
}

function bodiesOverlap(
  a: Phaser.Physics.Arcade.Body,
  b: Phaser.Physics.Arcade.Body,
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
