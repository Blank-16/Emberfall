import Phaser from "phaser";
import { SceneKeys } from "../core/SceneKeys";
import { syncDungeonsFromBackend } from "../data/GameData";

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  async create(): Promise<void> {
    await syncDungeonsFromBackend();
    this.scene.start(SceneKeys.Preload);
  }
}
