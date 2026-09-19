import type Phaser from "phaser";
import { Weapon } from "../Weapon";
import type { AttackContext } from "../CombatTypes";
import { TextureKeys } from "../../core/TextureFactory";
import type { WeaponStats } from "../../core/types";

/** Medium-range line hit. Every other input becomes a wider sweep instead of a thrust. */
export class SpearWeapon extends Weapon {
  constructor(stats: WeaponStats) {
    super(stats);
  }

  protected override performAttack(
    context: AttackContext,
    origin: Phaser.Math.Vector2,
    direction: Phaser.Math.Vector2,
  ): void {
    const isSweep =
      this.stats.comboLength > 1 &&
      this.comboIndex === this.stats.comboLength - 1;

    context.spawnHitbox({
      x: origin.x,
      y: origin.y,
      dirX: direction.x,
      dirY: direction.y,
      width: isSweep ? this.stats.range * 0.8 : this.stats.range,
      height: isSweep ? this.stats.range * 0.9 : 12,
      offset: this.stats.range * (isSweep ? 0.4 : 0.55),
      durationMs: this.stats.activeMs,
      damage: this.stats.damage * (isSweep ? 0.85 : 1),
      knockback: this.stats.knockback,
      faction: context.owner.faction,
      abilityEffectId: this.stats.abilityEffectId,
      owner: context.owner,
      texture: isSweep ? TextureKeys.slash : TextureKeys.thrust,
      tint: 0xd6e4ff,
      followOwner: true,
      maxTargets: isSweep ? 5 : 3,
    });
  }

  override getAnimationKey(): string {
    return this.comboIndex === this.stats.comboLength - 1
      ? "spear-sweep"
      : "spear-thrust";
  }
}
