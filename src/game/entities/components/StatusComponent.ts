export type StatusKind =
  "dot" | "slow" | "speed" | "damage" | "armor_break" | "stagger";

export interface StatusEffect {
  readonly id: string;
  readonly kind: StatusKind;
  /** dot: damage per tick. slow/speed/damage/armor_break: multiplier delta. */
  readonly magnitude: number;
  readonly durationMs: number;
  readonly tickMs?: number;
}

interface ActiveStatus extends StatusEffect {
  expiresAtMs: number;
  nextTickAtMs: number;
}

/** Aggregates timed modifiers. Re-applying an id refreshes rather than stacking, to bound stacking abuse. */
export class StatusComponent {
  private readonly active = new Map<string, ActiveStatus>();

  constructor(private readonly onDotTick: (damage: number) => void) {}

  apply(effect: StatusEffect, nowMs: number): void {
    this.active.set(effect.id, {
      ...effect,
      expiresAtMs: nowMs + effect.durationMs,
      nextTickAtMs: nowMs + (effect.tickMs ?? effect.durationMs),
    });
  }

  remove(id: string): void {
    this.active.delete(id);
  }

  clear(): void {
    this.active.clear();
  }

  has(kind: StatusKind): boolean {
    for (const status of this.active.values())
      if (status.kind === kind) return true;
    return false;
  }

  update(nowMs: number): void {
    if (this.active.size === 0) return;
    for (const [id, status] of this.active) {
      if (status.kind === "dot" && nowMs >= status.nextTickAtMs) {
        this.onDotTick(status.magnitude);
        status.nextTickAtMs = nowMs + (status.tickMs ?? 500);
      }
      if (nowMs >= status.expiresAtMs) this.active.delete(id);
    }
  }

  get speedMultiplier(): number {
    let multiplier = 1;
    for (const status of this.active.values()) {
      if (status.kind === "slow") multiplier -= status.magnitude;
      else if (status.kind === "speed") multiplier += status.magnitude;
    }
    return Math.max(0.15, multiplier);
  }

  get damageMultiplier(): number {
    let multiplier = 1;
    for (const status of this.active.values())
      if (status.kind === "damage") multiplier += status.magnitude;
    return multiplier;
  }

  /** Armor break raises incoming damage taken. */
  get incomingMultiplier(): number {
    let multiplier = 1;
    for (const status of this.active.values())
      if (status.kind === "armor_break") multiplier += status.magnitude;
    return multiplier;
  }
}
