import type Phaser from 'phaser';
import { GameBridge } from './GameBridge';
import { EventBus } from './EventBus';
import { RunState } from './RunState';
import type { Player } from '../entities/Player';

/**
 * Wires the subset of GameBridge commands that make sense in any scene with a live,
 * controllable Player: pause, and using/selecting a potion. Scene-specific commands
 * (weapon swap, return-to-hub) stay in the scene itself since not every scene has them.
 * Returns disposers; the caller pushes them onto its own teardown list.
 */
export function wireSharedPlayerCommands(scene: Phaser.Scene, player: Player): Array<() => void> {
  return [
    GameBridge.on('command:pause', ({ paused }) => {
      scene.physics.world.isPaused = paused;
      player.setInputLocked(paused);
      EventBus.emit('game:paused', { paused });
    }),
    GameBridge.on('command:use-potion', ({ potionId }) => player.usePotion(potionId, scene.time.now)),
    GameBridge.on('command:select-potion', ({ potionId }) => RunState.inventory.select(potionId)),
  ];
}
