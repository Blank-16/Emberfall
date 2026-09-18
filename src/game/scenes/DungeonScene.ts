import Phaser from 'phaser';
import { SceneKeys } from '../core/SceneKeys';
import { TUNING } from '../core/GameConfig';
import { EventBus } from '../core/EventBus';
import { GameBridge } from '../core/GameBridge';
import { generateTileset } from '../core/TextureFactory';
import { Rng } from '../core/Rng';
import { RunState } from '../core/RunState';
import { wireSharedPlayerCommands } from '../core/SharedSceneCommands';
import { GameData } from '../data/GameData';
import { CombatSystem } from '../combat/CombatSystem';
import type { Projectile } from '../combat/Hitbox';
import { createWeapon } from '../combat/weapons/WeaponFactory';
import { InputManager } from '../input/InputManager';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { Dungeon } from '../world/Dungeon';
import { Room, type RoomServices } from '../world/Room';
import { Pickup, type PickupKind } from '../world/Interactables';
import type { Direction } from '../core/types';

type ReturnReason = 'death' | 'cleared' | 'manual';

const PICKUP_POOL_SIZE = 96;

export class DungeonScene extends Phaser.Scene {
  private dungeonId = '';
  private dungeon!: Dungeon;
  private rng!: Rng;
  private combat!: CombatSystem;
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private pickupGroup!: Phaser.Physics.Arcade.Group;
  private inputManager!: InputManager;
  private player!: Player;

  private currentRoom: Room | null = null;
  private currentRoomId = '';
  private lastMainPathIndex = 0;
  private roomColliders: Phaser.Physics.Arcade.Collider[] = [];
  private disposers: Array<() => void> = [];
  private transitioning = false;
  private leavingScene = false;

  /** Reused every frame instead of allocating [player, ...enemies] on each update tick. */
  private readonly combatTargetsScratch: Array<Player | Enemy> = [];

  constructor() {
    super(SceneKeys.Dungeon);
  }

  init(data: { dungeonId: string }): void {
    this.dungeonId = data.dungeonId;
    this.currentRoom = null;
    this.currentRoomId = '';
    this.lastMainPathIndex = 0;
    this.roomColliders = [];
    this.disposers = [];
    this.transitioning = false;
    this.leavingScene = false;
    this.combatTargetsScratch.length = 0;
  }

  preload(): void {
    const definition = GameData.dungeon(this.dungeonId);
    for (const room of definition.rooms) {
      this.load.tilemapTiledJSON(room.tiledMapKey, `/maps/${room.tiledMapKey}.json`);
    }
  }

  create(): void {
    const definition = GameData.dungeon(this.dungeonId);
    this.dungeon = new Dungeon(definition);
    generateTileset(this, definition.id, definition.palette);

    this.rng = new Rng();
    this.combat = new CombatSystem(this, this.rng);
    this.enemyGroup = this.physics.add.group();
    this.pickupGroup = this.physics.add.group({ classType: Pickup, maxSize: PICKUP_POOL_SIZE, runChildUpdate: false });
    this.inputManager = new InputManager(this);

    this.player = new Player(this, 0, 0, RunState.loadout, RunState.inventory, this.combat, GameData.potions);
    this.player.spawnFresh(0, 0);
    this.combat.registerTarget(this.player);

    this.cameras.main.startFollow(this.player, true, TUNING.world.cameraLerp, TUNING.world.cameraLerp);
    this.enterRoom(this.dungeon.entryRoomId, null);

    this.disposers.push(
      ...wireSharedPlayerCommands(this, this.player),
      GameBridge.on('command:swap-weapon', () => this.player.trySwapWeapon(this.time.now)),
      GameBridge.on('command:return-hub', ({ reason }) => this.returnToHub(reason)),
      EventBus.on('player:died', () => {
        this.player.setInputLocked(true);
        this.time.delayedCall(1400, () => this.returnToHub('death'));
      }),
      EventBus.on('boss:defeated', () => {
        if (this.currentRoomId === this.dungeon.bossRoomId) this.handleDungeonCleared();
      }),
    );

    EventBus.emit('game:scene-changed', { scene: SceneKeys.Dungeon });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  override update(time: number, delta: number): void {
    if (this.leavingScene) return;

    const snapshot = this.inputManager.update(time, this.player.x, this.player.y);
    this.player.handleInput(snapshot, time);
    this.player.tick(time, delta);

    this.combatTargetsScratch.length = 0;
    this.combatTargetsScratch.push(this.player);
    for (const child of this.enemyGroup.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active) continue;
      enemy.tick(time, delta);
      this.combatTargetsScratch.push(enemy);
    }

    this.combat.update(time);
    this.currentRoom?.update(time, this.combatTargetsScratch);
    this.currentRoom?.collectPickupsNear(this.player);

    const interactable = this.currentRoom?.nearestInteractable(this.player) ?? null;
    EventBus.emit('ui:interact-prompt', { label: interactable?.promptLabel ?? null });
    if (snapshot.interactPressed) interactable?.interact();

    if (snapshot.pausePressed) GameBridge.pauseGame(!this.physics.world.isPaused);
  }

  private enterRoom(roomId: string, fromDirection: Direction | null): void {
    this.currentRoom?.destroy();

    const roomDefinition = this.dungeon.room(roomId);
    const services: RoomServices = {
      scene: this,
      rng: this.rng,
      player: this.player,
      spawnEnemy: (enemyId, x, y) => this.createEnemy(enemyId, x, y),
      spawnBoss: (bossId, x, y) => this.createBoss(bossId, x, y),
      unregisterEnemy: (enemy) => this.combat.unregisterTarget(enemy),
      spawnPickup: (kind, payloadId, amount, tint, x, y) => this.spawnPickup(kind, payloadId, amount, tint, x, y),
      requestTransition: (direction, targetRoomId) => this.beginTransition(direction, targetRoomId),
      onPickupCollected: (pickup) => this.handlePickup(pickup),
    };

    const room = new Room(roomDefinition, this.dungeon.definition, services);
    room.build();
    this.currentRoom = room;
    this.currentRoomId = roomId;
    this.registry.set('currentRoomId', roomId);

    const spawnPoint = fromDirection ? room.entryPointFrom(fromDirection) : room.spawnPoint;
    this.player.teleport(spawnPoint.x, spawnPoint.y);

    this.wireRoomColliders(room);

    this.cameras.main.stopFollow();
    this.cameras.main.centerOn(spawnPoint.x, spawnPoint.y);
    this.cameras.main.startFollow(this.player, true, TUNING.world.cameraLerp, TUNING.world.cameraLerp);

    this.time.delayedCall(200, () => room.armTransitions());

    const mainPathIndex = this.dungeon.mainPathIndex(roomId);
    if (mainPathIndex >= 0) this.lastMainPathIndex = mainPathIndex;
    EventBus.emit('room:entered', {
      roomId,
      locked: !room.cleared,
      index: this.lastMainPathIndex,
      total: this.dungeon.mainPathRoomCount,
    });
  }

  private wireRoomColliders(room: Room): void {
    for (const collider of this.roomColliders) collider.destroy();
    this.roomColliders = [];

    const wallLayer = room.collisionLayer;
    if (wallLayer) {
      this.roomColliders.push(
        this.physics.add.collider(this.player, wallLayer),
        this.physics.add.collider(this.enemyGroup, wallLayer),
        this.physics.add.collider(this.combat.projectileGroup, wallLayer, (obj) => {
          this.combat.onProjectileHitWall(obj as Projectile);
        }),
      );
    }

    const doors = room.doorColliders;
    if (doors.length > 0) this.roomColliders.push(this.physics.add.collider(this.player, doors));
  }

  private beginTransition(direction: Direction, targetRoomId: string): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player.setInputLocked(true);

    this.cameras.main.fadeOut(TUNING.world.roomTransitionMs, 10, 8, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.enterRoom(targetRoomId, direction);
      this.player.setInputLocked(false);
      this.cameras.main.fadeIn(TUNING.world.roomTransitionMs, 10, 8, 18);
      this.transitioning = false;
    });
  }

  private createEnemy(enemyId: string, x: number, y: number): Enemy {
    const definition = GameData.enemy(enemyId);
    const enemy = new Enemy(this, x, y, definition, this.combat);
    enemy.setTarget(this.player);
    this.enemyGroup.add(enemy);
    this.combat.registerTarget(enemy);
    return enemy;
  }

  private createBoss(bossId: string, x: number, y: number): Boss {
    const definition = GameData.boss(bossId);
    const boss = new Boss(this, x, y, definition, this.combat, this.rng, (summonId, sx, sy) => {
      const summoned = this.createEnemy(summonId, sx, sy);
      this.currentRoom?.trackEnemy(summoned);
    });
    boss.setTarget(this.player);
    this.enemyGroup.add(boss);
    this.combat.registerTarget(boss);
    return boss;
  }

  private spawnPickup(
    kind: PickupKind,
    payloadId: string,
    amount: number,
    tint: number,
    x: number,
    y: number,
  ): Pickup | null {
    const pickup = this.pickupGroup.get(x, y) as Pickup | null;
    if (!pickup) return null;
    pickup.activate(kind, payloadId, amount, tint);
    return pickup;
  }

  private handlePickup(pickup: Pickup): void {
    if (pickup.kind === 'coin') {
      RunState.inventory.addCurrency(pickup.amount);
      return;
    }
    if (GameData.isPotion(pickup.payloadId)) {
      if (!RunState.inventory.addPotion(pickup.payloadId, pickup.amount)) {
        EventBus.emit('ui:toast', { message: 'Potion pouch full', tone: 'warn' });
      }
      return;
    }

    const weaponStats = GameData.weapons.get(pickup.payloadId);
    if (!weaponStats) {
      EventBus.emit('ui:toast', { message: 'Found something unidentifiable', tone: 'warn' });
      return;
    }
    RunState.loadout.equip(RunState.loadout.slot === 0 ? 1 : 0, createWeapon(weaponStats));
    EventBus.emit('ui:toast', { message: `Equipped ${weaponStats.displayName}`, tone: 'reward' });
  }

  private handleDungeonCleared(): void {
    const reward = 40 + this.rng.intRange(0, 20);
    RunState.inventory.addCurrency(reward);
    EventBus.emit('ui:toast', { message: `Dungeon cleared! +${reward} embers`, tone: 'reward' });
    EventBus.emit('dungeon:cleared', { dungeonId: this.dungeon.id, currency: RunState.inventory.currency });
    this.time.delayedCall(1800, () => this.returnToHub('cleared'));
  }

  private returnToHub(_reason: ReturnReason): void {
    if (this.leavingScene) return;
    this.leavingScene = true;
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SceneKeys.Hub);
    });
  }

  private teardown(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
    for (const collider of this.roomColliders) collider.destroy();
    this.roomColliders = [];
    this.currentRoom?.destroy();
    this.currentRoom = null;
    this.combat.releaseAll();
    this.inputManager.destroy();
  }
}
