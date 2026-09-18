import type { PotionDefinition } from '../core/types';
import type { Entity } from '../entities/Entity';

export interface PotionUseResult {
  readonly consumed: boolean;
  readonly message: string;
}

/** Applies a consumable to a target. Heal is rejected at full health so a potion is never wasted. */
export function applyPotion(potion: PotionDefinition, target: Entity, nowMs: number): PotionUseResult {
  switch (potion.kind) {
    case 'heal': {
      const healed = target.health.heal(potion.magnitude);
      return healed > 0
        ? { consumed: true, message: `Healed ${Math.round(healed)}` }
        : { consumed: false, message: 'Already at full health' };
    }
    case 'speed':
      target.status.apply(
        { id: 'potion-speed', kind: 'speed', magnitude: potion.magnitude, durationMs: potion.durationMs },
        nowMs,
      );
      return { consumed: true, message: 'Quickened' };
    case 'damage':
      target.status.apply(
        { id: 'potion-damage', kind: 'damage', magnitude: potion.magnitude, durationMs: potion.durationMs },
        nowMs,
      );
      return { consumed: true, message: 'Empowered' };
    case 'shield':
      target.health.addShield(potion.magnitude);
      return { consumed: true, message: 'Shielded' };
    default:
      return { consumed: false, message: 'Nothing happened' };
  }
}
