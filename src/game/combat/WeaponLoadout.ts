import { EventBus } from '../core/EventBus';
import type { Weapon } from './Weapon';

export type LoadoutSlot = 0 | 1;

export interface SwapResult {
  readonly swapped: boolean;
  readonly cancelledRecovery: boolean;
}

/**
 * Two equipped weapons with a real-time swap. A swap is allowed during recovery frames
 * (cancelling them) but rejected while the active weapon is still in active-hit frames.
 */
export class WeaponLoadout {
  private slots: [Weapon, Weapon];
  private activeSlot: LoadoutSlot = 0;

  constructor(primary: Weapon, secondary: Weapon) {
    this.slots = [primary, secondary];
  }

  get active(): Weapon {
    return this.slots[this.activeSlot];
  }

  get secondary(): Weapon {
    return this.slots[this.activeSlot === 0 ? 1 : 0];
  }

  get slot(): LoadoutSlot {
    return this.activeSlot;
  }

  get weapons(): readonly [Weapon, Weapon] {
    return this.slots;
  }

  swap(nowMs: number): SwapResult {
    const current = this.active;
    const elapsed = current.elapsedSinceAttackMs(nowMs);
    const inActiveFrames = current.isInActiveFrames(nowMs);

    if (!current.canBeCancelledBySwap(elapsed)) {
      EventBus.emit('weapon:swapped', { activeSlot: this.activeSlot, weaponId: current.id, cancelled: true });
      return { swapped: false, cancelledRecovery: false };
    }

    const cancelledRecovery = !inActiveFrames && elapsed < current.attackIntervalMs;
    this.activeSlot = this.activeSlot === 0 ? 1 : 0;
    this.emitState(false);
    return { swapped: true, cancelledRecovery };
  }

  equip(slot: LoadoutSlot, weapon: Weapon): void {
    this.slots[slot] = weapon;
    this.emitState(false);
  }

  emitState(cancelled: boolean): void {
    EventBus.emit('weapon:loadout-changed', {
      activeSlot: this.activeSlot,
      slots: this.slots.map((weapon) => ({
        id: weapon.id,
        displayName: weapon.displayName,
        weaponClass: weapon.weaponClass,
      })),
    });
    EventBus.emit('weapon:swapped', {
      activeSlot: this.activeSlot,
      weaponId: this.active.id,
      cancelled,
    });
  }

  reset(): void {
    for (const weapon of this.slots) weapon.reset();
  }
}
