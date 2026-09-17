import Phaser from 'phaser';
import { TILE_SIZE } from './GameConfig';
import type { DungeonPalette } from './types';

export const TextureKeys = {
  player: 'tex:player',
  enemy: 'tex:enemy',
  enemyRanged: 'tex:enemy-ranged',
  enemyTurret: 'tex:enemy-turret',
  boss: 'tex:boss',
  projectile: 'tex:projectile',
  slash: 'tex:slash',
  thrust: 'tex:thrust',
  shockwave: 'tex:shockwave',
  pickup: 'tex:pickup',
  coin: 'tex:coin',
  chest: 'tex:chest',
  chestOpen: 'tex:chest-open',
  lever: 'tex:lever',
  leverOn: 'tex:lever-on',
  door: 'tex:door',
  spike: 'tex:spike',
  spikeUp: 'tex:spike-up',
  fire: 'tex:fire',
  shadow: 'tex:shadow',
  particle: 'tex:particle',
  telegraph: 'tex:telegraph',
} as const;

export function tilesetKeyFor(dungeonId: string): string {
  return `tiles:${dungeonId}`;
}

type G = Phaser.GameObjects.Graphics;

function withGraphics(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

/**
 * Tileset layout (firstgid 1):
 * 1 floor | 2 floor alt | 3 wall | 4 wall top | 5 doorway | 6 spike base | 7 scorched | 8 accent
 */
export const TileIndex = {
  floor: 1,
  floorAlt: 2,
  wall: 3,
  wallTop: 4,
  doorway: 5,
  spikeBase: 6,
  scorched: 7,
  accent: 8,
} as const;

const TILE_COUNT = 8;

export function generateTileset(scene: Phaser.Scene, dungeonId: string, palette: DungeonPalette): string {
  const key = tilesetKeyFor(dungeonId);
  withGraphics(scene, key, TILE_SIZE * TILE_COUNT, TILE_SIZE, (g) => {
    const cell = (index: number): number => (index - 1) * TILE_SIZE;
    const speckle = (x: number, color: number, count: number, seed: number): void => {
      g.fillStyle(color, 1);
      for (let i = 0; i < count; i += 1) {
        const px = x + ((seed * (i + 3) * 7) % TILE_SIZE);
        const py = (seed * (i + 5) * 11) % TILE_SIZE;
        g.fillRect(px, py, 1, 1);
      }
    };

    g.fillStyle(palette.floor, 1);
    g.fillRect(cell(TileIndex.floor), 0, TILE_SIZE, TILE_SIZE);
    speckle(cell(TileIndex.floor), palette.floorAlt, 6, 3);

    g.fillStyle(palette.floorAlt, 1);
    g.fillRect(cell(TileIndex.floorAlt), 0, TILE_SIZE, TILE_SIZE);
    speckle(cell(TileIndex.floorAlt), palette.floor, 5, 5);

    g.fillStyle(palette.wall, 1);
    g.fillRect(cell(TileIndex.wall), 0, TILE_SIZE, TILE_SIZE);
    g.fillStyle(palette.wallTop, 1);
    g.fillRect(cell(TileIndex.wall), 0, TILE_SIZE, 4);

    g.fillStyle(palette.wallTop, 1);
    g.fillRect(cell(TileIndex.wallTop), 0, TILE_SIZE, TILE_SIZE);

    g.fillStyle(palette.floorAlt, 1);
    g.fillRect(cell(TileIndex.doorway), 0, TILE_SIZE, TILE_SIZE);
    g.fillStyle(palette.accent, 0.5);
    g.fillRect(cell(TileIndex.doorway), 6, TILE_SIZE, 4);

    g.fillStyle(palette.floor, 1);
    g.fillRect(cell(TileIndex.spikeBase), 0, TILE_SIZE, TILE_SIZE);
    g.lineStyle(1, 0x000000, 0.5);
    g.strokeRect(cell(TileIndex.spikeBase) + 2, 2, TILE_SIZE - 4, TILE_SIZE - 4);

    g.fillStyle(0x140f14, 1);
    g.fillRect(cell(TileIndex.scorched), 0, TILE_SIZE, TILE_SIZE);
    speckle(cell(TileIndex.scorched), palette.accent, 4, 7);

    g.fillStyle(palette.accent, 1);
    g.fillRect(cell(TileIndex.accent), 0, TILE_SIZE, TILE_SIZE);
    g.fillStyle(0x000000, 0.25);
    g.fillRect(cell(TileIndex.accent) + 3, 3, TILE_SIZE - 6, TILE_SIZE - 6);
  });
  return key;
}

function drawHumanoid(g: G, body: number, trim: number, size: number): void {
  const half = size / 2;
  g.fillStyle(0x000000, 0.0);
  g.fillRect(0, 0, size, size);
  g.fillStyle(body, 1);
  g.fillRoundedRect(3, 4, size - 6, size - 6, 3);
  g.fillStyle(trim, 1);
  g.fillRect(3, half - 1, size - 6, 3);
  g.fillStyle(0xf2e4c8, 1);
  g.fillRect(half - 3, 5, 6, 4);
  g.fillStyle(0x1b1420, 1);
  g.fillRect(half - 3, 6, 2, 2);
  g.fillRect(half + 1, 6, 2, 2);
}

export function generateEntityTextures(scene: Phaser.Scene): void {
  withGraphics(scene, TextureKeys.player, 16, 16, (g) => drawHumanoid(g, 0x4f7fd4, 0xe8d38a, 16));
  withGraphics(scene, TextureKeys.enemy, 16, 16, (g) => drawHumanoid(g, 0xffffff, 0xd8d8d8, 16));

  withGraphics(scene, TextureKeys.enemyRanged, 16, 16, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(8, 1, 15, 14, 1, 14);
    g.fillStyle(0x2a1f30, 1);
    g.fillRect(6, 8, 2, 2);
    g.fillRect(9, 8, 2, 2);
  });

  withGraphics(scene, TextureKeys.enemyTurret, 18, 18, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(1, 1, 16, 16, 5);
    g.fillStyle(0x2a1f30, 0.8);
    g.fillCircle(9, 9, 4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(9, 9, 2);
  });

  withGraphics(scene, TextureKeys.boss, 32, 32, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(2, 6, 28, 24, 6);
    g.fillTriangle(6, 8, 10, -2, 14, 8);
    g.fillTriangle(18, 8, 22, -2, 26, 8);
    g.fillStyle(0x1b1420, 1);
    g.fillRect(8, 14, 5, 4);
    g.fillRect(19, 14, 5, 4);
    g.fillRect(10, 23, 12, 2);
  });

  withGraphics(scene, TextureKeys.projectile, 8, 8, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 3);
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(4, 4, 4);
  });

  withGraphics(scene, TextureKeys.slash, 40, 40, (g) => {
    g.lineStyle(5, 0xffffff, 0.9);
    g.beginPath();
    g.arc(20, 20, 16, Phaser.Math.DegToRad(-55), Phaser.Math.DegToRad(55), false);
    g.strokePath();
  });

  withGraphics(scene, TextureKeys.thrust, 40, 12, (g) => {
    g.fillStyle(0xffffff, 0.85);
    g.fillTriangle(0, 6, 34, 0, 34, 12);
    g.fillStyle(0xffffff, 1);
    g.fillRect(30, 4, 10, 4);
  });

  withGraphics(scene, TextureKeys.shockwave, 64, 64, (g) => {
    g.lineStyle(4, 0xffffff, 0.85);
    g.strokeCircle(32, 32, 28);
    g.lineStyle(2, 0xffffff, 0.4);
    g.strokeCircle(32, 32, 20);
  });

  withGraphics(scene, TextureKeys.telegraph, 64, 64, (g) => {
    g.fillStyle(0xffffff, 0.25);
    g.fillCircle(32, 32, 30);
    g.lineStyle(2, 0xffffff, 0.9);
    g.strokeCircle(32, 32, 30);
  });

  withGraphics(scene, TextureKeys.shadow, 16, 8, (g) => {
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(8, 4, 14, 6);
  });

  withGraphics(scene, TextureKeys.particle, 4, 4, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 4, 4);
  });

  withGraphics(scene, TextureKeys.pickup, 10, 12, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(2, 3, 6, 8, 2);
    g.fillStyle(0xf4efe2, 1);
    g.fillRect(3, 0, 4, 3);
  });

  withGraphics(scene, TextureKeys.coin, 8, 8, (g) => {
    g.fillStyle(0xf0c04a, 1);
    g.fillCircle(4, 4, 3.5);
    g.fillStyle(0xfff0b8, 1);
    g.fillCircle(3, 3, 1.2);
  });

  withGraphics(scene, TextureKeys.chest, 16, 14, (g) => {
    g.fillStyle(0x6b4423, 1);
    g.fillRoundedRect(1, 3, 14, 10, 2);
    g.fillStyle(0xc8a24a, 1);
    g.fillRect(1, 6, 14, 2);
    g.fillRect(7, 6, 2, 5);
  });

  withGraphics(scene, TextureKeys.chestOpen, 16, 14, (g) => {
    g.fillStyle(0x4a2f18, 1);
    g.fillRoundedRect(1, 6, 14, 7, 2);
    g.fillStyle(0x2a1a0e, 1);
    g.fillRect(2, 7, 12, 3);
  });

  withGraphics(scene, TextureKeys.lever, 12, 16, (g) => {
    g.fillStyle(0x3d3448, 1);
    g.fillRect(2, 11, 8, 4);
    g.lineStyle(3, 0x9a8ab0, 1);
    g.lineBetween(6, 12, 2, 2);
  });

  withGraphics(scene, TextureKeys.leverOn, 12, 16, (g) => {
    g.fillStyle(0x3d3448, 1);
    g.fillRect(2, 11, 8, 4);
    g.lineStyle(3, 0x7fe0a0, 1);
    g.lineBetween(6, 12, 10, 2);
  });

  withGraphics(scene, TextureKeys.door, TILE_SIZE, TILE_SIZE, (g) => {
    g.fillStyle(0x2c2338, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.fillStyle(0x6e5b8c, 1);
    g.fillRect(1, 2, TILE_SIZE - 2, 2);
    g.fillRect(1, TILE_SIZE - 4, TILE_SIZE - 2, 2);
  });

  withGraphics(scene, TextureKeys.spike, TILE_SIZE, TILE_SIZE, (g) => {
    g.fillStyle(0x3a3040, 1);
    g.fillRect(2, 10, 12, 4);
    g.fillStyle(0x5a4d63, 1);
    g.fillRect(3, 11, 10, 1);
  });

  withGraphics(scene, TextureKeys.spikeUp, TILE_SIZE, TILE_SIZE, (g) => {
    g.fillStyle(0x3a3040, 1);
    g.fillRect(2, 12, 12, 3);
    g.fillStyle(0xcfd6e6, 1);
    for (let i = 0; i < 3; i += 1) {
      const x = 3 + i * 4;
      g.fillTriangle(x, 13, x + 2, 2, x + 4, 13);
    }
  });

  withGraphics(scene, TextureKeys.fire, TILE_SIZE, TILE_SIZE, (g) => {
    g.fillStyle(0xff7a2f, 0.85);
    g.fillTriangle(8, 1, 14, 15, 2, 15);
    g.fillStyle(0xffd24a, 0.9);
    g.fillTriangle(8, 6, 11, 15, 5, 15);
  });
}
