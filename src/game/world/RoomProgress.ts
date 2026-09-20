/**
 * Tracks per-dungeon-run progress that must survive a room being rebuilt on revisit:
 * boss defeats, opened chests, and unlocked lever channels. Regular ("trash") enemies are
 * deliberately NOT tracked here -- they respawn every time a room is rebuilt, same as a
 * classic dungeon crawler. Only bosses, chests, and lever-gated doors are one-time-only.
 * Scoped to one DungeonScene instance -- a fresh dungeon attempt (via the Hub) starts clean.
 */
export class RoomProgress {
  private readonly defeatedBossObjectIds = new Set<number>();
  private readonly openedChestObjectIds = new Set<number>();
  private readonly unlockedChannels = new Set<string>();

  isBossDefeated(objectId: number): boolean {
    return this.defeatedBossObjectIds.has(objectId);
  }

  markBossDefeated(objectId: number): void {
    this.defeatedBossObjectIds.add(objectId);
  }

  isChestOpened(objectId: number): boolean {
    return this.openedChestObjectIds.has(objectId);
  }

  markChestOpened(objectId: number): void {
    this.openedChestObjectIds.add(objectId);
  }

  isChannelUnlocked(channel: string): boolean {
    return this.unlockedChannels.has(channel);
  }

  /** One-way: matches Door/Lever's existing semantics where a pulled lever's unlock never reverts. */
  markChannelUnlocked(channel: string): void {
    this.unlockedChannels.add(channel);
  }
}
