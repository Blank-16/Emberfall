export const SceneKeys = {
  Boot: 'BootScene',
  Preload: 'PreloadScene',
  Hub: 'HubScene',
  Dungeon: 'DungeonScene',
} as const;

export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];
