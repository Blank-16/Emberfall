import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { createGameConfig } from "@game/core/GameConfig";
import { GameBridge } from "@game/core/GameBridge";
import { BootScene } from "@game/scenes/BootScene";
import { PreloadScene } from "@game/scenes/PreloadScene";
import { HubScene } from "@game/scenes/HubScene";
import { DungeonScene } from "@game/scenes/DungeonScene";

/** Owns the single Phaser.Game instance. React never reaches into scenes from here; see EventBus/GameBridge. */
export function PhaserGame(): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent || gameRef.current) return undefined;

    const game = new Phaser.Game({
      ...createGameConfig(parent),
      scene: [BootScene, PreloadScene, HubScene, DungeonScene],
    });
    gameRef.current = game;
    if (import.meta.env.DEV)
      (window as unknown as { __game?: Phaser.Game }).__game = game;

    const disposeVolume = GameBridge.on(
      "command:set-volume",
      ({ channel, value }) => {
        if (channel === "master") game.sound.setVolume(value);
      },
    );

    return () => {
      disposeVolume();
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="phaser-mount" />;
}
