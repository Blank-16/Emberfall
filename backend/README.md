# Emberfall World API (Phase 2 foundation)

This service is the first backend slice for Emberfall. It reads the existing authored JSON files directly; it does not yet generate procedural dungeons, mutate gameplay state, or persist saves.

## Requirements

- Go 1.23+
- Run the Go commands from `Emberfall-main/backend/`.

## Run

```bash
EMBERFALL_DATA_DIR=.. go run ./cmd/server
```

The API listens on `http://localhost:8080`. The default CORS origin is `http://localhost:5173`.

## Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Service health |
| GET | `/api/v1/dungeons` | List dungeon definitions |
| GET | `/api/v1/dungeons/{dungeonID}` | Get a dungeon and its room graph |
| GET | `/api/v1/dungeons/{dungeonID}/rooms/{roomID}` | Get room gameplay metadata and authored layout together |
| GET | `/api/v1/dungeons/{dungeonID}/rooms/{roomID}/map` | Get the generated Tiled map JSON |

## Data ownership for this first slice

- `src/game/data/dungeons.json` remains the source for dungeon graph metadata, palette, entry/boss room IDs, loot and progression metadata.
- `src/game/data/rooms/*.json` remains the source for hand-authored tile layouts, authored exits and placed objects.
- `public/maps/*.json` remains generated output from `npm run build:maps`.

The API intentionally returns dungeon room metadata and authored room layout as separate fields. Their schemas are related but not identical, so this first step does not silently merge or rewrite them.

## Test

```bash
go test ./...
```

## Next steps

1. Add a TypeScript API client and load the dungeon manifest from this service behind a feature flag.
2. Add save/snapshot contracts and local IndexedDB checkpoints.
3. Add PostgreSQL only when we introduce durable player saves or generated-world records.
4. Move procedural world generation into Go after the static API integration is verified.
