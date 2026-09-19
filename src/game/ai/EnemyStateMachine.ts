import type { EnemyBehavior, EnemyDefinition } from "../core/types";

export type EnemyState = "idle" | "aggro" | "attack" | "recover" | "flee";

export interface EnemyContext {
  readonly definition: EnemyDefinition;
  distanceToTarget(): number;
  hasTarget(): boolean;
  healthRatio(): number;
  moveToward(speedMultiplier: number, nowMs: number): void;
  moveAway(speedMultiplier: number, nowMs: number): void;
  strafe(speedMultiplier: number, nowMs: number): void;
  faceTarget(): void;
  halt(): void;
  beginTelegraph(durationMs: number): void;
  executeAttack(nowMs: number): void;
  hasLineOfSight(): boolean;
}

export interface StateDefinition<C> {
  onEnter?(context: C, nowMs: number): void;
  onUpdate(context: C, nowMs: number, elapsedMs: number): string | null;
  onExit?(context: C, nowMs: number): void;
}

export class StateMachine<C, S extends string> {
  private currentState: S;
  private enteredAtMs = 0;

  constructor(
    private readonly context: C,
    private readonly states: Readonly<Record<S, StateDefinition<C>>>,
    initial: S,
  ) {
    this.currentState = initial;
  }

  get state(): S {
    return this.currentState;
  }

  transition(next: S, nowMs: number): void {
    if (next === this.currentState) return;
    this.states[this.currentState].onExit?.(this.context, nowMs);
    this.currentState = next;
    this.enteredAtMs = nowMs;
    this.states[next].onEnter?.(this.context, nowMs);
  }

  update(nowMs: number): void {
    const elapsed = nowMs - this.enteredAtMs;
    const next = this.states[this.currentState].onUpdate(
      this.context,
      nowMs,
      elapsed,
    );
    if (next && next !== this.currentState) this.transition(next as S, nowMs);
  }
}

const KITE_MIN_RATIO = 0.6;

function shouldFlee(context: EnemyContext): boolean {
  return (
    context.definition.fleeHealthRatio > 0 &&
    context.healthRatio() <= context.definition.fleeHealthRatio
  );
}

function buildStates(
  behavior: EnemyBehavior,
): Readonly<Record<EnemyState, StateDefinition<EnemyContext>>> {
  const chases = behavior !== "stationary_turret";

  return {
    idle: {
      onEnter: (context) => context.halt(),
      onUpdate: (context) => {
        if (!context.hasTarget()) return null;
        return context.distanceToTarget() <= context.definition.aggroRange
          ? "aggro"
          : null;
      },
    },

    aggro: {
      onUpdate: (context, nowMs) => {
        if (!context.hasTarget()) return "idle";
        const distance = context.distanceToTarget();
        const { aggroRange, attackRange } = context.definition;

        if (distance > aggroRange * 1.6) return "idle";
        if (shouldFlee(context)) return "flee";

        if (behavior === "ranged_kiter") {
          if (distance < attackRange * KITE_MIN_RATIO)
            context.moveAway(1, nowMs);
          else if (distance > attackRange) context.moveToward(1, nowMs);
          else context.strafe(0.7, nowMs);
        } else if (chases) {
          if (distance > attackRange) context.moveToward(1, nowMs);
          else context.halt();
        } else {
          context.halt();
        }

        context.faceTarget();
        return distance <= attackRange && context.hasLineOfSight()
          ? "attack"
          : null;
      },
    },

    attack: {
      onEnter: (context) => {
        context.halt();
        context.faceTarget();
        context.beginTelegraph(context.definition.attackWindupMs);
      },
      onUpdate: (context, nowMs, elapsed) => {
        const { attackWindupMs, attackActiveMs } = context.definition;
        if (elapsed < attackWindupMs) return null;
        if (elapsed < attackWindupMs + attackActiveMs) {
          context.executeAttack(nowMs);
          return null;
        }
        return "recover";
      },
    },

    recover: {
      onUpdate: (context, _nowMs, elapsed) => {
        if (elapsed < context.definition.attackRecoveryMs) return null;
        if (shouldFlee(context)) return "flee";
        return context.hasTarget() ? "aggro" : "idle";
      },
    },

    flee: {
      onUpdate: (context, nowMs, elapsed) => {
        if (!context.hasTarget()) return "idle";
        context.moveAway(1.15, nowMs);
        if (elapsed > 1400 || !shouldFlee(context)) return "aggro";
        return null;
      },
    },
  };
}

const cache = new Map<
  EnemyBehavior,
  Readonly<Record<EnemyState, StateDefinition<EnemyContext>>>
>();

/** State tables are stateless and behavior-scoped, so one table is shared by all enemies of a behavior. */
export function getEnemyStates(
  behavior: EnemyBehavior,
): Readonly<Record<EnemyState, StateDefinition<EnemyContext>>> {
  let states = cache.get(behavior);
  if (!states) {
    states = buildStates(behavior);
    cache.set(behavior, states);
  }
  return states;
}
