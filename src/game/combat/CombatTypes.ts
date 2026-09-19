import type Phaser from "phaser";
import type { Entity } from "../entities/Entity";
import type { Faction } from "../core/types";

export interface HitboxSpec {
  readonly x: number;
  readonly y: number;
  readonly dirX: number;
  readonly dirY: number;
  readonly width: number;
  readonly height: number;
  readonly offset: number;
  readonly durationMs: number;
  readonly damage: number;
  readonly knockback: number;
  readonly faction: Faction;
  readonly abilityEffectId: string;
  readonly owner: Entity | null;
  readonly texture?: string;
  readonly tint?: number;
  readonly followOwner?: boolean;
  readonly maxTargets?: number;
}

export interface ProjectileSpec {
  readonly x: number;
  readonly y: number;
  readonly dirX: number;
  readonly dirY: number;
  readonly speed: number;
  readonly damage: number;
  readonly knockback: number;
  readonly faction: Faction;
  readonly abilityEffectId: string;
  readonly owner: Entity | null;
  readonly lifetimeMs: number;
  readonly tint: number;
  readonly scale: number;
  readonly piercing: boolean;
}

/** Everything a weapon needs to act on the world without knowing about scenes or pools. */
export interface AttackContext {
  readonly scene: Phaser.Scene;
  readonly owner: Entity;
  readonly nowMs: number;
  spawnHitbox(spec: HitboxSpec): void;
  spawnProjectile(spec: ProjectileSpec): void;
  shake(intensity: number, durationMs: number): void;
}
