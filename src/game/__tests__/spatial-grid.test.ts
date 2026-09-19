import { describe, expect, it } from 'vitest';
import { SpatialGrid } from '../combat/SpatialGrid';

interface Point {
  readonly id: number;
  readonly x: number;
  readonly y: number;
}

describe('SpatialGrid', () => {
  it('never produces a false negative at the worst-case interaction radius (~75px)', () => {
    const REACH = 75;
    let checkedAtLeastOneCandidate = false;

    for (let trial = 0; trial < 2000; trial += 1) {
      const grid = new SpatialGrid<Point>();
      const sourceX = Math.random() * 2000 - 1000;
      const sourceY = Math.random() * 2000 - 1000;

      const points: Point[] = [];
      for (let i = 0; i < 15; i += 1) {
        const point: Point = {
          id: i,
          x: sourceX + (Math.random() * 2 - 1) * 200,
          y: sourceY + (Math.random() * 2 - 1) * 200,
        };
        points.push(point);
        grid.insert(point.x, point.y, point);
      }

      const withinReach = (p: Point): boolean => Math.hypot(p.x - sourceX, p.y - sourceY) <= REACH;
      const expected = points.filter(withinReach).map((p) => p.id);
      if (expected.length > 0) checkedAtLeastOneCandidate = true;

      const actual = grid.near(sourceX, sourceY).filter(withinReach).map((p) => p.id);
      for (const id of expected) {
        expect(actual).toContain(id);
      }
    }

    // Sanity check that the fuzz actually exercised the reach condition at least once.
    expect(checkedAtLeastOneCandidate).toBe(true);
  });

  it('returns nothing for an empty grid', () => {
    const grid = new SpatialGrid<Point>();
    expect(grid.near(0, 0)).toEqual([]);
  });

  it('clear() removes previously inserted items', () => {
    const grid = new SpatialGrid<Point>();
    grid.insert(0, 0, { id: 1, x: 0, y: 0 });
    grid.clear();
    expect(grid.near(0, 0)).toEqual([]);
  });
});
