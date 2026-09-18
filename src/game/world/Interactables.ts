import Phaser from 'phaser';
import { DEPTH, TILE_SIZE, TUNING } from '../core/GameConfig';
import { EventBus } from '../core/EventBus';
import { TextureKeys } from '../core/TextureFactory';
import type { Direction, WeightedEntry } from '../core/types';

export type PickupKind = 'coin' | 'potion' | 'weapon';

const TEXTURE_BY_KIND: Readonly<Record<PickupKind, string>> = {
  coin: TextureKeys.coin,
  potion: TextureKeys.pickup,
  weapon: TextureKeys.pickup,
};

/** Pooled like Hitbox/Projectile: the scene owns a Group of these and calls activate()/deactivate(). */
export class Pickup extends Phaser.Physics.Arcade.Sprite {
  kind: PickupKind = 'coin';
  payloadId = '';
  amount = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TextureKeys.coin);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.decor);
    this.setActive(false).setVisible(false);
  }

  activate(kind: PickupKind, payloadId: string, amount: number, tint: number): void {
    this.kind = kind;
    this.payloadId = payloadId;
    this.amount = amount;

    this.setTexture(TEXTURE_BY_KIND[kind]);
    this.setTint(tint);
    this.setScale(kind === 'weapon' ? 1.3 : 1);
    this.setAlpha(1);
    this.setActive(true).setVisible(true);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setAllowGravity(false);
    body.reset(this.x, this.y);

    const angle = Math.random() * Math.PI * 2;
    body.setVelocity(Math.cos(angle) * 40, Math.sin(angle) * 40);
    body.setDamping(true);
    body.setDrag(0.0005, 0.0005);

    this.scene.tweens.add({
      targets: this,
      y: this.y - 3,
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Player collected it: shrink out, then return to the pool. */
  collect(): void {
    this.scene.tweens.killTweensOf(this);
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: this.scaleX * 1.6,
      duration: 120,
      onComplete: () => this.deactivate(),
    });
  }

  /** Room teardown, or the end of the collect() tween: return to the pool immediately, no animation. */
  deactivate(): void {
    this.scene.tweens.killTweensOf(this);
    this.setActive(false).setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    body.stop();
  }
}

export interface Interactable {
  readonly x: number;
  readonly y: number;
  readonly promptLabel: string;
  canInteract(): boolean;
  interact(): void;
  destroy(): void;
}

export class Chest implements Interactable {
  private readonly sprite: Phaser.GameObjects.Image;
  private opened = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly id: string,
    readonly overrideLootTable: ReadonlyArray<WeightedEntry> | null,
    private readonly onOpen: (chest: Chest) => void,
  ) {
    this.sprite = scene.add.image(x, y, TextureKeys.chest).setDepth(DEPTH.decor);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get promptLabel(): string {
    return 'Open chest';
  }

  canInteract(): boolean {
    return !this.opened;
  }

  interact(): void {
    if (this.opened) return;
    this.opened = true;
    this.sprite.setTexture(TextureKeys.chestOpen);
    this.onOpen(this);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

export class Lever implements Interactable {
  private readonly sprite: Phaser.GameObjects.Image;
  private on = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly channel: string,
    private readonly onToggle: (channel: string, on: boolean) => void,
  ) {
    this.sprite = scene.add.image(x, y, TextureKeys.lever).setDepth(DEPTH.decor);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get promptLabel(): string {
    return this.on ? 'Reset lever' : 'Pull lever';
  }

  canInteract(): boolean {
    return true;
  }

  interact(): void {
    this.on = !this.on;
    this.sprite.setTexture(this.on ? TextureKeys.leverOn : TextureKeys.lever);
    this.onToggle(this.channel, this.on);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

/** Physical blocker on an exit. Opens when its room clears or its lever channel fires. */
export class Door {
  private readonly sprite: Phaser.Physics.Arcade.Sprite;
  private locked: boolean;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    readonly direction: Direction,
    readonly targetRoomId: string,
    locked: boolean,
    readonly requiresChannel: string | null,
  ) {
    this.locked = locked;
    this.sprite = scene.physics.add.sprite(x, y, TextureKeys.door).setDepth(DEPTH.walls);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(TILE_SIZE, TILE_SIZE, true);
    this.applyState(true);
  }

  get gameObject(): Phaser.Physics.Arcade.Sprite {
    return this.sprite;
  }

  get isLocked(): boolean {
    return this.locked;
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  setLocked(locked: boolean): void {
    if (this.locked === locked) return;
    this.locked = locked;
    this.applyState(false);
    if (!locked) EventBus.emit('ui:toast', { message: 'A door opens', tone: 'info' });
  }

  private applyState(immediate: boolean): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.enable = this.locked;
    if (immediate) {
      this.sprite.setVisible(this.locked).setAlpha(this.locked ? 1 : 0);
      return;
    }
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: this.locked ? 1 : 0,
      duration: TUNING.world.doorOpenMs,
      onStart: () => this.sprite.setVisible(true),
      onComplete: () => this.sprite.setVisible(this.locked),
    });
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
