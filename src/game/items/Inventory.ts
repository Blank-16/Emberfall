import { EventBus } from '../core/EventBus';
import type { PotionDefinition } from '../core/types';

const MAX_STACK = 5;

export class Inventory {
  private readonly counts = new Map<string, number>();
  private currencyValue = 0;
  private selectedId: string | null = null;

  constructor(private readonly potionDefinitions: ReadonlyMap<string, PotionDefinition>) {}

  get currency(): number {
    return this.currencyValue;
  }

  get selectedPotionId(): string | null {
    return this.selectedId;
  }

  addCurrency(amount: number): void {
    if (amount <= 0) return;
    this.currencyValue += amount;
    EventBus.emit('currency:changed', { total: this.currencyValue });
  }

  spendCurrency(amount: number): boolean {
    if (amount <= 0 || this.currencyValue < amount) return false;
    this.currencyValue -= amount;
    EventBus.emit('currency:changed', { total: this.currencyValue });
    return true;
  }

  /** Returns false when the stack is already full so the pickup can stay in the world. */
  addPotion(potionId: string, amount = 1): boolean {
    if (!this.potionDefinitions.has(potionId)) return false;
    const current = this.counts.get(potionId) ?? 0;
    if (current >= MAX_STACK) return false;

    this.counts.set(potionId, Math.min(MAX_STACK, current + amount));
    this.selectedId ??= potionId;
    this.emitChanged();
    return true;
  }

  consume(potionId: string): boolean {
    const current = this.counts.get(potionId) ?? 0;
    if (current <= 0) return false;

    if (current === 1) this.counts.delete(potionId);
    else this.counts.set(potionId, current - 1);

    if (!this.counts.has(potionId)) this.selectedId = this.firstAvailable();
    this.emitChanged();
    return true;
  }

  count(potionId: string): number {
    return this.counts.get(potionId) ?? 0;
  }

  select(potionId: string): boolean {
    if (!this.counts.has(potionId)) return false;
    this.selectedId = potionId;
    this.emitChanged();
    return true;
  }

  selectNext(): void {
    const ids = [...this.counts.keys()];
    if (ids.length === 0) {
      this.selectedId = null;
      return;
    }
    const index = this.selectedId ? ids.indexOf(this.selectedId) : -1;
    this.selectedId = ids[(index + 1) % ids.length] ?? null;
    this.emitChanged();
  }

  clearPotions(): void {
    this.counts.clear();
    this.selectedId = null;
    this.emitChanged();
  }

  emitChanged(): void {
    EventBus.emit('inventory:changed', {
      potions: [...this.counts.entries()].map(([id, count]) => ({
        id,
        displayName: this.potionDefinitions.get(id)?.displayName ?? id,
        count,
      })),
      selectedId: this.selectedId,
    });
    EventBus.emit('currency:changed', { total: this.currencyValue });
  }

  private firstAvailable(): string | null {
    for (const id of this.counts.keys()) return id;
    return null;
  }
}
