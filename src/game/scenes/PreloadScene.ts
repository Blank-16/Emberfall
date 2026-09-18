import Phaser from 'phaser';
import { SceneKeys } from '../core/SceneKeys';
import { generateEntityTextures } from '../core/TextureFactory';

/** Entity textures are runtime-generated and shared across every scene, so they load once here. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preload);
  }

  create(): void {
    generateEntityTextures(this);
    this.scene.start(SceneKeys.Hub);
  }
}
