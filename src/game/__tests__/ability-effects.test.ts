import { describe, expect, it } from "vitest";
import { Rng } from "../core/Rng";
import { StatusComponent } from "../entities/components/StatusComponent";
import { AbilityEffectRegistry } from "../combat/AbilityEffectRegistry";
import type { Entity } from "../entities/Entity";

function fakeTarget(status: StatusComponent): Entity {
  return { x: 0, y: 0, status } as unknown as Entity;
}

describe("AbilityEffectRegistry", () => {
  it("none is a genuine no-op", () => {
    expect(() =>
      AbilityEffectRegistry.resolve("none").apply({
        nowMs: 0,
        source: null,
        target: fakeTarget(new StatusComponent(() => undefined)),
        rng: new Rng(1),
        queryEnemiesNear: () => [],
        dealDamage: () => undefined,
        spawnBurst: () => undefined,
      }),
    ).not.toThrow();
  });

  it("bleed applies a ticking dot using effects.json values (magnitude 3, tickMs 500)", () => {
    const ticks: number[] = [];
    const status = new StatusComponent((dmg) => ticks.push(dmg));
    AbilityEffectRegistry.resolve("bleed").apply({
      nowMs: 0,
      source: null,
      target: fakeTarget(status),
      rng: new Rng(1),
      queryEnemiesNear: () => [],
      dealDamage: () => undefined,
      spawnBurst: () => undefined,
    });
    status.update(500);
    expect(ticks).toEqual([3]);
  });

  it("chain_lightning damages up to maxChainTargets nearby targets for effects.json damage (9)", () => {
    const target = fakeTarget(new StatusComponent(() => undefined));
    const hits: number[] = [];
    AbilityEffectRegistry.resolve("chain_lightning").apply({
      nowMs: 0,
      source: null,
      target,
      rng: new Rng(1),
      queryEnemiesNear: () => [target, target, target],
      dealDamage: (_t, amount) => hits.push(amount),
      spawnBurst: () => undefined,
    });
    expect(hits).toEqual([9, 9]);
  });

  it("ground_slam splashes stagger onto nearby targets", () => {
    const splashStatus = new StatusComponent(() => undefined);
    const splashTarget = fakeTarget(splashStatus);
    AbilityEffectRegistry.resolve("ground_slam").apply({
      nowMs: 0,
      source: null,
      target: fakeTarget(new StatusComponent(() => undefined)),
      rng: new Rng(1),
      queryEnemiesNear: () => [splashTarget],
      dealDamage: () => undefined,
      spawnBurst: () => undefined,
    });
    expect(splashStatus.speedMultiplier).toBeLessThan(1);
  });

  it("armor_break raises incoming damage multiplier", () => {
    const status = new StatusComponent(() => undefined);
    AbilityEffectRegistry.resolve("armor_break").apply({
      nowMs: 0,
      source: null,
      target: fakeTarget(status),
      rng: new Rng(1),
      queryEnemiesNear: () => [],
      dealDamage: () => undefined,
      spawnBurst: () => undefined,
    });
    expect(status.incomingMultiplier).toBeGreaterThan(1);
  });
});
