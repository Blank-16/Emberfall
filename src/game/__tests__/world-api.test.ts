import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorldApiClient } from "../api/WorldApiClient";
import { GameData, syncDungeonsFromBackend } from "../data/GameData";

describe("WorldApiClient", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    WorldApiClient.setConnected(false);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("checks service health successfully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok", service: "emberfall-world" }),
    });

    const health = await WorldApiClient.checkHealth();
    expect(health).toEqual({ status: "ok", service: "emberfall-world" });
    expect(WorldApiClient.isConnected()).toBe(true);
  });

  it("handles offline or failing health check gracefully", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network connection refused"));

    const health = await WorldApiClient.checkHealth();
    expect(health).toBeNull();
    expect(WorldApiClient.isConnected()).toBe(false);
  });

  it("builds map URL with encoded components", () => {
    const url = WorldApiClient.getRoomMapUrl("d1_emberfall", "d1_hall");
    expect(url).toContain("/api/v1/dungeons/d1_emberfall/rooms/d1_hall/map");
  });

  it("fetches dungeon list and single dungeon", async () => {
    const mockDungeon = {
      id: "d1_emberfall",
      displayName: "Emberfall Grove",
      tilesetKey: "d1_emberfall",
      palette: { floor: 1, floorAlt: 2, wall: 3, wallTop: 4, accent: 5 },
      entryRoomId: "d1_entry",
      bossRoomId: "d1_sanctum",
      rooms: [],
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/api/v1/dungeons")) {
        return Promise.resolve({
          ok: true,
          json: async () => [mockDungeon],
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockDungeon,
      });
    });

    const dungeons = await WorldApiClient.fetchDungeons();
    expect(dungeons).toHaveLength(1);
    expect(dungeons[0]?.id).toBe("d1_emberfall");

    const single = await WorldApiClient.fetchDungeon("d1_emberfall");
    expect(single.displayName).toBe("Emberfall Grove");
  });

  it("syncs dungeons into GameData when API is available and valid", async () => {
    const initialCount = GameData.dungeons.size;
    expect(initialCount).toBeGreaterThan(0);

    const validDungeon = {
      id: "d1_emberfall",
      displayName: "Emberfall Grove",
      tilesetKey: "d1_emberfall",
      palette: { floor: 3025466, floorAlt: 3814480, wall: 1709606, wallTop: 2367283, accent: 8363887 },
      entryRoomId: "d1_entry",
      bossRoomId: "d1_entry",
      rooms: [
        {
          id: "d1_entry",
          tiledMapKey: "d1_entry",
          exits: [],
          enemySpawns: [],
          lootTable: [],
          cleared: false,
        },
      ],
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/health")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: "ok", service: "emberfall-world" }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => [validDungeon],
      });
    });

    const result = await syncDungeonsFromBackend();
    expect(result).toBe(true);
    expect(GameData.dungeon("d1_emberfall")).toBeDefined();
    expect(WorldApiClient.isConnected()).toBe(true);
  });

  it("gracefully falls back when backend returns invalid graph data", async () => {
    const invalidDungeon = {
      id: "broken_dungeon",
      displayName: "Broken Dungeon",
      tilesetKey: "d1",
      palette: { floor: 1, floorAlt: 2, wall: 3, wallTop: 4, accent: 5 },
      entryRoomId: "missing_entry",
      bossRoomId: "missing_boss",
      rooms: [],
    };

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/health")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: "ok", service: "emberfall-world" }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => [invalidDungeon],
      });
    });

    const result = await syncDungeonsFromBackend();
    expect(result).toBe(false);
    expect(WorldApiClient.isConnected()).toBe(false);
  });
});
