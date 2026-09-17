import { TypedEmitter } from './TypedEmitter';
import type { WeaponClass } from './types';

export interface GameEventMap {
  'player:spawned': { current: number; max: number };
  'player:health-changed': { current: number; max: number };
  'player:shield-changed': { amount: number };
  'player:died': { roomId: string };
  'player:dash': { cooldownMs: number };
  'currency:changed': { total: number };
  'inventory:changed': {
    potions: ReadonlyArray<{ id: string; displayName: string; count: number }>;
    selectedId: string | null;
  };
  'weapon:loadout-changed': {
    activeSlot: 0 | 1;
    slots: ReadonlyArray<{ id: string; displayName: string; weaponClass: WeaponClass }>;
  };
  'weapon:swapped': { activeSlot: 0 | 1; weaponId: string; cancelled: boolean };
  'weapon:cooldown': { weaponId: string; remainingMs: number; totalMs: number };
  'combat:damage-dealt': { amount: number; critical: boolean; x: number; y: number; targetId: string };
  'combat:player-hit': { amount: number };
  'enemy:died': { enemyId: string; x: number; y: number };
  'boss:spawned': { bossId: string; displayName: string; max: number };
  'boss:health-changed': { current: number; max: number };
  'boss:telegraph': { attackId: string; durationMs: number };
  'boss:defeated': { bossId: string };
  'room:entered': { roomId: string; locked: boolean; index: number; total: number };
  'room:cleared': { roomId: string };
  'dungeon:cleared': { dungeonId: string; currency: number };
  'ui:toast': { message: string; tone: 'info' | 'reward' | 'warn' };
  'ui:interact-prompt': { label: string | null };
  'game:paused': { paused: boolean };
  'game:scene-changed': { scene: string };
}

/** Phaser -> React. React never reaches into scenes; it only listens here. */
export const EventBus = new TypedEmitter<GameEventMap>();
