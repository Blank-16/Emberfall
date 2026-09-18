import { useState } from 'react';
import { GameBridge } from '@game/core/GameBridge';
import { useGameEvent } from '../hooks/useGameEvent';

export function Inventory(): JSX.Element {
  const [open, setOpen] = useState(false);
  const inventory = useGameEvent('inventory:changed', { potions: [], selectedId: null });

  const selected = inventory.potions.find((potion) => potion.id === inventory.selectedId) ?? null;

  return (
    <>
      <button className="inventory-toggle" onClick={() => setOpen((prev) => !prev)}>
        {selected ? (
          <span className="potion-row">
            <span className="key-hint">F</span>
            {selected.displayName} x{selected.count}
          </span>
        ) : (
          <span className="potion-row">
            <span className="key-hint">F</span>
            No potion selected
          </span>
        )}
      </button>

      {open && (
        <div className="inventory-panel plate">
          <div className="panel-title">Potions</div>
          {inventory.potions.length === 0 && <div className="inventory-empty">Nothing in the pouch yet.</div>}
          {inventory.potions.map((potion) => (
            <div
              key={potion.id}
              className={`potion-chip clickable ${potion.id === inventory.selectedId ? 'selected' : ''}`}
              onClick={() => GameBridge.selectPotion(potion.id)}
              onDoubleClick={() => GameBridge.usePotion(potion.id)}
            >
              <span>
                {potion.displayName} x{potion.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
