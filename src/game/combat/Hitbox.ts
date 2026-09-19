import Phaser from "phaser";
import { DEPTH } from "../core/GameConfig";
import type { Entity } from "../entities/Entity";
import type { Faction } from "../core/types";
import type { HitboxSpec, ProjectileSpec } from "./CombatTypes";

export class Hitbox extends Phaser.Physics.Arcade.Sprite {
  faction: Faction = "player";
  damage = 0;
  knockback = 0;
  abilityEffectId = "none";
  owner: Entity | null = null;
  maxTargets = 1;
  expiresAtMs = 0;
  followOwner = false;
  offsetX = 0;
  offsetY = 0;
  readonly hitTargets = new Set<string>();

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "");
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.vfx);
    this.setActive(false).setVisible(false);
  }

  fire(spec: HitboxSpec, nowMs: number): void {
    const angle = Math.atan2(spec.dirY, spec.dirX);
    this.offsetX = Math.cos(angle) * spec.offset;
    this.offsetY = Math.sin(angle) * spec.offset;

    this.faction = spec.faction;
    this.damage = spec.damage;
    this.knockback = spec.knockback;
    this.abilityEffectId = spec.abilityEffectId;
    this.owner = spec.owner;
    this.maxTargets = spec.maxTargets ?? 1;
    this.followOwner = spec.followOwner ?? false;
    this.expiresAtMs = nowMs + spec.durationMs;
    this.hitTargets.clear();

    if (spec.texture) this.setTexture(spec.texture);
    this.setTint(spec.tint ?? 0xffffff);
    this.setRotation(angle);
    this.setPosition(spec.x + this.offsetX, spec.y + this.offsetY);
    this.setDisplaySize(spec.width, spec.height);
    this.setActive(true).setVisible(Boolean(spec.texture));
    this.setAlpha(0.9);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setAllowGravity(false);
    body.setSize(spec.width, spec.height, true);
    body.reset(this.x, this.y);
  }

  syncToOwner(): void {
    if (!this.followOwner || !this.owner) return;
    this.setPosition(this.owner.x + this.offsetX, this.owner.y + this.offsetY);
    (this.body as Phaser.Physics.Arcade.Body).reset(this.x, this.y);
  }

  deactivate(): void {
    this.setActive(false).setVisible(false);
    this.owner = null;
    this.hitTargets.clear();
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    body.stop();
  }
}

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  faction: Faction = "player";
  damage = 0;
  knockback = 0;
  abilityEffectId = "none";
  owner: Entity | null = null;
  piercing = false;
  expiresAtMs = 0;
  readonly hitTargets = new Set<string>();

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.projectile);
    this.setActive(false).setVisible(false);
  }

  fire(spec: ProjectileSpec, nowMs: number): void {
    this.faction = spec.faction;
    this.damage = spec.damage;
    this.knockback = spec.knockback;
    this.abilityEffectId = spec.abilityEffectId;
    this.owner = spec.owner;
    this.piercing = spec.piercing;
    this.expiresAtMs = nowMs + spec.lifetimeMs;
    this.hitTargets.clear();

    this.setTint(spec.tint);
    this.setScale(spec.scale);
    this.setRotation(Math.atan2(spec.dirY, spec.dirX));
    this.setPosition(spec.x, spec.y);
    this.setActive(true).setVisible(true);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setAllowGravity(false);
    body.setCircle(3, this.width / 2 - 3, this.height / 2 - 3);
    body.reset(spec.x, spec.y);
    body.setMaxVelocity(spec.speed, spec.speed);
    body.setVelocity(spec.dirX * spec.speed, spec.dirY * spec.speed);
  }

  deactivate(): void {
    this.setActive(false).setVisible(false);
    this.owner = null;
    this.hitTargets.clear();
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.stop();
    body.enable = false;
  }
}
