import type Phaser from "phaser";
import { Weapon } from "../Weapon";
import type { AttackContext } from "../CombatTypes";
import { TextureKeys } from "../../core/TextureFactory";
import type { WeaponStats } from "../../core/types";

/** Slow wind-up, wide arc, heavy stagger. Trades mobility for crowd control. */
export class HeavyWeapon extends Weapon {
  constructor(stats: WeaponStats) {
    super(stats);
  }

  protected override performAttack(
    context: AttackContext,
    origin: Phaser.Math.Vector2,
    direction: Phaser.Math.Vector2,
  ): void {
    context.spawnHitbox({
      x: origin.x,
      y: origin.y,
      dirX: direction.x,
      dirY: direction.y,
      width: this.stats.range * 1.15,
      height: this.stats.range * 1.15,
      offset: this.stats.range * 0.4,
      durationMs: this.stats.activeMs,
      damage: this.stats.damage,
      knockback: this.stats.knockback,
      faction: context.owner.faction,
      abilityEffectId: this.stats.abilityEffectId,
      owner: context.owner,
      texture: TextureKeys.shockwave,
      tint: 0xffc98a,
      followOwner: false,
      maxTargets: 8,
    });
    context.shake(0.006, 140);
  }

  override getAnimationKey(): string {
    return "heavy-swing";
  }
}
