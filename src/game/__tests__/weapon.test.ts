import { describe, expect, it } from 'vitest';
import { Weapon } from '../combat/Weapon';
import { WeaponLoadout } from '../combat/WeaponLoadout';
import type { AttackContext, HitboxSpec, ProjectileSpec } from '../combat/CombatTypes';
import type { WeaponStats } from '../core/types';

/** Records what it was asked to do instead of touching Phaser/textures, unlike the real weapon classes. */
class TestMeleeWeapon extends Weapon {
  readonly hits: HitboxSpec[] = [];

  constructor(stats: WeaponStats) {
    super(stats);
  }

  protected override performAttack(context: AttackContext): void {
    const spec: HitboxSpec = {
      x: 0,
      y: 0,
      dirX: 1,
      dirY: 0,
      width: this.stats.range,
      height: this.stats.range,
      offset: 0,
      durationMs: this.stats.activeMs,
      damage: this.stats.damage * (this.comboIndex === this.stats.comboLength - 1 ? 1.5 : 1),
      knockback: this.stats.knockback,
      faction: 'player',
      abilityEffectId: this.stats.abilityEffectId,
      owner: null,
    };
    this.hits.push(spec);
    context.spawnHitbox(spec);
  }

  override getAnimationKey(): string {
    return 'test-melee';
  }
}

class TestRangedWeapon extends Weapon {
  readonly casts: ProjectileSpec[] = [];

  constructor(stats: WeaponStats) {
    super(stats);
  }

  protected override performAttack(context: AttackContext): void {
    for (let i = 0; i < this.stats.comboLength; i += 1) {
      const spec: ProjectileSpec = {
        x: 0,
        y: 0,
        dirX: 1,
        dirY: 0,
        speed: this.stats.projectileSpeed ?? 200,
        damage: this.stats.damage,
        knockback: this.stats.knockback,
        faction: 'player',
        abilityEffectId: this.stats.abilityEffectId,
        owner: null,
        lifetimeMs: 1000,
        tint: 0xffffff,
        scale: 1,
        piercing: false,
      };
      this.casts.push(spec);
      context.spawnProjectile(spec);
    }
  }

  override getAnimationKey(): string {
    return 'test-ranged';
  }
}

function noopContext(nowMs: number): AttackContext {
  return {
    scene: {} as never,
    owner: {} as never,
    nowMs,
    spawnHitbox: () => undefined,
    spawnProjectile: () => undefined,
    shake: () => undefined,
  };
}

const ORIGIN = { x: 0, y: 0 } as never;
const DIRECTION = { x: 1, y: 0 } as never;

function meleeStats(overrides: Partial<WeaponStats> = {}): WeaponStats {
  return {
    id: 'test_sword',
    displayName: 'Test Sword',
    weaponClass: 'sword',
    damage: 10,
    attackSpeed: 10,
    range: 30,
    swapCancelWindowMs: 50,
    abilityEffectId: 'none',
    knockback: 10,
    activeMs: 20,
    recoveryMs: 30,
    arcDegrees: 90,
    comboLength: 3,
    ...overrides,
  };
}

describe('Weapon', () => {
  it('gates the next attack behind its cooldown', () => {
    const sword = new TestMeleeWeapon(meleeStats());
    expect(sword.canAttack(0)).toBe(true);
    sword.attack(noopContext(0), ORIGIN, DIRECTION);
    expect(sword.canAttack(5)).toBe(false);
  });

  it('cycles combo index and boosts the finisher hit', () => {
    const sword = new TestMeleeWeapon(meleeStats());
    sword.attack(noopContext(0), ORIGIN, DIRECTION);
    sword.attack(noopContext(100), ORIGIN, DIRECTION);
    sword.attack(noopContext(200), ORIGIN, DIRECTION);
    expect(sword.hits).toHaveLength(3);
    expect(sword.hits[2]!.damage).toBeGreaterThan(sword.hits[0]!.damage);
  });

  it('cannot be cancelled by a swap during active-hit frames, but can during recovery', () => {
    const sword = new TestMeleeWeapon(meleeStats());
    expect(sword.canBeCancelledBySwap(5)).toBe(false);
    expect(sword.canBeCancelledBySwap(60)).toBe(true);
  });

  it('a ranged weapon fans comboLength out into that many projectiles per cast', () => {
    const magic = new TestRangedWeapon(
      meleeStats({ id: 'test_spell', weaponClass: 'magic', comboLength: 3, projectileSpeed: 250 }),
    );
    magic.attack(noopContext(0), ORIGIN, DIRECTION);
    expect(magic.casts).toHaveLength(3);
  });
});

describe('WeaponLoadout', () => {
  it('rejects a swap while the active weapon is mid-swing, allows it once in recovery', () => {
    const primary = new TestMeleeWeapon(meleeStats({ id: 'loadout_sword', activeMs: 30, recoveryMs: 50, swapCancelWindowMs: 40 }));
    const secondary = new TestRangedWeapon(
      meleeStats({ id: 'loadout_spell', weaponClass: 'magic', comboLength: 1, activeMs: 50, recoveryMs: 100 }),
    );
    const loadout = new WeaponLoadout(primary, secondary);

    primary.attack(noopContext(0), ORIGIN, DIRECTION);

    expect(loadout.swap(10).swapped).toBe(false);

    const swapped = loadout.swap(45);
    expect(swapped.swapped).toBe(true);
    expect(loadout.slot).toBe(1);
  });
});
