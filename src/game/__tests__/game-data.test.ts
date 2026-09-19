import { describe, expect, it } from "vitest";
import { GameData } from "../data/GameData";

describe("GameData", () => {
  it("loads and validates the real weapons/enemies/bosses/dungeons/items without throwing", () => {
    // Importing the module already runs validate() at load time; reaching this line is the test.
    expect(GameData.weapons.size).toBeGreaterThan(0);
    expect(GameData.enemies.size).toBeGreaterThan(0);
    expect(GameData.bosses.size).toBeGreaterThan(0);
    expect(GameData.dungeons.size).toBeGreaterThan(0);
    expect(GameData.potions.size).toBeGreaterThan(0);
  });

  it("every weapon references a registered ability effect", () => {
    for (const weapon of GameData.weapons.values()) {
      expect(() => GameData.weapon(weapon.id)).not.toThrow();
    }
  });

  it("every dungeon boss room exists among its own rooms", () => {
    for (const dungeon of GameData.dungeons.values()) {
      const roomIds = new Set(dungeon.rooms.map((room) => room.id));
      expect(roomIds.has(dungeon.bossRoomId)).toBe(true);
      expect(roomIds.has(dungeon.entryRoomId)).toBe(true);
    }
  });

  it("throws a clear error for an unknown id instead of returning undefined", () => {
    expect(() => GameData.weapon("does_not_exist")).toThrow(/Unknown weapon/);
    expect(() => GameData.enemy("does_not_exist")).toThrow(/Unknown enemy/);
    expect(() => GameData.boss("does_not_exist")).toThrow(/Unknown boss/);
    expect(() => GameData.dungeon("does_not_exist")).toThrow(/Unknown dungeon/);
  });
});
