import Phaser from 'phaser';

export const TILE_SIZE = 16;
export const VIEWPORT_TILES_X = 30;
export const VIEWPORT_TILES_Y = 20;

export const RENDER = {
  width: TILE_SIZE * VIEWPORT_TILES_X,
  height: TILE_SIZE * VIEWPORT_TILES_Y,
  zoom: 2,
} as const;

export const TUNING = {
  player: {
    maxHealth: 100,
    moveSpeed: 130,
    acceleration: 1400,
    drag: 1600,
    dashSpeed: 380,
    dashDurationMs: 160,
    dashCooldownMs: 620,
    dashIFramesMs: 220,
    hitInvulnerabilityMs: 700,
    knockbackResistance: 0.45,
    interactRadius: 26,
  },
  combat: {
    hitStopMs: 55,
    hitFlashMs: 110,
    critChance: 0.08,
    critMultiplier: 1.75,
    damageVariance: 0.1,
    maxProjectiles: 192,
    maxHitboxes: 32,
    maxDamageText: 48,
  },
  world: {
    cullMarginPx: 96,
    roomTransitionMs: 260,
    cameraLerp: 0.16,
    doorOpenMs: 320,
  },
  hazards: {
    spikeDamage: 8,
    spikeCycleMs: 1600,
    spikeActiveMs: 520,
    fireDamage: 6,
    fireTickMs: 500,
  },
} as const;

export const DEPTH = {
  floor: 0,
  hazard: 5,
  decor: 10,
  entityShadow: 18,
  entity: 20,
  projectile: 30,
  walls: 40,
  vfx: 50,
  damageText: 60,
} as const;

export function createGameConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: RENDER.width,
    height: RENDER.height,
    zoom: RENDER.zoom,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#0d0a12',
    fps: { target: 60, forceSetTimeOut: false },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, fps: 60, fixedStep: true, debug: false },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: { gamepad: true },
    disableContextMenu: true,
  };
}
