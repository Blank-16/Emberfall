import Phaser from 'phaser';
import { Entity } from './Entity';
import { DEPTH } from '../core/GameConfig';
import { EventBus } from '../core/EventBus';
import { TextureKeys } from '../core/TextureFactory';
import type { CombatSystem } from '../combat/CombatSystem';
import type { EnemyDefinition } from '../core/types';
import { getEnemyStates, StateMachine, type EnemyContext, type EnemyState } from '../ai/EnemyStateMachine';
import type { Player } from './Player';

const TEXTURE_BY_BEHAVIOR: Readonly<Record<EnemyDefinition['behavior'], string>> = {
  melee_chaser: TextureKeys.enemy,
  ranged_kiter: TextureKeys.enemyRanged,
  stationary_turret: TextureKeys.enemyTurret,
};

export class Enemy extends Entity implements EnemyContext {
  readonly definition: EnemyDefinition;
  protected target: Player | null = null;
  protected telegraph: Phaser.GameObjects.Image | null = null;
  private machine: StateMachine<EnemyContext, EnemyState>;
  private attackCommittedAtMs = -1;
  private strafeSign = 1;
  private readonly wallSlideSign: number;
  private readonly toTarget = new Phaser.Math.Vector2();
  private readonly steerScratch = new Phaser.Math.Vector2();
  private readonly awayScratch = new Phaser.Math.Vector2();

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    definition: EnemyDefinition,
    protected readonly combat: CombatSystem,
    texture?: string,
  ) {
    super({
      scene,
      x,
      y,
      texture: texture ?? TEXTURE_BY_BEHAVIOR[definition.behavior],
      faction: 'enemy',
      maxHealth: definition.health,
      bodyRadius: definition.bodyRadius,
      tint: definition.tint,
      movement: {
        moveSpeed: definition.moveSpeed,
        acceleration: definition.moveSpeed * 8,
        drag: definition.moveSpeed * 10,
        dashSpeed: definition.moveSpeed * 2,
        dashDurationMs: 0,
        dashCooldownMs: Number.MAX_SAFE_INTEGER,
        knockbackResistance: 0.2,
      },
    });

    this.definition = definition;
    this.machine = new StateMachine<EnemyContext, EnemyState>(this, getEnemyStates(definition.behavior), 'idle');
    this.strafeSign = Math.random() < 0.5 ? -1 : 1;
    this.wallSlideSign = this.strafeSign;
  }

  setTarget(target: Player | null): void {
    this.target = target;
  }

  get aiState(): EnemyState {
    return this.machine.state;
  }

  hasTarget(): boolean {
    return this.target !== null && !this.target.isDead;
  }

  healthRatio(): number {
    return this.health.ratio;
  }

  distanceToTarget(): number {
    if (!this.target) return Number.POSITIVE_INFINITY;
    return Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
  }

  hasLineOfSight(): boolean {
    return true;
  }

  private direction(): Phaser.Math.Vector2 {
    if (!this.target) return this.toTarget.set(0, 0);
    return this.toTarget.set(this.target.x - this.x, this.target.y - this.y).normalize();
  }

  moveToward(speedMultiplier: number, nowMs: number): void {
    const dir = this.steerAroundWalls(this.direction());
    this.movement.moveDirect(dir.x, dir.y, this.effectiveSpeed(speedMultiplier), nowMs);
  }

  moveAway(speedMultiplier: number, nowMs: number): void {
    const dir = this.direction();
    const away = this.awayScratch.set(-dir.x, -dir.y);
    const steered = this.steerAroundWalls(away);
    this.movement.moveDirect(steered.x, steered.y, this.effectiveSpeed(speedMultiplier), nowMs);
  }

  /**
   * Not pathfinding: a bounded mitigation for the case where the direct line to the target
   * is blocked by a wall (e.g. a pillar or a concave room corner). Arcade's own body.blocked
   * flags (set after the last collision resolution) tell us which axis is obstructed; we blend
   * in a perpendicular component, biased by a fixed per-entity handedness so the enemy slides
   * consistently along the obstruction instead of jittering, and keep whatever fraction of the
   * original direction is still open so it still makes progress toward the target.
   */
  private steerAroundWalls(dir: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const blocked = this.arcadeBody.blocked;
    const blockedX = (dir.x < 0 && blocked.left) || (dir.x > 0 && blocked.right);
    const blockedY = (dir.y < 0 && blocked.up) || (dir.y > 0 && blocked.down);
    if (!blockedX && !blockedY) return dir;

    const openX = blockedX ? 0 : dir.x;
    const openY = blockedY ? 0 : dir.y;
    const perpX = -dir.y * this.wallSlideSign;
    const perpY = dir.x * this.wallSlideSign;

    this.steerScratch.set(openX + perpX * 0.8, openY + perpY * 0.8);
    if (this.steerScratch.lengthSq() < 0.0001) this.steerScratch.set(perpX, perpY);
    return this.steerScratch.normalize();
  }

  strafe(speedMultiplier: number, nowMs: number): void {
    const dir = this.direction();
    this.movement.moveDirect(-dir.y * this.strafeSign, dir.x * this.strafeSign, this.effectiveSpeed(speedMultiplier), nowMs);
  }

  faceTarget(): void {
    const dir = this.direction();
    if (dir.lengthSq() > 0) this.setFlipX(dir.x < 0);
  }

  halt(): void {
    this.movement.stop();
  }

  private effectiveSpeed(multiplier: number): number {
    return this.definition.moveSpeed * multiplier * this.status.speedMultiplier;
  }

  beginTelegraph(durationMs: number): void {
    this.attackCommittedAtMs = -1;
    this.telegraph ??= this.scene.add
      .image(this.x, this.y, TextureKeys.telegraph)
      .setDepth(DEPTH.hazard)
      .setVisible(false);

    const scale = (this.definition.attackRange * 2) / 64;
    this.telegraph.setPosition(this.x, this.y).setScale(scale).setAlpha(0.15).setVisible(true);
    this.telegraph.setTint(0xff6b6b);
    this.scene.tweens.add({
      targets: this.telegraph,
      alpha: 0.5,
      duration: durationMs,
      onComplete: () => this.telegraph?.setVisible(false),
    });
  }

  executeAttack(nowMs: number): void {
    if (this.attackCommittedAtMs >= 0) return;
    this.attackCommittedAtMs = nowMs;
    this.telegraph?.setVisible(false);

    const dir = this.direction();
    if (this.definition.behavior === 'melee_chaser') {
      this.combat.spawnHitbox({
        x: this.x,
        y: this.y,
        dirX: dir.x,
        dirY: dir.y,
        width: this.definition.attackRange,
        height: this.definition.attackRange * 0.9,
        offset: this.definition.attackRange * 0.5,
        durationMs: this.definition.attackActiveMs,
        damage: this.definition.damage,
        knockback: 130,
        faction: 'enemy',
        abilityEffectId: 'none',
        owner: this,
        texture: TextureKeys.slash,
        tint: 0xff8080,
        followOwner: true,
        maxTargets: 1,
      });
    } else {
      this.combat.spawnProjectile({
        x: this.x + dir.x * 8,
        y: this.y + dir.y * 8,
        dirX: dir.x,
        dirY: dir.y,
        speed: this.definition.projectileSpeed ?? 150,
        damage: this.definition.damage,
        knockback: 90,
        faction: 'enemy',
        abilityEffectId: 'none',
        owner: this,
        lifetimeMs: 2200,
        tint: 0xff9a5c,
        scale: 1,
        piercing: false,
      });
    }
  }

  protected override onTick(nowMs: number, _deltaMs: number): void {
    this.machine.update(nowMs);
    this.setDepth(DEPTH.entity + this.y * 0.001);
  }

  protected override onDeath(): void {
    this.telegraph?.destroy();
    this.telegraph = null;
    this.combat.spawnBurst(this.x, this.y, this.definition.tint, 10);
    EventBus.emit('enemy:died', { enemyId: this.definition.id, x: this.x, y: this.y });

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0.6,
      duration: 180,
      onComplete: () => this.setVisible(false).setActive(false),
    });
  }

  override destroy(fromScene?: boolean): void {
    this.telegraph?.destroy();
    super.destroy(fromScene);
  }
}
