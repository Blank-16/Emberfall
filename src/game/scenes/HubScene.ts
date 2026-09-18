import Phaser from 'phaser';
import { SceneKeys } from '../core/SceneKeys';
import { DEPTH, TILE_SIZE, TUNING } from '../core/GameConfig';
import { EventBus } from '../core/EventBus';
import { GameBridge } from '../core/GameBridge';
import { generateTileset, TileIndex, tilesetKeyFor } from '../core/TextureFactory';
import { RunState } from '../core/RunState';
import { wireSharedPlayerCommands } from '../core/SharedSceneCommands';
import { CombatSystem } from '../combat/CombatSystem';
import { Rng } from '../core/Rng';
import { Player } from '../entities/Player';
import { InputManager } from '../input/InputManager';
import { GameData } from '../data/GameData';

const HUB_WIDTH_TILES = 26;
const HUB_HEIGHT_TILES = 16;
const HUB_PALETTE = { floor: 0x2a2632, floorAlt: 0x332e40, wall: 0x18141f, wallTop: 0x211c2b, accent: 0x8f7ae0 };
/** Doorway is 3 tiles tall (row-1..row+1) so walking straight at it doesn't require pixel-perfect alignment. */
const DOORWAY_HALF_HEIGHT_TILES = 1;

interface Portal {
  readonly dungeonId: string;
  readonly bounds: Phaser.Geom.Rectangle;
}

export class HubScene extends Phaser.Scene {
  private player!: Player;
  private combat!: CombatSystem;
  private inputManager!: InputManager;
  private wallLayer!: Phaser.Tilemaps.TilemapLayer;
  private portals: Portal[] = [];
  private disposers: Array<() => void> = [];
  private leaving = false;

  constructor() {
    super(SceneKeys.Hub);
  }

  init(): void {
    this.disposers = [];
    this.portals = [];
    this.leaving = false;
  }

  create(): void {
    generateTileset(this, 'hub', HUB_PALETTE);

    const dungeonRows = this.computePortalRows();
    this.buildFloor(dungeonRows.map((entry) => entry.row));

    this.combat = new CombatSystem(this, new Rng());
    this.inputManager = new InputManager(this);

    const spawnX = TILE_SIZE * 4;
    const spawnY = (TILE_SIZE * HUB_HEIGHT_TILES) / 2;
    this.player = new Player(this, spawnX, spawnY, RunState.loadout, RunState.inventory, this.combat, GameData.potions);
    this.player.spawnFresh(spawnX, spawnY);
    this.combat.registerTarget(this.player);

    this.portals = dungeonRows.map(({ dungeonId, row }) => this.createPortal(dungeonId, row));

    this.physics.add.collider(this.player, this.wallLayer);
    this.physics.world.setBounds(0, 0, TILE_SIZE * HUB_WIDTH_TILES, TILE_SIZE * HUB_HEIGHT_TILES);
    this.player.arcadeBody.setCollideWorldBounds(true);

    this.cameras.main.setBounds(0, 0, TILE_SIZE * HUB_WIDTH_TILES, TILE_SIZE * HUB_HEIGHT_TILES);
    this.cameras.main.startFollow(this.player, true, TUNING.world.cameraLerp, TUNING.world.cameraLerp);
    this.cameras.main.fadeIn(240, 0, 0, 0);

    this.disposers.push(
      ...wireSharedPlayerCommands(this, this.player),
      GameBridge.on('command:enter-dungeon', ({ dungeonId }) => this.enterDungeon(dungeonId)),
    );

    EventBus.emit('game:scene-changed', { scene: SceneKeys.Hub });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  /** One doorway/portal per known dungeon, evenly spread along the east wall -- a new Phase 2 dungeon needs no changes here. */
  private computePortalRows(): Array<{ dungeonId: string; displayName: string; row: number }> {
    const dungeons = [...GameData.dungeons.values()];
    const usableRows = HUB_HEIGHT_TILES - 4;
    return dungeons.map((dungeon, index) => ({
      dungeonId: dungeon.id,
      displayName: dungeon.displayName,
      row: Math.round(2 + ((index + 1) * usableRows) / (dungeons.length + 1)),
    }));
  }

  /** Walk-through, no button press -- same idea as a dungeon room's own exits. The bounds cover the
   *  doorway gap and a short lead-in so the transition fires before the player ever reaches the hard
   *  world-bounds edge at the map border. */
  private createPortal(dungeonId: string, row: number): Portal {
    const centerX = TILE_SIZE * (HUB_WIDTH_TILES - 1.5);
    const centerY = row * TILE_SIZE + TILE_SIZE / 2;
    this.add.image(centerX, centerY, 'tex:telegraph').setDepth(DEPTH.decor).setTint(HUB_PALETTE.accent).setScale(0.6);

    const gapHeight = TILE_SIZE * (DOORWAY_HALF_HEIGHT_TILES * 2 + 1);
    const bounds = new Phaser.Geom.Rectangle(
      TILE_SIZE * (HUB_WIDTH_TILES - 2.5),
      centerY - gapHeight / 2,
      TILE_SIZE * 3,
      gapHeight,
    );
    return { dungeonId, bounds };
  }

  private buildFloor(doorwayRows: ReadonlyArray<number>): void {
    const map = this.make.tilemap({ tileWidth: TILE_SIZE, tileHeight: TILE_SIZE, width: HUB_WIDTH_TILES, height: HUB_HEIGHT_TILES });
    const tileset = map.addTilesetImage('base', tilesetKeyFor('hub'), TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) throw new Error('hub: tileset not registered');

    const ground = map.createBlankLayer('ground', tileset, 0, 0, HUB_WIDTH_TILES, HUB_HEIGHT_TILES);
    const walls = map.createBlankLayer('walls', tileset, 0, 0, HUB_WIDTH_TILES, HUB_HEIGHT_TILES);
    if (!ground || !walls) throw new Error('hub: failed to create layers');

    ground.fill(TileIndex.floor, 0, 0, HUB_WIDTH_TILES, HUB_HEIGHT_TILES);
    ground.setDepth(DEPTH.floor);
    walls.setDepth(DEPTH.walls);

    for (let x = 0; x < HUB_WIDTH_TILES; x += 1) {
      for (let y = 0; y < HUB_HEIGHT_TILES; y += 1) {
        const isBorder = x === 0 || y === 0 || x === HUB_WIDTH_TILES - 1 || y === HUB_HEIGHT_TILES - 1;
        if (!isBorder) continue;
        const isDoorway =
          x === HUB_WIDTH_TILES - 1 && doorwayRows.some((row) => Math.abs(y - row) <= DOORWAY_HALF_HEIGHT_TILES);
        if (isDoorway) continue;
        walls.putTileAt(y === HUB_HEIGHT_TILES - 1 ? TileIndex.wallTop : TileIndex.wall, x, y);
      }
    }
    walls.setCollision([TileIndex.wall, TileIndex.wallTop], true);
    this.wallLayer = walls;
  }

  private enterDungeon(dungeonId: string): void {
    if (this.leaving) return;
    this.leaving = true;
    this.player.setInputLocked(true);
    this.cameras.main.fadeOut(240, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(SceneKeys.Dungeon, { dungeonId });
    });
  }

  private checkPortals(): void {
    for (const portal of this.portals) {
      if (portal.bounds.contains(this.player.x, this.player.y)) {
        this.enterDungeon(portal.dungeonId);
        return;
      }
    }
  }

  override update(time: number, delta: number): void {
    if (this.leaving) return;
    const snapshot = this.inputManager.update(time, this.player.x, this.player.y);
    this.player.handleInput(snapshot, time);
    this.player.tick(time, delta);
    this.combat.update(time);
    this.checkPortals();
  }

  private teardown(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
    this.combat.releaseAll();
    this.inputManager.destroy();
  }
}
