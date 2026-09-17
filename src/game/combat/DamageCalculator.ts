import type { Rng } from '../core/Rng';
import { TUNING } from '../core/GameConfig';

export interface DamageRoll {
  readonly amount: number;
  readonly critical: boolean;
}

export interface DamageInput {
  readonly baseDamage: number;
  readonly attackerMultiplier: number;
  readonly critChance?: number;
  readonly critMultiplier?: number;
  readonly variance?: number;
}

export const DamageCalculator = {
  roll(input: DamageInput, rng: Rng): DamageRoll {
    if (input.baseDamage <= 0) return { amount: 0, critical: false };

    const variance = input.variance ?? TUNING.combat.damageVariance;
    const critChance = input.critChance ?? TUNING.combat.critChance;
    const critMultiplier = input.critMultiplier ?? TUNING.combat.critMultiplier;

    const jitter = 1 + rng.range(-variance, variance);
    const critical = rng.chance(critChance);
    const raw = input.baseDamage * input.attackerMultiplier * jitter * (critical ? critMultiplier : 1);
    return { amount: Math.max(1, Math.round(raw)), critical };
  },
};
