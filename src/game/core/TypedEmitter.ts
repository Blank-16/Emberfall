export type EventMap = object;
export type Handler<T> = (payload: T) => void;

/** Minimal typed pub/sub. No Phaser coupling, so React may import it freely. */
export class TypedEmitter<M extends EventMap> {
  private readonly handlers = new Map<keyof M, Set<Handler<never>>>();

  on<K extends keyof M>(event: K, handler: Handler<M[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(event, handler);
  }

  once<K extends keyof M>(event: K, handler: Handler<M[K]>): () => void {
    const dispose = this.on(event, (payload) => {
      dispose();
      handler(payload);
    });
    return dispose;
  }

  off<K extends keyof M>(event: K, handler: Handler<M[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof M>(event: K, payload: M[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const handler of [...set]) (handler as Handler<M[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
