import type Phaser from "phaser";
import { Weapon } from "../Weapon";
import type { AttackContext } from "../CombatTypes";
import type { WeaponStats } from "../../core/types";

const SPREAD_DEGREES = 9;

/** Ranged cast. comboLength doubles as projectiles per cast so variants stay data-only. */
export class MagicWeapon extends Weapon {
  constructor(stats: WeaponStats) {
    super(stats);
  }

  protected override performAttack(
    context: AttackContext,
    origin: Phaser.Math.Vector2,
    direction: Phaser.Math.Vector2,
  ): void {
    const count = Math.max(1, this.stats.comboLength);
    const baseAngle = Math.atan2(direction.y, direction.x);
    const spreadRad = (SPREAD_DEGREES * Math.PI) / 180;

    for (let i = 0; i < count; i += 1) {
      const offsetIndex = i - (count - 1) / 2;
      const angle = baseAngle + offsetIndex * spreadRad;
      context.spawnProjectile({
        x: origin.x + Math.cos(angle) * 8,
        y: origin.y + Math.sin(angle) * 8,
        dirX: Math.cos(angle),
        dirY: Math.sin(angle),
        speed: this.stats.projectileSpeed ?? 240,
        damage: this.stats.damage,
        knockback: this.stats.knockback,
        faction: context.owner.faction,
        abilityEffectId: this.stats.abilityEffectId,
        owner: context.owner,
        lifetimeMs:
          (this.stats.range / (this.stats.projectileSpeed ?? 240)) * 1000,
        tint: this.tintForEffect(),
        scale: 1.1,
        piercing: this.stats.abilityEffectId === "pierce_line",
      });
    }
  }

  private tintForEffect(): number {
    switch (this.stats.abilityEffectId) {
      case "ignite":
        return 0xff7a3c;
      case "frost_slow":
        return 0x8fd8ff;
      case "chain_lightning":
        return 0xd9c8ff;
      default:
        return 0xffffff;
    }
  }

  override getAnimationKey(): string {
    return `cast-${this.stats.abilityEffectId}`;
  }

  /** Overridden: a cast commits fully, so swapping mid-cast is gated on the projectile leaving. */
  override canBeCancelledBySwap(elapsedMs: number): boolean {
    if (!Number.isFinite(elapsedMs)) return true;
    return elapsedMs >= this.stats.swapCancelWindowMs;
  }
}
