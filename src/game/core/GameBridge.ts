import { TypedEmitter } from './TypedEmitter';

export interface GameCommandMap {
  'command:pause': { paused: boolean };
  'command:swap-weapon': { source: 'ui' | 'input' };
  'command:use-potion': { potionId: string };
  'command:select-potion': { potionId: string };
  'command:enter-dungeon': { dungeonId: string };
  'command:return-hub': { reason: 'death' | 'cleared' | 'manual' };
  'command:set-volume': { channel: 'master' | 'sfx' | 'music'; value: number };
}

class GameBridgeImpl extends TypedEmitter<GameCommandMap> {
  pauseGame(paused: boolean): void {
    this.emit('command:pause', { paused });
  }

  requestWeaponSwap(): void {
    this.emit('command:swap-weapon', { source: 'ui' });
  }

  usePotion(potionId: string): void {
    this.emit('command:use-potion', { potionId });
  }

  selectPotion(potionId: string): void {
    this.emit('command:select-potion', { potionId });
  }

  enterDungeon(dungeonId: string): void {
    this.emit('command:enter-dungeon', { dungeonId });
  }

  returnToHub(reason: GameCommandMap['command:return-hub']['reason']): void {
    this.emit('command:return-hub', { reason });
  }

  setVolume(channel: GameCommandMap['command:set-volume']['channel'], value: number): void {
    this.emit('command:set-volume', { channel, value });
  }
}

/** React -> Phaser. Typed command surface; no direct scene access from the UI layer. */
export const GameBridge = new GameBridgeImpl();
