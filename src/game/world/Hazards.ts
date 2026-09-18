import Phaser from 'phaser';
import { DEPTH, TILE_SIZE, TUNING } from '../core/GameConfig';
import { TextureKeys } from '../core/TextureFactory';
import type { Entity } from '../entities/Entity';

export interface Hazard {
  update(nowMs: number, targets: ReadonlyArray<Entity>): void;
  destroy(): void;
}

/** Retracts and extends on a fixed cycle so it can be timed rather than tanked. */
export class SpikeTrap implements Hazard {
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly bounds: Phaser.Geom.Rectangle;
  private armed = false;
  private readonly phaseOffsetMs: number;

  constructor(scene: Phaser.Scene, x: number, y: number, phaseOffsetMs = 0) {
    this.sprite = scene.add.image(x, y, TextureKeys.spike).setDepth(DEPTH.hazard);
    this.bounds = new Phaser.Geom.Rectangle(x - TILE_SIZE / 2, y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
    this.phaseOffsetMs = phaseOffsetMs;
  }

  update(nowMs: number, targets: ReadonlyArray<Entity>): void {
    const cyclePosition = (nowMs + this.phaseOffsetMs) % TUNING.hazards.spikeCycleMs;
    const shouldBeArmed = cyclePosition < TUNING.hazards.spikeActiveMs;

    if (shouldBeArmed !== this.armed) {
      this.armed = shouldBeArmed;
      this.sprite.setTexture(shouldBeArmed ? TextureKeys.spikeUp : TextureKeys.spike);
    }
    if (!this.armed) return;

    for (const target of targets) {
      if (target.isDead) continue;
      if (!this.bounds.contains(target.x, target.y)) continue;
      target.takeDamage(TUNING.hazards.spikeDamage, nowMs, {
        invulnerabilityMs: TUNING.player.hitInvulnerabilityMs,
        knockbackFrom: { x: this.sprite.x, y: this.sprite.y },
        knockbackForce: 80,
      });
    }
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

/** Continuous damage-over-time zone; ticks on an interval rather than per frame. */
export class FireZone implements Hazard {
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly bounds: Phaser.Geom.Rectangle;
  private nextTickAtMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.add.image(x, y, TextureKeys.fire).setDepth(DEPTH.hazard);
    this.bounds = new Phaser.Geom.Rectangle(x - TILE_SIZE / 2, y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
    scene.tweens.add({
      targets: this.sprite,
      scaleY: 1.2,
      alpha: 0.75,
      duration: 380,
      yoyo: true,
      repeat: -1,
    });
  }

  update(nowMs: number, targets: ReadonlyArray<Entity>): void {
    if (nowMs < this.nextTickAtMs) return;
    let hitSomething = false;

    for (const target of targets) {
      if (target.isDead || !this.bounds.contains(target.x, target.y)) continue;
      target.takeDamage(TUNING.hazards.fireDamage, nowMs, {});
      target.status.apply({ id: 'ignite', kind: 'dot', magnitude: 2, durationMs: 900, tickMs: 450 }, nowMs);
      hitSomething = true;
    }
    if (hitSomething) this.nextTickAtMs = nowMs + TUNING.hazards.fireTickMs;
    else this.nextTickAtMs = nowMs + 100;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
