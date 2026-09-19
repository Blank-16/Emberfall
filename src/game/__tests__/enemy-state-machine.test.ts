import { describe, expect, it } from "vitest";
import {
  getEnemyStates,
  StateMachine,
  type EnemyContext,
  type EnemyState,
} from "../ai/EnemyStateMachine";
import type { EnemyDefinition } from "../core/types";

function buildContext(definition: EnemyDefinition) {
  let distance = 200;
  let hpRatio = 1;
  const log: string[] = [];
  const context: EnemyContext = {
    definition,
    distanceToTarget: () => distance,
    hasTarget: () => true,
    healthRatio: () => hpRatio,
    moveToward: () => undefined,
    moveAway: () => undefined,
    strafe: () => undefined,
    faceTarget: () => undefined,
    halt: () => undefined,
    beginTelegraph: () => log.push("telegraph"),
    executeAttack: () => log.push("attack"),
    hasLineOfSight: () => true,
  };
  return {
    context,
    log,
    setDistance: (value: number) => (distance = value),
    setHealthRatio: (value: number) => (hpRatio = value),
  };
}

const MELEE_DEFINITION: EnemyDefinition = {
  id: "test_enemy",
  displayName: "Test",
  health: 10,
  moveSpeed: 50,
  aggroRange: 100,
  damage: 5,
  behavior: "melee_chaser",
  attackRange: 20,
  attackWindupMs: 100,
  attackActiveMs: 50,
  attackRecoveryMs: 100,
  fleeHealthRatio: 0,
  bodyRadius: 5,
  tint: 0xffffff,
  dropTable: [],
  currencyDrop: 0,
};

describe("EnemyStateMachine (melee_chaser)", () => {
  it("walks idle -> aggro -> attack -> recover -> aggro on schedule", () => {
    const { context, log, setDistance } = buildContext(MELEE_DEFINITION);
    const machine = new StateMachine<EnemyContext, EnemyState>(
      context,
      getEnemyStates("melee_chaser"),
      "idle",
    );

    machine.update(0);
    expect(machine.state).toBe("idle");

    setDistance(50);
    machine.update(10);
    expect(machine.state).toBe("aggro");

    setDistance(15);
    machine.update(20);
    expect(machine.state).toBe("attack");

    machine.update(150);
    expect(log.filter((e) => e === "telegraph")).toHaveLength(1);

    machine.update(180);
    expect(log).toContain("attack");
    expect(machine.state).toBe("recover");

    machine.update(220);
    expect(machine.state).toBe("recover");

    machine.update(300);
    expect(machine.state).toBe("aggro");
  });

  it("flees below fleeHealthRatio and returns once healed back above it", () => {
    const fleeDefinition: EnemyDefinition = {
      ...MELEE_DEFINITION,
      fleeHealthRatio: 0.3,
    };
    const { context, setDistance, setHealthRatio } =
      buildContext(fleeDefinition);
    const machine = new StateMachine<EnemyContext, EnemyState>(
      context,
      getEnemyStates("melee_chaser"),
      "idle",
    );

    setDistance(50);
    machine.update(0);
    expect(machine.state).toBe("aggro");

    setHealthRatio(0.2);
    machine.update(10);
    expect(machine.state).toBe("flee");

    setHealthRatio(0.9);
    machine.update(1500);
    expect(machine.state).toBe("aggro");
  });

  it("returns to idle once the target leaves aggro range entirely", () => {
    const { context, setDistance } = buildContext(MELEE_DEFINITION);
    const machine = new StateMachine<EnemyContext, EnemyState>(
      context,
      getEnemyStates("melee_chaser"),
      "idle",
    );

    setDistance(50);
    machine.update(0);
    expect(machine.state).toBe("aggro");

    setDistance(500);
    machine.update(10);
    expect(machine.state).toBe("idle");
  });
});
