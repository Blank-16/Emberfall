import type { DungeonDefinition, RoomDefinition } from '../core/types';

export class Dungeon {
  private readonly roomsById = new Map<string, RoomDefinition>();
  private readonly mainPathRoomIds: ReadonlyArray<string>;

  constructor(readonly definition: DungeonDefinition) {
    for (const room of definition.rooms) this.roomsById.set(room.id, room);
    this.mainPathRoomIds = definition.rooms.filter((room) => !room.optional).map((room) => room.id);
  }

  get id(): string {
    return this.definition.id;
  }

  get entryRoomId(): string {
    return this.definition.entryRoomId;
  }

  get bossRoomId(): string {
    return this.definition.bossRoomId;
  }

  get roomCount(): number {
    return this.definition.rooms.length;
  }

  /** Rooms that gate progress toward the boss -- excludes optional side rooms like a bonus vault. */
  get mainPathRoomCount(): number {
    return this.mainPathRoomIds.length;
  }

  room(id: string): RoomDefinition {
    const found = this.roomsById.get(id);
    if (!found) throw new Error(`Dungeon ${this.definition.id}: unknown room ${id}`);
    return found;
  }

  roomIndex(id: string): number {
    return this.definition.rooms.findIndex((room) => room.id === id);
  }

  /** Index within main-path rooms only, or -1 if this room is itself optional. */
  mainPathIndex(id: string): number {
    return this.mainPathRoomIds.indexOf(id);
  }
}
