package world

// DungeonDefinition mirrors src/game/data/dungeons.json. Keep the JSON field
// names aligned with the existing TypeScript data contract.
type DungeonDefinition struct {
	ID          string         `json:"id"`
	DisplayName string         `json:"displayName"`
	TilesetKey  string         `json:"tilesetKey"`
	Palette     DungeonPalette `json:"palette"`
	EntryRoomID string         `json:"entryRoomId"`
	BossRoomID  string         `json:"bossRoomId"`
	Rooms       []DungeonRoom  `json:"rooms"`
}

type DungeonPalette struct {
	Floor    int `json:"floor"`
	FloorAlt int `json:"floorAlt"`
	Wall     int `json:"wall"`
	WallTop  int `json:"wallTop"`
	Accent   int `json:"accent"`
}

type DungeonRoom struct {
	ID          string          `json:"id"`
	TiledMapKey string          `json:"tiledMapKey"`
	Exits       []DungeonExit   `json:"exits"`
	EnemySpawns []EnemySpawn    `json:"enemySpawns"`
	LootTable   []WeightedEntry `json:"lootTable"`
	Cleared     bool            `json:"cleared"`
	Optional    bool            `json:"optional,omitempty"`
}

type DungeonExit struct {
	Direction    string `json:"direction"`
	TargetRoomID string `json:"targetRoomId"`
	Locked       bool   `json:"locked"`
	Channel      string `json:"channel,omitempty"`
}

type EnemySpawn struct {
	EnemyType string  `json:"enemyType"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
}

type WeightedEntry struct {
	ItemID string  `json:"itemId"`
	Weight float64 `json:"weight"`
}

// AuthoredRoom is the source room format used by tools/build-maps.mjs.
// It is deliberately kept separate from DungeonRoom: the two files currently
// carry related but non-identical data (for example, exits use target vs
// targetRoomId, and authored objects contain enemy placements).
type AuthoredRoom struct {
	ID      string         `json:"id"`
	Width   int            `json:"width"`
	Height  int            `json:"height"`
	Layout  []string       `json:"layout"`
	Exits   []AuthoredExit `json:"exits"`
	Objects []RoomObject   `json:"objects"`
	IsBoss  bool           `json:"isBoss,omitempty"`
}

type AuthoredExit struct {
	Direction string `json:"direction"`
	Target    string `json:"target"`
	Locked    bool   `json:"locked"`
	Channel   string `json:"channel,omitempty"`
}

type RoomObject struct {
	Type      string          `json:"type"`
	ID        string          `json:"id,omitempty"`
	TX        int             `json:"tx"`
	TY        int             `json:"ty"`
	LootTable []WeightedEntry `json:"lootTable,omitempty"`
}

type RoomResponse struct {
	DungeonID    string       `json:"dungeonId"`
	Definition   DungeonRoom  `json:"definition"`
	AuthoredRoom AuthoredRoom `json:"authoredRoom"`
}
