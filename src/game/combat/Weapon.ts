import type Phaser from 'phaser';
import type { WeaponClass, WeaponStats } from '../core/types';
import { AbilityEffectRegistry, type AbilityContext } from './AbilityEffectRegistry';
import type { AttackContext } from './CombatTypes';

const COMBO_RESET_MS = 900;

export abstract class Weapon {
  protected comboIndex = 0;
  protected attackStartedAtMs = Number.NEGATIVE_INFINITY;
  protected cooldownUntilMs = Number.NEGATIVE_INFINITY;

  protected constructor(protected readonly stats: WeaponStats) {}

  get id(): string {
    return this.stats.id;
  }

  get displayName(): string {
    return this.stats.displayName;
  }

  get weaponClass(): WeaponClass {
    return this.stats.weaponClass;
  }

  get definition(): WeaponStats {
    return this.stats;
  }

  get attackIntervalMs(): number {
    return 1000 / this.stats.attackSpeed;
  }

  canAttack(nowMs: number): boolean {
    return nowMs >= this.cooldownUntilMs;
  }

  cooldownRemainingMs(nowMs: number): number {
    return Math.max(0, this.cooldownUntilMs - nowMs);
  }

  elapsedSinceAttackMs(nowMs: number): number {
    return nowMs - this.attackStartedAtMs;
  }

  isInActiveFrames(nowMs: number): boolean {
    const elapsed = this.elapsedSinceAttackMs(nowMs);
    return elapsed >= 0 && elapsed < this.stats.activeMs;
  }

  /** Swap may cancel recovery frames, never active-hit frames. */
  canBeCancelledBySwap(elapsedMs: number): boolean {
    if (!Number.isFinite(elapsedMs)) return true;
    return elapsedMs >= Math.max(this.stats.activeMs, this.stats.swapCancelWindowMs);
  }

  attack(context: AttackContext, origin: Phaser.Math.Vector2, direction: Phaser.Math.Vector2): boolean {
    if (!this.canAttack(context.nowMs)) return false;

    if (context.nowMs - this.attackStartedAtMs > COMBO_RESET_MS) this.comboIndex = 0;
    this.attackStartedAtMs = context.nowMs;
    this.cooldownUntilMs = context.nowMs + this.attackIntervalMs;

    this.performAttack(context, origin, direction);
    this.comboIndex = (this.comboIndex + 1) % Math.max(1, this.stats.comboLength);
    return true;
  }

  triggerAbility(context: AbilityContext): void {
    AbilityEffectRegistry.resolve(this.stats.abilityEffectId).apply(context);
  }

  reset(): void {
    this.comboIndex = 0;
    this.attackStartedAtMs = Number.NEGATIVE_INFINITY;
    this.cooldownUntilMs = Number.NEGATIVE_INFINITY;
  }

  protected abstract performAttack(
    context: AttackContext,
    origin: Phaser.Math.Vector2,
    direction: Phaser.Math.Vector2,
  ): void;

  abstract getAnimationKey(): string;
}
