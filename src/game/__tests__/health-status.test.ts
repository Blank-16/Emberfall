import { describe, expect, it } from 'vitest';
import { HealthComponent } from '../entities/components/HealthComponent';
import { StatusComponent } from '../entities/components/StatusComponent';

describe('HealthComponent', () => {
  it('absorbs damage with shield before health, and grants invulnerability for the next hit', () => {
    let deaths = 0;
    const hp = new HealthComponent(100, undefined, () => (deaths += 1));
    hp.addShield(20);

    const first = hp.damage(30, 1000, 0);
    expect(first).toEqual({ applied: 10, absorbed: 20, blocked: false, died: false });
    expect(hp.current).toBe(90);

    // This hit lands (nothing granted invuln yet) and itself grants 500ms of invulnerability.
    const second = hp.damage(10, 1001, 500);
    expect(second.blocked).toBe(false);
    expect(hp.current).toBe(80);

    // Inside that window: blocked.
    const third = hp.damage(10, 1200, 0);
    expect(third.blocked).toBe(true);
    expect(hp.current).toBe(80);

    // After the window: lands again.
    const fourth = hp.damage(10, 1600, 0);
    expect(fourth.blocked).toBe(false);
    expect(hp.current).toBe(70);

    hp.damage(1000, 2000, 0);
    expect(deaths).toBe(1);
    expect(hp.isDead).toBe(true);
  });

  it('heals up to max and never past it', () => {
    const hp = new HealthComponent(100);
    hp.damage(40, 0, 0);
    const healed = hp.heal(1000);
    expect(healed).toBe(40);
    expect(hp.current).toBe(100);
  });
});

describe('StatusComponent', () => {
  it('ticks a dot on schedule, including exactly at its expiry boundary, then stops', () => {
    let dotDamage = 0;
    const status = new StatusComponent((dmg) => (dotDamage += dmg));
    status.apply({ id: 'bleed', kind: 'dot', magnitude: 5, durationMs: 1000, tickMs: 500 }, 0);

    status.update(400);
    expect(dotDamage).toBe(0);

    status.update(500);
    expect(dotDamage).toBe(5);

    // A 1000ms/500ms dot ticks at both 500 and 1000 (its own expiry) before being removed.
    status.update(1100);
    expect(dotDamage).toBe(10);

    status.update(2000);
    expect(dotDamage).toBe(10);
  });

  it('combines slow and speed multipliers additively, floored at 0.15', () => {
    const status = new StatusComponent(() => undefined);
    status.apply({ id: 'slow', kind: 'slow', magnitude: 0.4, durationMs: 500 }, 0);
    expect(status.speedMultiplier).toBeCloseTo(0.6);

    status.apply({ id: 'haste', kind: 'speed', magnitude: 0.3, durationMs: 500 }, 0);
    expect(status.speedMultiplier).toBeCloseTo(0.9);
  });

  it('expires effects and removes their contribution', () => {
    const status = new StatusComponent(() => undefined);
    status.apply({ id: 'slow', kind: 'slow', magnitude: 0.5, durationMs: 100 }, 0);
    expect(status.speedMultiplier).toBeCloseTo(0.5);
    status.update(150);
    expect(status.speedMultiplier).toBe(1);
  });
});
