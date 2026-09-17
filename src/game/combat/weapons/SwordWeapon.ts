import type Phaser from 'phaser';
import { Weapon } from '../Weapon';
import type { AttackContext } from '../CombatTypes';
import { TextureKeys } from '../../core/TextureFactory';
import type { WeaponStats } from '../../core/types';

/** Fast three-hit chain. The finisher widens the arc and adds knockback. */
export class SwordWeapon extends Weapon {
  constructor(stats: WeaponStats) {
    super(stats);
  }

  protected override performAttack(
    context: AttackContext,
    origin: Phaser.Math.Vector2,
    direction: Phaser.Math.Vector2,
  ): void {
    const isFinisher = this.comboIndex === this.stats.comboLength - 1;
    const reach = this.stats.range * (isFinisher ? 1.2 : 1);

    context.spawnHitbox({
      x: origin.x,
      y: origin.y,
      dirX: direction.x,
      dirY: direction.y,
      width: reach,
      height: reach * (isFinisher ? 1.1 : 0.8),
      offset: reach * 0.45,
      durationMs: this.stats.activeMs,
      damage: this.stats.damage * (isFinisher ? 1.45 : 1),
      knockback: this.stats.knockback * (isFinisher ? 2 : 1),
      faction: context.owner.faction,
      abilityEffectId: this.stats.abilityEffectId,
      owner: context.owner,
      texture: TextureKeys.slash,
      tint: isFinisher ? 0xffd9a0 : 0xffffff,
      followOwner: true,
      maxTargets: 3,
    });

    if (isFinisher) context.shake(0.0025, 90);
  }

  override getAnimationKey(): string {
    return `sword-slash-${this.comboIndex}`;
  }
}
