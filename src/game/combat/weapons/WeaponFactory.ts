import type { WeaponClass, WeaponStats } from '../../core/types';
import { Weapon } from '../Weapon';
import { SwordWeapon } from './SwordWeapon';
import { SpearWeapon } from './SpearWeapon';
import { HeavyWeapon } from './HeavyWeapon';
import { MagicWeapon } from './MagicWeapon';

type WeaponConstructor = new (stats: WeaponStats) => Weapon;

const CLASS_MAP: Readonly<Record<WeaponClass, WeaponConstructor>> = {
  sword: SwordWeapon,
  spear: SpearWeapon,
  heavy: HeavyWeapon,
  magic: MagicWeapon,
};

/** Variants are data rows; one concrete class per weapon class handles all of them. */
export function createWeapon(stats: WeaponStats): Weapon {
  const Constructor = CLASS_MAP[stats.weaponClass];
  if (!Constructor) throw new Error(`Unknown weapon class: ${stats.weaponClass}`);
  return new Constructor(stats);
}
