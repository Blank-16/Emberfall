import type { Rng } from '../core/Rng';
import type { WeightedEntry } from '../core/types';

/** Weighted pick with an O(n) scan; tables are small enough that prebuilt aliases are not worth it. */
export function rollLoot(table: ReadonlyArray<WeightedEntry>, rng: Rng): string | null {
  if (table.length === 0) return null;

  let total = 0;
  for (const entry of table) total += Math.max(0, entry.weight);
  if (total <= 0) return null;

  let ticket = rng.next() * total;
  for (const entry of table) {
    ticket -= Math.max(0, entry.weight);
    if (ticket <= 0) return entry.itemId;
  }
  return table[table.length - 1]?.itemId ?? null;
}
