import { Inventory } from "../items/Inventory";
import { WeaponLoadout } from "../combat/WeaponLoadout";
import { createWeapon } from "../combat/weapons/WeaponFactory";
import { GameData, DEFAULT_LOADOUT } from "../data/GameData";

/**
 * Survives Hub <-> Dungeon scene swaps for the lifetime of the page. Phase 2 adds
 * localStorage/Supabase persistence behind this same interface; nothing above it changes.
 *
 * inventory/loadout are mutable (not readonly) specifically so reset() can swap in fresh
 * instances -- tests that touch RunState need a clean slate between cases, since it's a
 * module-level singleton that would otherwise leak state across the whole test run. Anything
 * holding an existing reference (a live Player, say) won't see the swap; reset() is for
 * between-test isolation and starting a new save, not for hot-swapping a running scene.
 */
class RunStateImpl {
  inventory: Inventory;
  loadout: WeaponLoadout;

  constructor() {
    this.inventory = this.createInventory();
    this.loadout = this.createLoadout();
  }

  reset(): void {
    this.inventory = this.createInventory();
    this.loadout = this.createLoadout();
  }

  private createInventory(): Inventory {
    const inventory = new Inventory(GameData.potions);
    inventory.addPotion("elixir_mend", 2);
    inventory.addPotion("ward_stone", 1);
    return inventory;
  }

  private createLoadout(): WeaponLoadout {
    return new WeaponLoadout(
      createWeapon(GameData.weapon(DEFAULT_LOADOUT[0])),
      createWeapon(GameData.weapon(DEFAULT_LOADOUT[1])),
    );
  }
}

export const RunState = new RunStateImpl();
