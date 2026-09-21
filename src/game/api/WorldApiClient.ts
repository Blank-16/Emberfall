import type { DungeonDefinition, RoomDefinition } from "../core/types";

export interface AuthoredExit {
  readonly direction: string;
  readonly target: string;
  readonly locked: boolean;
  readonly channel?: string;
}

export interface RoomObject {
  readonly type: string;
  readonly id?: string;
  readonly tx: number;
  readonly ty: number;
  readonly lootTable?: ReadonlyArray<{ itemId: string; weight: number }>;
}

export interface AuthoredRoom {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly layout: ReadonlyArray<string>;
  readonly exits: ReadonlyArray<AuthoredExit>;
  readonly objects: ReadonlyArray<RoomObject>;
  readonly isBoss?: boolean;
}

export interface RoomResponse {
  readonly dungeonId: string;
  readonly definition: RoomDefinition;
  readonly authoredRoom: AuthoredRoom;
}

export interface ServiceHealth {
  readonly status: string;
  readonly service: string;
}

export class WorldApiClient {
  private static defaultBaseUrl =
    typeof window !== "undefined" && window.location.origin.includes(":5173")
      ? "http://localhost:8080"
      : "";
  private static connected = false;

  public static getBaseUrl(): string {
    return (
      (import.meta.env?.VITE_WORLD_API_URL as string) ?? this.defaultBaseUrl
    );
  }

  public static isConnected(): boolean {
    return this.connected;
  }

  public static setConnected(state: boolean): void {
    this.connected = state;
  }

  public static async checkHealth(timeoutMs = 1500): Promise<ServiceHealth | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const base = this.getBaseUrl();
      const res = await fetch(`${base}/health`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as ServiceHealth;
      this.connected = data.status === "ok";
      return data;
    } catch {
      this.connected = false;
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  public static async fetchDungeons(): Promise<DungeonDefinition[]> {
    const base = this.getBaseUrl();
    const res = await fetch(`${base}/api/v1/dungeons`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch dungeons: HTTP ${res.status}`);
    }
    return (await res.json()) as DungeonDefinition[];
  }

  public static async fetchDungeon(dungeonId: string): Promise<DungeonDefinition> {
    const base = this.getBaseUrl();
    const res = await fetch(`${base}/api/v1/dungeons/${encodeURIComponent(dungeonId)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch dungeon ${dungeonId}: HTTP ${res.status}`);
    }
    return (await res.json()) as DungeonDefinition;
  }

  public static async fetchRoom(
    dungeonId: string,
    roomId: string,
  ): Promise<RoomResponse> {
    const base = this.getBaseUrl();
    const res = await fetch(
      `${base}/api/v1/dungeons/${encodeURIComponent(dungeonId)}/rooms/${encodeURIComponent(roomId)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) {
      throw new Error(
        `Failed to fetch room ${roomId} for dungeon ${dungeonId}: HTTP ${res.status}`,
      );
    }
    return (await res.json()) as RoomResponse;
  }

  public static getRoomMapUrl(dungeonId: string, roomId: string): string {
    const base = this.getBaseUrl();
    return `${base}/api/v1/dungeons/${encodeURIComponent(dungeonId)}/rooms/${encodeURIComponent(roomId)}/map`;
  }
}
