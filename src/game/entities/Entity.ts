import Phaser from 'phaser';
import { DEPTH, TUNING } from '../core/GameConfig';
import type { Faction } from '../core/types';
import { HealthComponent } from './components/HealthComponent';
import { StatusComponent } from './components/StatusComponent';
import { MovementComponent, type MovementConfig } from './components/MovementComponent';

export interface EntityOptions {
  readonly scene: Phaser.Scene;
  readonly x: number;
  readonly y: number;
  readonly texture: string;
  readonly faction: Faction;
  readonly maxHealth: number;
  readonly bodyRadius: number;
  readonly movement: MovementConfig;
  readonly tint?: number;
}

export interface DamageOptions {
  readonly knockbackFrom?: { x: number; y: number };
  readonly knockbackForce?: number;
  readonly critical?: boolean;
  readonly invulnerabilityMs?: number;
}

let nextEntityId = 1;

export abstract class Entity extends Phaser.Physics.Arcade.Sprite {
  readonly entityId: string;
  readonly faction: Faction;
  readonly health: HealthComponent;
  readonly status: StatusComponent;
  readonly movement: MovementComponent;

  private flashTween: Phaser.Tweens.Tween | null = null;
  private readonly baseTint: number;
  protected dead = false;

  protected constructor(options: EntityOptions) {
    super(options.scene, options.x, options.y, options.texture);
    this.entityId = `${options.faction}-${nextEntityId}`;
    nextEntityId += 1;
    this.faction = options.faction;
    this.baseTint = options.tint ?? 0xffffff;

    options.scene.add.existing(this);
    options.scene.physics.add.existing(this);
    this.setDepth(DEPTH.entity);
    this.setTint(this.baseTint);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(options.bodyRadius, this.width / 2 - options.bodyRadius, this.height / 2 - options.bodyRadius);
    body.setCollideWorldBounds(false);

    this.health = new HealthComponent(
      options.maxHealth,
      (current, max) => this.onHealthChanged(current, max),
      () => this.handleDeath(),
    );
    this.status = new StatusComponent((damage) => {
      this.health.damage(damage, this.scene.time.now, 0);
    });
    this.movement = new MovementComponent(body, options.movement);
  }

  get isDead(): boolean {
    return this.dead;
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  takeDamage(amount: number, nowMs: number, options: DamageOptions = {}): number {
    if (this.dead) return 0;
    const scaled = amount * this.status.incomingMultiplier;
    const result = this.health.damage(scaled, nowMs, options.invulnerabilityMs ?? 0);
    if (result.blocked) return 0;

    this.playHitFlash();
    if (options.knockbackFrom && options.knockbackForce) {
      this.movement.applyKnockback(
        options.knockbackFrom.x,
        options.knockbackFrom.y,
        options.knockbackForce,
        nowMs,
      );
    }
    this.onDamaged(result.applied, options.critical === true);
    return result.applied;
  }

  protected playHitFlash(): void {
    this.flashTween?.stop();
    this.setTintFill(0xffffff);
    this.flashTween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: TUNING.combat.hitFlashMs,
      onComplete: () => {
        this.clearTint();
        this.setTint(this.baseTint);
      },
    });
  }

  protected handleDeath(): void {
    if (this.dead) return;
    this.dead = true;
    this.movement.stop();
    this.arcadeBody.enable = false;
    this.onDeath();
  }

  tick(nowMs: number, deltaMs: number): void {
    if (this.dead) return;
    this.status.update(nowMs);
    this.onTick(nowMs, deltaMs);
  }

  protected onHealthChanged(_current: number, _max: number): void {}
  protected onDamaged(_amount: number, _critical: boolean): void {}
  protected abstract onDeath(): void;
  protected abstract onTick(nowMs: number, deltaMs: number): void;
}
