import { EventBus } from '../core/EventBus';
import type { BossAttackPattern, BossDefinition } from '../core/types';
import type { Rng } from '../core/Rng';

export type BossPhase = 'idle' | 'telegraph' | 'active' | 'cooldown';

export interface BossActions {
  healthRatio(): number;
  distanceToTarget(): number;
  hasTarget(): boolean;
  approachTarget(nowMs: number): void;
  halt(): void;
  showTelegraph(pattern: BossAttackPattern): void;
  hideTelegraph(): void;
  performPattern(pattern: BossAttackPattern, nowMs: number): void;
  sustainPattern(pattern: BossAttackPattern, nowMs: number, elapsedMs: number): void;
}

/**
 * Drives a boss through telegraph -> active -> cooldown using only data from BossDefinition,
 * so a new boss is a JSON entry rather than a new class.
 */
export class BossController {
  private phase: BossPhase = 'idle';
  private phaseStartedAtMs = 0;
  private currentPattern: BossAttackPattern | null = null;
  private readonly readyAtMs = new Map<string, number>();

  constructor(
    private readonly definition: BossDefinition,
    private readonly actions: BossActions,
    private readonly rng: Rng,
  ) {}

  get activePattern(): BossAttackPattern | null {
    return this.currentPattern;
  }

  get currentPhase(): BossPhase {
    return this.phase;
  }

  update(nowMs: number): void {
    if (!this.actions.hasTarget()) {
      this.actions.halt();
      return;
    }
    const elapsed = nowMs - this.phaseStartedAtMs;

    switch (this.phase) {
      case 'idle': {
        const pattern = this.selectPattern(nowMs);
        if (pattern) this.enterTelegraph(pattern, nowMs);
        else this.actions.approachTarget(nowMs);
        break;
      }
      case 'telegraph': {
        this.actions.halt();
        if (this.currentPattern && elapsed >= this.currentPattern.telegraphMs) {
          this.actions.hideTelegraph();
          this.actions.performPattern(this.currentPattern, nowMs);
          this.setPhase('active', nowMs);
        }
        break;
      }
      case 'active': {
        if (!this.currentPattern) {
          this.setPhase('idle', nowMs);
          break;
        }
        this.actions.sustainPattern(this.currentPattern, nowMs, elapsed);
        if (elapsed >= this.currentPattern.activeMs) {
          this.readyAtMs.set(this.currentPattern.attackId, nowMs + this.currentPattern.cooldownMs);
          this.setPhase('cooldown', nowMs);
        }
        break;
      }
      case 'cooldown': {
        this.actions.approachTarget(nowMs);
        if (elapsed >= 320) {
          this.currentPattern = null;
          this.setPhase('idle', nowMs);
        }
        break;
      }
      default:
        break;
    }
  }

  private enterTelegraph(pattern: BossAttackPattern, nowMs: number): void {
    this.currentPattern = pattern;
    this.actions.halt();
    this.actions.showTelegraph(pattern);
    EventBus.emit('boss:telegraph', { attackId: pattern.attackId, durationMs: pattern.telegraphMs });
    this.setPhase('telegraph', nowMs);
  }

  private setPhase(phase: BossPhase, nowMs: number): void {
    this.phase = phase;
    this.phaseStartedAtMs = nowMs;
  }

  private selectPattern(nowMs: number): BossAttackPattern | null {
    const ratio = this.actions.healthRatio();
    const available = this.definition.attackPatterns.filter(
      (pattern) => ratio <= pattern.healthRatioMax && nowMs >= (this.readyAtMs.get(pattern.attackId) ?? 0),
    );
    if (available.length === 0) return null;
    return available[this.rng.intRange(0, available.length)] ?? null;
  }

  reset(): void {
    this.phase = 'idle';
    this.currentPattern = null;
    this.readyAtMs.clear();
  }
}
