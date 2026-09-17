/**
 * Cell size must exceed the largest possible combined reach of (hitbox half-extent +
 * target half-extent), or a 3x3 query could miss a target whose center sits just past
 * the boundary. Largest case in this game: the boss ground-slam hitbox (radius 62) plus
 * a body radius (~13) is ~75px -- 128px leaves a comfortable margin.
 */
const CELL_SIZE = 128;

export class SpatialGrid<T> {
  private readonly cells = new Map<string, T[]>();

  private key(cellX: number, cellY: number): string {
    return `${cellX},${cellY}`;
  }

  clear(): void {
    this.cells.clear();
  }

  insert(x: number, y: number, item: T): void {
    const key = this.key(Math.floor(x / CELL_SIZE), Math.floor(y / CELL_SIZE));
    let bucket = this.cells.get(key);
    if (!bucket) {
      bucket = [];
      this.cells.set(key, bucket);
    }
    bucket.push(item);
  }

  /** Everything in the 3x3 block of cells centered on (x,y). May include false positives; never misses a true hit given CELL_SIZE's margin above. */
  near(x: number, y: number): T[] {
    const cellX = Math.floor(x / CELL_SIZE);
    const cellY = Math.floor(y / CELL_SIZE);
    const found: T[] = [];
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const bucket = this.cells.get(this.key(cellX + dx, cellY + dy));
        if (bucket) found.push(...bucket);
      }
    }
    return found;
  }
}
