import { describe, expect, it } from 'vitest';
import { Rng } from '../core/Rng';

describe('Rng', () => {
  it('reproduces the same sequence from the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it('keeps next() within [0, 1)', () => {
    const rng = new Rng(1);
    for (let i = 0; i < 500; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('keeps intRange within the requested bounds', () => {
    const rng = new Rng(1);
    for (let i = 0; i < 200; i += 1) {
      const value = rng.intRange(0, 3);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(3);
    }
  });
});
