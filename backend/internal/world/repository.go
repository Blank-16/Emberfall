package world

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type Repository struct {
	dataDir     string
	dungeons    []DungeonDefinition
	dungeonByID map[string]DungeonDefinition
	roomByID    map[string]AuthoredRoom
}

func Load(dataDir string) (*Repository, error) {
	dungeonsPath := filepath.Join(dataDir, "src", "game", "data", "dungeons.json")
	bytes, err := os.ReadFile(dungeonsPath)
	if err != nil {
		return nil, fmt.Errorf("read dungeon definitions %q: %w", dungeonsPath, err)
	}
	var dungeons []DungeonDefinition
	if err := json.Unmarshal(bytes, &dungeons); err != nil {
		return nil, fmt.Errorf("decode dungeon definitions: %w", err)
	}
	if len(dungeons) == 0 {
		return nil, fmt.Errorf("no dungeon definitions found")
	}

	r := &Repository{
		dataDir:     dataDir,
		dungeons:    dungeons,
		dungeonByID: make(map[string]DungeonDefinition, len(dungeons)),
		roomByID:    make(map[string]AuthoredRoom),
	}
	for _, dungeon := range dungeons {
		if dungeon.ID == "" {
			return nil, fmt.Errorf("dungeon entry has empty id")
		}
		if _, exists := r.dungeonByID[dungeon.ID]; exists {
			return nil, fmt.Errorf("duplicate dungeon id %q", dungeon.ID)
		}
		r.dungeonByID[dungeon.ID] = dungeon
		for _, room := range dungeon.Rooms {
			if room.ID == "" {
				return nil, fmt.Errorf("dungeon %s contains room with empty id", dungeon.ID)
			}
			roomPath := filepath.Join(dataDir, "src", "game", "data", "rooms", room.ID+".json")
			roomBytes, err := os.ReadFile(roomPath)
			if err != nil {
				return nil, fmt.Errorf("read authored room %q: %w", room.ID, err)
			}
			var authored AuthoredRoom
			if err := json.Unmarshal(roomBytes, &authored); err != nil {
				return nil, fmt.Errorf("decode authored room %q: %w", room.ID, err)
			}
			if authored.ID != room.ID {
				return nil, fmt.Errorf("room filename/id mismatch: expected %q, got %q", room.ID, authored.ID)
			}
			if err := validateAuthoredRoom(authored); err != nil {
				return nil, fmt.Errorf("room %s: %w", room.ID, err)
			}
			if _, exists := r.roomByID[room.ID]; exists {
				return nil, fmt.Errorf("duplicate room id %q across dungeons", room.ID)
			}
			r.roomByID[room.ID] = authored
		}
	}
	if err := r.validateReferences(); err != nil {
		return nil, err
	}
	return r, nil
}

func validateAuthoredRoom(room AuthoredRoom) error {
	if room.Width <= 0 || room.Height <= 0 {
		return fmt.Errorf("width and height must be positive")
	}
	if len(room.Layout) != room.Height {
		return fmt.Errorf("layout has %d rows; expected %d", len(room.Layout), room.Height)
	}
	for i, row := range room.Layout {
		if len([]rune(row)) != room.Width {
			return fmt.Errorf("layout row %d has width %d; expected %d", i, len([]rune(row)), room.Width)
		}
	}
	return nil
}

func (r *Repository) validateReferences() error {
	for _, dungeon := range r.dungeons {
		roomIDs := make(map[string]bool, len(dungeon.Rooms))
		for _, room := range dungeon.Rooms {
			roomIDs[room.ID] = true
		}
		if !roomIDs[dungeon.EntryRoomID] {
			return fmt.Errorf("dungeon %s references missing entry room %s", dungeon.ID, dungeon.EntryRoomID)
		}
		if !roomIDs[dungeon.BossRoomID] {
			return fmt.Errorf("dungeon %s references missing boss room %s", dungeon.ID, dungeon.BossRoomID)
		}
		for _, room := range dungeon.Rooms {
			for _, exit := range room.Exits {
				if !roomIDs[exit.TargetRoomID] {
					return fmt.Errorf("dungeon %s room %s exit targets unknown room %s", dungeon.ID, room.ID, exit.TargetRoomID)
				}
			}
		}
	}
	return nil
}

func (r *Repository) Dungeons() []DungeonDefinition { return r.dungeons }

func (r *Repository) Dungeon(id string) (DungeonDefinition, bool) {
	d, ok := r.dungeonByID[id]
	return d, ok
}

func (r *Repository) Room(dungeonID, roomID string) (RoomResponse, bool) {
	dungeon, ok := r.dungeonByID[dungeonID]
	if !ok {
		return RoomResponse{}, false
	}
	for _, definition := range dungeon.Rooms {
		if definition.ID == roomID {
			authored, exists := r.roomByID[roomID]
			if !exists {
				return RoomResponse{}, false
			}
			return RoomResponse{DungeonID: dungeonID, Definition: definition, AuthoredRoom: authored}, true
		}
	}
	return RoomResponse{}, false
}

func (r *Repository) MapPath(dungeonID, roomID string) (string, bool) {
	if _, ok := r.Room(dungeonID, roomID); !ok {
		return "", false
	}
	return filepath.Join(r.dataDir, "public", "maps", roomID+".json"), true
}
