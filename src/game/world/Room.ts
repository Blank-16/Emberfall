import Phaser from "phaser";
import { DEPTH, TILE_SIZE, TUNING } from "../core/GameConfig";
import { EventBus } from "../core/EventBus";
import { tilesetKeyFor } from "../core/TextureFactory";
import type { Rng } from "../core/Rng";
import type {
  Direction,
  DungeonDefinition,
  RoomDefinition,
  WeightedEntry,
} from "../core/types";
import type { Enemy } from "../entities/Enemy";
import type { Boss } from "../entities/Boss";
import type { Player } from "../entities/Player";
import { rollLoot } from "../items/LootTable";
import { GameData } from "../data/GameData";
import { FireZone, SpikeTrap, type Hazard } from "./Hazards";
import {
  Chest,
  Door,
  Lever,
  type Interactable,
  type Pickup,
  type PickupKind,
} from "./Interactables";

export interface RoomServices {
  readonly scene: Phaser.Scene;
  readonly rng: Rng;
  readonly player: Player;
  spawnEnemy(enemyId: string, x: number, y: number): Enemy;
  spawnBoss(bossId: string, x: number, y: number): Boss;
  unregisterEnemy(enemy: Enemy): void;
  spawnPickup(
    kind: PickupKind,
    payloadId: string,
    amount: number,
    tint: number,
    x: number,
    y: number,
  ): Pickup | null;
  requestTransition(direction: Direction, targetRoomId: string): void;
  onPickupCollected(pickup: Pickup): void;
}

interface TiledProperty {
  name: string;
  value: string | number | boolean;
}

interface TiledObject {
  type?: string;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: TiledProperty[];
}

interface ExitTrigger {
  readonly direction: Direction;
  readonly targetRoomId: string;
  readonly bounds: Phaser.Geom.Rectangle;
}

const EXIT_PUSH_PX = 10;

function readProperty(
  object: TiledObject,
  name: string,
): string | number | boolean | undefined {
  return object.properties?.find((property) => property.name === name)?.value;
}

/** Chest override tables are authored data too -- a bad itemId should fail loudly at room load, not silently drop loot. */
function parseChestLootTable(
  roomId: string,
  chestId: string,
  raw: string | number | boolean | undefined,
): ReadonlyArray<WeightedEntry> | null {
  if (raw == null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw));
  } catch (error) {
    throw new Error(
      `${roomId}/${chestId}: lootTable property is not valid JSON (${String(error)})`,
    );
  }
  if (!Array.isArray(parsed))
    throw new Error(
      `${roomId}/${chestId}: lootTable property must be an array`,
    );

  for (const entry of parsed as unknown[]) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as { itemId?: unknown }).itemId !== "string" ||
      typeof (entry as { weight?: unknown }).weight !== "number"
    ) {
      throw new Error(
        `${roomId}/${chestId}: lootTable entry must be {itemId: string, weight: number}`,
      );
    }
    const itemId = (entry as { itemId: string }).itemId;
    if (
      itemId !== "none" &&
      !GameData.isPotion(itemId) &&
      !GameData.weapons.has(itemId)
    ) {
      throw new Error(
        `${roomId}/${chestId}: lootTable references unknown item '${itemId}'`,
      );
    }
  }
  return parsed as ReadonlyArray<WeightedEntry>;
}

export class Room {
  private map: Phaser.Tilemaps.Tilemap | null = null;
  private wallLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private readonly enemies: Enemy[] = [];
  private readonly doors: Door[] = [];
  private readonly hazards: Hazard[] = [];
  private readonly interactables: Interactable[] = [];
  private readonly pickups: Pickup[] = [];
  private readonly exits: ExitTrigger[] = [];
  private readonly processedDeaths = new Set<string>();
  private readonly leverChannels = new Set<string>();
  private playerStart: Phaser.Math.Vector2 | null = null;
  private clearedInternal = false;
  private transitionArmed = false;
  private boss: Boss | null = null;

  constructor(
    readonly definition: RoomDefinition,
    private readonly dungeon: DungeonDefinition,
    private readonly services: RoomServices,
  ) {}

  get cleared(): boolean {
    return this.clearedInternal;
  }

  get collisionLayer(): Phaser.Tilemaps.TilemapLayer | null {
    return this.wallLayer;
  }

  get spawnPoint(): Phaser.Math.Vector2 {
    return (
      this.playerStart ?? new Phaser.Math.Vector2(TILE_SIZE * 4, TILE_SIZE * 4)
    );
  }

  get bossInstance(): Boss | null {
    return this.boss;
  }

  get liveEnemies(): ReadonlyArray<Enemy> {
    return this.enemies;
  }

  build(): void {
    const scene = this.services.scene;
    const map = scene.make.tilemap({ key: this.definition.tiledMapKey });
    const tileset = map.addTilesetImage(
      "base",
      tilesetKeyFor(this.dungeon.id),
      TILE_SIZE,
      TILE_SIZE,
      0,
      0,
    );
    if (!tileset)
      throw new Error(`${this.definition.id}: tileset not registered`);

    const ground = map.createLayer("ground", tileset, 0, 0);
    const walls = map.createLayer("walls", tileset, 0, 0);
    if (!ground || !walls)
      throw new Error(`${this.definition.id}: missing tile layers`);

    ground.setDepth(DEPTH.floor);
    walls.setDepth(DEPTH.walls);
    walls.setCollisionByExclusion([-1, 0]);

    this.map = map;
    this.wallLayer = walls;

    this.spawnObjects(map);
    this.spawnDefinitionEnemies();

    if (this.enemies.length === 0 && !this.boss) this.markCleared(true);

    scene.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    scene.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
  }

  private spawnObjects(map: Phaser.Tilemaps.Tilemap): void {
    const objects = (map.getObjectLayer("objects")?.objects ??
      []) as TiledObject[];
    const scene = this.services.scene;

    for (const object of objects) {
      const centerX = object.x + object.width / 2;
      const centerY = object.y + object.height / 2;
      const id = String(readProperty(object, "id") ?? "");

      switch (object.type) {
        case "player_start":
          this.playerStart = new Phaser.Math.Vector2(centerX, centerY);
          break;
        case "enemy":
          this.enemies.push(this.services.spawnEnemy(id, centerX, centerY));
          break;
        case "boss": {
          const boss = this.services.spawnBoss(id, centerX, centerY);
          this.boss = boss;
          this.enemies.push(boss);
          break;
        }
        case "chest": {
          const overrideTable = parseChestLootTable(
            this.definition.id,
            id,
            readProperty(object, "lootTable"),
          );
          this.interactables.push(
            new Chest(scene, centerX, centerY, id, overrideTable, (chest) =>
              this.openChest(chest),
            ),
          );
          break;
        }
        case "lever":
          this.interactables.push(
            new Lever(scene, centerX, centerY, id, (channel, on) =>
              this.onLeverToggled(channel, on),
            ),
          );
          break;
        case "hazard_spike":
          this.hazards.push(
            new SpikeTrap(
              scene,
              centerX,
              centerY,
              Number(readProperty(object, "phase") ?? 0),
            ),
          );
          break;
        case "hazard_fire":
          this.hazards.push(new FireZone(scene, centerX, centerY));
          break;
        case "door": {
          const direction = String(
            readProperty(object, "direction") ?? "n",
          ) as Direction;
          const target = String(readProperty(object, "target") ?? "");
          const locked = Boolean(readProperty(object, "locked"));
          const channel = readProperty(object, "channel");
          this.doors.push(
            new Door(
              scene,
              centerX,
              centerY,
              direction,
              target,
              locked,
              channel != null ? String(channel) : null,
            ),
          );
          break;
        }
        case "exit": {
          const direction = String(
            readProperty(object, "direction") ?? "n",
          ) as Direction;
          const target = String(readProperty(object, "target") ?? "");
          this.exits.push({
            direction,
            targetRoomId: target,
            bounds: new Phaser.Geom.Rectangle(
              object.x - 4,
              object.y - 4,
              object.width + 8,
              object.height + 8,
            ),
          });
          break;
        }
        default:
          break;
      }
    }
  }

  /** Data-defined spawns supplement the Tiled object layer, which stays authoritative for placement. */
  private spawnDefinitionEnemies(): void {
    for (const spawn of this.definition.enemySpawns) {
      this.enemies.push(
        this.services.spawnEnemy(spawn.enemyType, spawn.x, spawn.y),
      );
    }
  }

  armTransitions(): void {
    this.transitionArmed = true;
  }

  update(nowMs: number, targets: ReadonlyArray<Player | Enemy>): void {
    for (const hazard of this.hazards) hazard.update(nowMs, targets);
    this.collectDeaths();
    this.checkExits();
  }

  private collectDeaths(): void {
    if (this.enemies.length === 0) return;
    let alive = 0;

    for (const enemy of this.enemies) {
      if (!enemy.isDead) {
        alive += 1;
        continue;
      }
      if (this.processedDeaths.has(enemy.entityId)) continue;
      this.processedDeaths.add(enemy.entityId);
      this.dropEnemyLoot(enemy);
    }

    // Boss rooms clear the instant the boss dies; leftover summons don't gate progress.
    const clearedNow = this.boss ? this.boss.isDead : alive === 0;
    if (clearedNow && !this.clearedInternal) this.markCleared(false);
  }

  /** Registers an enemy spawned mid-fight (e.g. a boss summon) so it drops loot and gets torn down. */
  trackEnemy(enemy: Enemy): void {
    this.enemies.push(enemy);
  }

  private dropEnemyLoot(enemy: Enemy): void {
    const itemId = rollLoot(enemy.definition.dropTable, this.services.rng);
    if (itemId && itemId !== "none" && GameData.isPotion(itemId)) {
      this.spawnPickup("potion", itemId, enemy.x, enemy.y);
    }
    const currency = enemy.definition.currencyDrop;
    for (let i = 0; i < Math.min(4, Math.ceil(currency / 4)); i += 1) {
      this.spawnPickup(
        "coin",
        "coin",
        enemy.x,
        enemy.y,
        Math.ceil(currency / Math.ceil(currency / 4)),
      );
    }
  }

  private openChest(chest: Chest): void {
    const table = chest.overrideLootTable ?? this.definition.lootTable;
    const drops = 2;
    for (let i = 0; i < drops; i += 1) {
      const itemId = rollLoot(table, this.services.rng);
      if (!itemId || itemId === "none") continue;
      if (GameData.isPotion(itemId))
        this.spawnPickup("potion", itemId, chest.x, chest.y + 8);
      else this.spawnPickup("weapon", itemId, chest.x, chest.y + 8);
    }
    this.spawnPickup("coin", "coin", chest.x, chest.y + 8, 25);
    EventBus.emit("ui:toast", { message: "Chest opened", tone: "reward" });
  }

  private onLeverToggled(channel: string, on: boolean): void {
    if (on) this.leverChannels.add(channel);
    else this.leverChannels.delete(channel);

    for (const door of this.doors) {
      if (door.isLocked && on && door.requiresChannel === channel)
        door.setLocked(false);
    }
    EventBus.emit("ui:toast", {
      message: on ? "Mechanism engaged" : "Mechanism released",
      tone: "info",
    });
  }

  private spawnPickup(
    kind: PickupKind,
    payloadId: string,
    x: number,
    y: number,
    amount = 1,
  ): void {
    const tint =
      kind === "coin"
        ? 0xffffff
        : kind === "potion"
          ? (GameData.potions.get(payloadId)?.tint ?? 0xffffff)
          : 0xc9b6ff;
    const pickup = this.services.spawnPickup(
      kind,
      payloadId,
      amount,
      tint,
      x,
      y,
    );
    if (pickup) this.pickups.push(pickup);
  }

  collectPickupsNear(player: Player): void {
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = this.pickups[i];
      if (!pickup || !pickup.active) {
        this.pickups.splice(i, 1);
        continue;
      }
      if (
        Phaser.Math.Distance.Between(pickup.x, pickup.y, player.x, player.y) >
        14
      )
        continue;
      this.services.onPickupCollected(pickup);
      pickup.collect();
      this.pickups.splice(i, 1);
    }
  }

  nearestInteractable(player: Player): Interactable | null {
    let best: Interactable | null = null;
    let bestDistance: number = TUNING.player.interactRadius;

    for (const interactable of this.interactables) {
      if (!interactable.canInteract()) continue;
      const distance = Phaser.Math.Distance.Between(
        interactable.x,
        interactable.y,
        player.x,
        player.y,
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        best = interactable;
      }
    }
    return best;
  }

  private checkExits(): void {
    if (!this.transitionArmed) return;
    const player = this.services.player;

    for (const exit of this.exits) {
      if (!exit.bounds.contains(player.x, player.y)) continue;
      const door = this.doors.find(
        (candidate) => candidate.direction === exit.direction,
      );
      if (door?.isLocked) continue;
      this.transitionArmed = false;
      this.services.requestTransition(exit.direction, exit.targetRoomId);
      return;
    }
  }

  /** Entry offset so the player does not immediately re-trigger the door they came through. */
  entryPointFrom(direction: Direction): Phaser.Math.Vector2 {
    const opposite: Record<Direction, Direction> = {
      n: "s",
      s: "n",
      e: "w",
      w: "e",
    };
    const target = opposite[direction];
    const exit = this.exits.find((candidate) => candidate.direction === target);
    if (!exit) return this.spawnPoint;

    const point = new Phaser.Math.Vector2(
      exit.bounds.centerX,
      exit.bounds.centerY,
    );
    switch (target) {
      case "n":
        point.y += TILE_SIZE + EXIT_PUSH_PX;
        break;
      case "s":
        point.y -= TILE_SIZE + EXIT_PUSH_PX;
        break;
      case "w":
        point.x += TILE_SIZE + EXIT_PUSH_PX;
        break;
      case "e":
        point.x -= TILE_SIZE + EXIT_PUSH_PX;
        break;
      default:
        break;
    }
    return point;
  }

  get doorColliders(): Phaser.Physics.Arcade.Sprite[] {
    return this.doors.map((door) => door.gameObject);
  }

  private markCleared(silent: boolean): void {
    this.clearedInternal = true;
    this.definition.cleared = true;
    for (const door of this.doors) door.setLocked(false);
    if (!silent) EventBus.emit("room:cleared", { roomId: this.definition.id });
  }

  destroy(): void {
    for (const enemy of this.enemies) {
      this.services.unregisterEnemy(enemy);
      enemy.destroy();
    }
    for (const door of this.doors) door.destroy();
    for (const hazard of this.hazards) hazard.destroy();
    for (const interactable of this.interactables) interactable.destroy();
    for (const pickup of this.pickups) pickup.deactivate();

    this.enemies.length = 0;
    this.doors.length = 0;
    this.hazards.length = 0;
    this.interactables.length = 0;
    this.pickups.length = 0;
    this.exits.length = 0;
    this.processedDeaths.clear();

    this.wallLayer?.destroy();
    this.map?.destroy();
    this.wallLayer = null;
    this.map = null;
    this.boss = null;
  }
}
