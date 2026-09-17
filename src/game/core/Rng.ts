/** Deterministic xorshift32 so loot and crit rolls stay reproducible under a fixed seed. */
export class Rng {
  private state: number;

  constructor(seed: number = Date.now() >>> 0) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0x100000000;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  intRange(min: number, maxExclusive: number): number {
    return Math.floor(this.range(min, maxExclusive));
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }
}
