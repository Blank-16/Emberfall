# Emberfall — Phase 1 Vertical Slice

2D top-down action-RPG. Phaser 3 + TypeScript (strict) for the game, React for the HUD.

## Run it

```
npm install
npm run dev
```

Opens on the Vite dev server (prints the local URL, typically `http://localhost:5173`).

`npm run dev` and `npm run build` both run `tools/build-maps.mjs` first, which compiles the
hand-authored room layouts in `src/game/data/rooms/*.json` into real Tiled JSON under
`public/maps/`. Edit the ASCII layouts in `tools/author_rooms.py` and re-run
`python3 tools/author_rooms.py` if you want to change room shapes; `npm run dev`/`build`
regenerate the Tiled maps from whatever is currently in `src/game/data/rooms/` automatically.

## Controls

| Action             | Keyboard               | Gamepad            |
| ------------------ | ---------------------- | ------------------ |
| Move               | WASD / arrows          | Left stick / D-pad |
| Aim                | Mouse                  | Right stick        |
| Attack             | J / Space / left click | A / R2             |
| Dash               | Shift / K              | B / L2             |
| Swap weapon (hold) | Q                      | L1 / R1            |
| Use potion         | F                      | Y                  |
| Interact           | E / Enter              | X                  |
| Pause              | Esc / P                | Start              |

Weapon swap requires holding the key ~130ms (`SWAP_HOLD_MS` in `input/InputManager.ts`) so a
combo input can't accidentally trigger it. A swap is rejected while the active weapon is still
mid swing (active-hit frames) and only goes through once the weapon is into recovery.

## What's here (Phase 1 of the spec)

Foundation systems, the full weapon/combat/AI stack, and dungeon 1 (Emberfall Grove) playable
start to finish: entry → 6 combat rooms + 2 optional side rooms → mini-boss (Warden of Roots) →
final boss (the Ashwarden) → reward → hub.

**Placeholder art.** Kenney's CC0 packs aren't reachable from the environment this was built in.
Every texture (tiles, characters, VFX) is generated at runtime in `core/TextureFactory.ts` from
flat-color Phaser Graphics calls — same pipeline shape a real spritesheet would slot into, just
without the art. Swapping in real Kenney assets means pointing the `TextureKeys` at loaded
spritesheet frames instead of `generateEntityTextures`/`generateTileset`, and adding a real
`preload()` to `PreloadScene`/`DungeonScene`.

**Not yet built** (Phase 2 per the spec): dungeons 2 and 3, meta-progression/upgrade shop,
localStorage + Supabase persistence, the remaining 5 weapon variants. The data-driven weapon
system already supports adding them as pure `weapons.json` entries with no new code, and
`GameData.ts` validates every cross-reference (ability effects, drop tables, room graphs) at
load time, so a bad JSON edit fails loudly on boot instead of silently misbehaving in-game.

## Verifying it works without a browser

`tsc --noEmit` and `vite build` both run clean. The trickiest runtime logic (weapon combo/cooldown
gating, the swap-cancel window, health/shield/i-frame interaction, status-effect tick timing, the
enemy FSM's state transitions, weighted loot rolling) was additionally exercised with a throwaway
Node smoke test during development — not shipped, since it's not part of the app, but every one of
those mechanics ran under real assertions at least once before being called done.
