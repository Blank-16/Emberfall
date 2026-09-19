export interface DamageResult {
  readonly applied: number;
  readonly absorbed: number;
  readonly blocked: boolean;
  readonly died: boolean;
}

export class HealthComponent {
  private currentValue: number;
  private shieldValue = 0;
  private invulnerableUntilMs = -1;

  constructor(
    private maxValue: number,
    private readonly onChanged?: (current: number, max: number) => void,
    private readonly onDeath?: () => void,
  ) {
    this.currentValue = maxValue;
  }

  get current(): number {
    return this.currentValue;
  }

  get max(): number {
    return this.maxValue;
  }

  get shield(): number {
    return this.shieldValue;
  }

  get ratio(): number {
    return this.maxValue > 0 ? this.currentValue / this.maxValue : 0;
  }

  get isDead(): boolean {
    return this.currentValue <= 0;
  }

  isInvulnerable(nowMs: number): boolean {
    return nowMs < this.invulnerableUntilMs;
  }

  grantInvulnerability(nowMs: number, durationMs: number): void {
    this.invulnerableUntilMs = Math.max(
      this.invulnerableUntilMs,
      nowMs + durationMs,
    );
  }

  damage(amount: number, nowMs: number, invulnerabilityMs = 0): DamageResult {
    if (amount <= 0 || this.isDead)
      return { applied: 0, absorbed: 0, blocked: true, died: false };
    if (this.isInvulnerable(nowMs))
      return { applied: 0, absorbed: 0, blocked: true, died: false };

    const absorbed = Math.min(this.shieldValue, amount);
    this.shieldValue -= absorbed;
    const applied = Math.min(this.currentValue, amount - absorbed);
    this.currentValue -= applied;

    if (invulnerabilityMs > 0)
      this.grantInvulnerability(nowMs, invulnerabilityMs);
    this.onChanged?.(this.currentValue, this.maxValue);

    const died = this.currentValue <= 0;
    if (died) this.onDeath?.();
    return { applied, absorbed, blocked: false, died };
  }

  heal(amount: number): number {
    if (amount <= 0 || this.isDead) return 0;
    const healed = Math.min(amount, this.maxValue - this.currentValue);
    this.currentValue += healed;
    if (healed > 0) this.onChanged?.(this.currentValue, this.maxValue);
    return healed;
  }

  addShield(amount: number): void {
    if (amount <= 0) return;
    this.shieldValue += amount;
  }

  clearShield(): void {
    this.shieldValue = 0;
  }

  increaseMax(amount: number, healToFull: boolean): void {
    this.maxValue += amount;
    if (healToFull) this.currentValue = this.maxValue;
    this.onChanged?.(this.currentValue, this.maxValue);
  }

  resetToFull(): void {
    this.currentValue = this.maxValue;
    this.shieldValue = 0;
    this.invulnerableUntilMs = -1;
    this.onChanged?.(this.currentValue, this.maxValue);
  }
}
