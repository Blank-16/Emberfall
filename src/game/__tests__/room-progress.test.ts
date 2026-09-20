import { describe, expect, it } from "vitest";
import { RoomProgress } from "../world/RoomProgress";

describe("RoomProgress", () => {
  it("tracks defeated bosses independently by id", () => {
    const progress = new RoomProgress();
    expect(progress.isBossDefeated(1)).toBe(false);
    progress.markBossDefeated(1);
    expect(progress.isBossDefeated(1)).toBe(true);
    expect(progress.isBossDefeated(2)).toBe(false);
  });

  it("tracks opened chests independently by id", () => {
    const progress = new RoomProgress();
    progress.markChestOpened(5);
    expect(progress.isChestOpened(5)).toBe(true);
    expect(progress.isChestOpened(6)).toBe(false);
  });

  it("unlocked channels are one-way, matching the door/lever semantics they back", () => {
    const progress = new RoomProgress();
    expect(progress.isChannelUnlocked("gate_a")).toBe(false);
    progress.markChannelUnlocked("gate_a");
    expect(progress.isChannelUnlocked("gate_a")).toBe(true);
    // No un-mark method exists: once unlocked, always unlocked for this run.
    progress.markChannelUnlocked("gate_a");
    expect(progress.isChannelUnlocked("gate_a")).toBe(true);
  });

  it("a fresh instance (a new dungeon run) starts with nothing tracked", () => {
    const first = new RoomProgress();
    first.markBossDefeated(1);
    first.markChestOpened(1);
    first.markChannelUnlocked("a");

    const second = new RoomProgress();
    expect(second.isBossDefeated(1)).toBe(false);
    expect(second.isChestOpened(1)).toBe(false);
    expect(second.isChannelUnlocked("a")).toBe(false);
  });
});
