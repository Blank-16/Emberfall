import { describe, expect, it } from 'vitest';
import { Rng } from '../core/Rng';
import { rollLoot } from '../items/LootTable';

describe('rollLoot', () => {
  it('returns null for an empty table', () => {
    expect(rollLoot([], new Rng(1))).toBeNull();
  });

  it('roughly matches configured weights over many rolls', () => {
    const rng = new Rng(99);
    const table = [
      { itemId: 'common', weight: 90 },
      { itemId: 'rare', weight: 10 },
    ];
    const counts: Record<string, number> = { common: 0, rare: 0 };
    const trials = 5000;
    for (let i = 0; i < trials; i += 1) {
      const id = rollLoot(table, rng);
      if (id) counts[id] = (counts[id] ?? 0) + 1;
    }
    const rareRatio = (counts.rare ?? 0) / trials;
    expect(rareRatio).toBeGreaterThan(0.07);
    expect(rareRatio).toBeLessThan(0.13);
  });

  it('never returns an entry with zero total weight', () => {
    const rng = new Rng(1);
    expect(rollLoot([{ itemId: 'x', weight: 0 }], rng)).toBeNull();
  });
});
