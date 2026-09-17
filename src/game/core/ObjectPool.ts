export interface Poolable {
  reset(): void;
}

/** Bounded pool. Keeps projectiles, hitboxes and damage text out of the allocation path. */
export class ObjectPool<T extends Poolable> {
  private readonly free: T[] = [];
  private readonly live = new Set<T>();

  constructor(
    private readonly factory: () => T,
    initialSize = 0,
    private readonly maxSize = 512,
  ) {
    for (let i = 0; i < initialSize; i += 1) this.free.push(factory());
  }

  acquire(): T | null {
    const item = this.free.pop() ?? (this.size < this.maxSize ? this.factory() : null);
    if (item) this.live.add(item);
    return item;
  }

  release(item: T): void {
    if (!this.live.delete(item)) return;
    item.reset();
    this.free.push(item);
  }

  releaseAll(): void {
    for (const item of [...this.live]) this.release(item);
  }

  forEachActive(fn: (item: T) => void): void {
    for (const item of this.live) fn(item);
  }

  get size(): number {
    return this.free.length + this.live.size;
  }

  get activeCount(): number {
    return this.live.size;
  }
}
