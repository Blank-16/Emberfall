"""Authoring helper: emits src/game/data/rooms/*.json from hand-laid ASCII blocks.

Legend: '#' wall  '.' floor  ',' floor alt  '+' doorway  'x' spike  'f' fire  ' ' void
Run once when layouts change; the emitted JSON is the checked-in source of truth.
"""
import json
import os

W, H = 30, 20
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "game", "data", "rooms")


def row(*parts: str) -> str:
    s = "".join(parts)
    assert len(s) == W, f"row width {len(s)} != {W}: {s!r}"
    return s


def room(room_id: str, rows: list[str], exits: list[dict], objects: list[dict], flags: dict | None = None) -> None:
    assert len(rows) == H, f"{room_id} height {len(rows)} != {H}"
    payload = {"id": room_id, "width": W, "height": H, "layout": rows, "exits": exits, "objects": objects}
    payload.update(flags or {})
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, f"{room_id}.json"), "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)
        fh.write("\n")


WALL = "#" * W
VOID3 = " " * 3


def plain(fill: str = ".") -> str:
    return row("#", fill * (W - 2), "#")


# d1_entry: wide mouth of the ruin, two braziers, one enemy pair, exit east.
entry = [
    row(VOID3, "#" * 24, VOID3),
    row(VOID3, "#", "," * 22, "#", VOID3),
    row("  ", "##", "." * 22, "##", "  "),
    row("#" * 2, "." * 26, "#" * 2),
    plain(),
    row("#", "." * 7, "#" * 3, "." * 8, "#" * 3, "." * 7, "#"),
    row("#", "." * 7, "#", ",", "#", "." * 8, "#", ",", "#", "." * 7, "#"),
    row("#", "." * 7, "#" * 3, "." * 8, "#" * 3, "." * 7, "#"),
    plain(),
    plain(),
    row("#", "." * 28, "+"),
    row("#", "." * 28, "+"),
    plain(),
    plain(),
    row("#", "." * 7, "#" * 3, "." * 8, "#" * 3, "." * 7, "#"),
    row("#", "." * 7, "#", ",", "#", "." * 8, "#", ",", "#", "." * 7, "#"),
    row("#" * 2, "." * 26, "#" * 2),
    row("  ", "##", "." * 22, "##", "  "),
    row(VOID3, "#", "," * 22, "#", VOID3),
    row(VOID3, "#" * 24, VOID3),
]
room(
    "d1_entry",
    entry,
    [{"direction": "e", "target": "d1_hall", "locked": True}],
    [
        {"type": "player_start", "tx": 5, "ty": 10},
        {"type": "enemy", "id": "husk_thrall", "tx": 17, "ty": 6},
        {"type": "enemy", "id": "husk_thrall", "tx": 17, "ty": 13},
        {"type": "enemy", "id": "husk_thrall", "tx": 22, "ty": 10},
    ],
)

# d1_hall: long pillared hall, ranged enemies behind cover, branches north and east.
hall = [
    row("#" * 13, "++", "#" * 15),
    row("#", "." * 28, "#"),
    row("#", "." * 28, "#"),
    row("#", "." * 4, "#", "." * 18, "#", "." * 4, "#"),
    row("#", "." * 4, "#", ",", "#" * 2, "." * 12, "#" * 2, ",", "#", "." * 4, "#"),
    row("#", "." * 4, "#", ",", "#", "." * 14, "#", ",", "#", "." * 4, "#"),
    row("#", "." * 4, "#" * 2, "." * 16, "#" * 2, "." * 4, "#"),
    row("#", "." * 28, "#"),
    row("#", "." * 28, "#"),
    row("+", "." * 28, "+"),
    row("+", "." * 28, "+"),
    row("#", "." * 28, "#"),
    row("#", "." * 28, "#"),
    row("#", "." * 4, "#" * 2, "." * 16, "#" * 2, "." * 4, "#"),
    row("#", "." * 4, "#", ",", "#", "." * 14, "#", ",", "#", "." * 4, "#"),
    row("#", "." * 4, "#", ",", "#" * 2, "." * 12, "#" * 2, ",", "#", "." * 4, "#"),
    row("#", "." * 4, "#", "." * 18, "#", "." * 4, "#"),
    row("#", "." * 28, "#"),
    row("#", "." * 28, "#"),
    row("#" * 30),
]
room(
    "d1_hall",
    hall,
    [
        {"direction": "w", "target": "d1_entry", "locked": False},
        {"direction": "n", "target": "d1_grove", "locked": False},
        {"direction": "e", "target": "d1_cistern", "locked": True},
    ],
    [
        {"type": "enemy", "id": "husk_thrall", "tx": 10, "ty": 9},
        {"type": "enemy", "id": "husk_thrall", "tx": 19, "ty": 11},
        {"type": "enemy", "id": "thorn_slinger", "tx": 7, "ty": 4},
        {"type": "enemy", "id": "thorn_slinger", "tx": 22, "ty": 15},
    ],
)

# d1_grove: optional side room. No enemies gate, one chest behind a fire ring.
grove = [
    row("#" * 30),
    row("#", "," * 28, "#"),
    row("#", ",", "." * 26, ",", "#"),
    row("#", ",", "." * 26, ",", "#"),
    row("#", ",", "." * 9, "f" * 8, "." * 9, ",", "#"),
    row("#", ",", "." * 9, "f", "." * 6, "f", "." * 9, ",", "#"),
    row("#", ",", "." * 9, "f", "." * 6, "f", "." * 9, ",", "#"),
    row("#", ",", "." * 9, "f", "." * 6, "f", "." * 9, ",", "#"),
    row("#", ",", "." * 9, "f" * 3, "." * 2, "f" * 3, "." * 9, ",", "#"),
    row("#", ",", "." * 26, ",", "#"),
    row("#", ",", "." * 26, ",", "#"),
    row("#", ",", "." * 26, ",", "#"),
    row("#", "," * 28, "#"),
    row("#" * 8, "." * 14, "#" * 8),
    row("#" * 8, "." * 14, "#" * 8),
    row("#" * 8, ".", "#" * 12, ".", "#" * 8),
    row("#" * 8, ".", "#" * 12, ".", "#" * 8),
    row("#" * 8, "." * 14, "#" * 8),
    row("#" * 8, "." * 14, "#" * 8),
    row("#" * 14, "++", "#" * 14),
]
room(
    "d1_grove",
    grove,
    [{"direction": "s", "target": "d1_hall", "locked": False}],
    [
        {
            "type": "chest",
            "id": "grove_cache",
            "tx": 14,
            "ty": 6,
            "lootTable": [
                {"itemId": "draught_fury", "weight": 10},
                {"itemId": "ward_stone", "weight": 8},
                {"itemId": "elixir_mend", "weight": 6},
            ],
        },
        {"type": "enemy", "id": "bramble_turret", "tx": 4, "ty": 6},
        {"type": "enemy", "id": "bramble_turret", "tx": 25, "ty": 6},
    ],
    {"optional": True},
)

# d1_cistern: spike corridors plus a lever that opens the east door early.
SP = ".x.x.x."
cistern = [
    row("#" * 30),
    row("#", "." * 28, "#"),
    row("#", SP, "#" * 14, SP, "#"),
    row("#", "." * 7, "#", "," * 12, "#", "." * 7, "#"),
    row("#", "." * 7, "#", ",", "." * 10, ",", "#", "." * 7, "#"),
    row("#", SP, "#", ",", ".", "x" * 8, ".", ",", "#", SP, "#"),
    row("#", "." * 7, "#", ",", "." * 10, ",", "#", "." * 7, "#"),
    row("#", "." * 7, "#", "," * 12, "#", "." * 7, "#"),
    row("#", "." * 7, "#" * 14, "." * 7, "#"),
    row("+", "." * 28, "#"),
    row("+", "." * 28, "#"),
    row("#", "." * 7, "#" * 14, "." * 7, "#"),
    row("#", "." * 7, "#", "," * 12, "#", "." * 7, "#"),
    row("#", SP, "#", ",", ".", "x" * 8, ".", ",", "#", SP, "#"),
    row("#", "." * 7, "#", ",", "." * 10, ",", "#", "." * 7, "#"),
    row("#", "." * 7, "#", ",", "." * 10, ",", "#", "." * 7, "#"),
    row("#", "." * 7, "#" * 14, SP, "#"),
    row("#", "." * 28, "#"),
    row("#", "." * 28, "+"),
    row("#" * 29, "#"),
]
room(
    "d1_cistern",
    cistern,
    [
        {"direction": "w", "target": "d1_hall", "locked": False},
        {"direction": "e", "target": "d1_warren", "locked": True, "channel": "cistern_gate"},
    ],
    [
        {"type": "enemy", "id": "husk_thrall", "tx": 14, "ty": 9},
        {"type": "enemy", "id": "husk_thrall", "tx": 16, "ty": 11},
        {"type": "enemy", "id": "thorn_slinger", "tx": 4, "ty": 4},
        {"type": "enemy", "id": "bramble_turret", "tx": 25, "ty": 15},
        {"type": "lever", "id": "cistern_gate", "tx": 14, "ty": 4},
    ],
)

# d1_warren: mini-boss arena. Open circle, scorched rim, no cover.
warren = [
    row(" " * 6, "#" * 18, " " * 6),
    row(" " * 4, "#" * 4, "," * 14, "#" * 4, " " * 4),
    row(" " * 2, "#" * 4, "." * 18, "#" * 4, " " * 2),
    row("#" * 4, "." * 22, "#" * 4),
    row("#" * 2, "." * 26, "#" * 2),
    row("#", "." * 28, "#"),
    row("#", "." * 28, "#"),
    row("#", "." * 12, ",", "," * 2, ",", "." * 12, "#"),
    row("#", "." * 28, "#"),
    row("+", "." * 28, "#"),
    row("+", "." * 28, "#"),
    row("#", "." * 28, "#"),
    row("#", "." * 12, ",", "," * 2, ",", "." * 12, "#"),
    row("#", "." * 28, "#"),
    row("#", "." * 28, "#"),
    row("#" * 2, "." * 26, "#" * 2),
    row("#" * 4, "." * 22, "#" * 4),
    row(" " * 2, "#" * 4, "." * 18, "#" * 4, " " * 2),
    row(" " * 4, "#" * 4, "." * 12, "+", "+", "#" * 4, " " * 4),
    row(" " * 6, "#" * 18, " " * 6),
]
room(
    "d1_warren",
    warren,
    [
        {"direction": "w", "target": "d1_cistern", "locked": False},
        {"direction": "s", "target": "d1_causeway", "locked": True},
    ],
    [{"type": "boss", "id": "warden_of_roots", "tx": 20, "ty": 10}],
    {"isMiniBoss": True},
)

# d1_causeway: narrow bridge over void, fire jets, turrets on the flanks.
causeway = [
    row(" " * 13, "#", "+", "+", "#", " " * 13),
    row(" " * 13, "#", ".", ".", "#", " " * 13),
    row(" " * 10, "#" * 4, ".", ".", "#" * 4, " " * 10),
    row(" " * 8, "#" * 3, "." * 8, "#" * 3, " " * 8),
    row(" " * 6, "#" * 3, "." * 12, "#" * 3, " " * 6),
    row(" " * 4, "#" * 3, ".", "f", "." * 12, "f", ".", "#" * 3, " " * 4),
    row(" " * 2, "#" * 3, "." * 20, "#" * 3, " " * 2),
    row("#" * 3, "." * 24, "#" * 3),
    row("#", ",", "#", "." * 24, "#", ",", "#"),
    row("#", ",", "#", "." * 10, "f" * 4, "." * 10, ".", ".", "+"),
    row("#", ",", "#", "." * 10, "f" * 4, "." * 10, ".", ".", "+"),
    row("#", ",", "#", "." * 24, "#", ",", "#"),
    row("#" * 3, "." * 24, "#" * 3),
    row(" " * 2, "#" * 3, "." * 20, "#" * 3, " " * 2),
    row(" " * 4, "#" * 3, ".", "f", "." * 12, "f", ".", "#" * 3, " " * 4),
    row(" " * 6, "#" * 3, "." * 12, "#" * 3, " " * 6),
    row(" " * 8, "#" * 3, "." * 8, "#" * 3, " " * 8),
    row(" " * 10, "#" * 4, "." * 2, "#" * 4, " " * 10),
    row(" " * 10, "#" * 4, "+", "+", "#" * 4, " " * 10),
    row(" " * 10, "#" * 4, "#" * 2, "#" * 4, " " * 10),
]
room(
    "d1_causeway",
    causeway,
    [
        {"direction": "n", "target": "d1_warren", "locked": False},
        {"direction": "s", "target": "d1_sanctum", "locked": True},
        {"direction": "e", "target": "d1_vault", "locked": False},
    ],
    [
        {"type": "enemy", "id": "bramble_turret", "tx": 4, "ty": 9},
        {"type": "enemy", "id": "bramble_turret", "tx": 25, "ty": 10},
        {"type": "enemy", "id": "thorn_slinger", "tx": 9, "ty": 8},
        {"type": "enemy", "id": "thorn_slinger", "tx": 20, "ty": 11},
        {"type": "enemy", "id": "husk_thrall", "tx": 14, "ty": 7},
    ],
)

# d1_vault: optional treasure room, reached via the causeway's east branch.
vault = [
    row("#" * 30),
    row("#", "," * 28, "#"),
    row("#", ",", "." * 26, ",", "#"),
    row("#", ",", "." * 26, ",", "#"),
    row("#", ",", "." * 11, "#" * 4, "." * 11, ",", "#"),
    row("#", ",", "." * 11, "#", "." * 2, "#", "." * 11, ",", "#"),
    row("#", ",", "." * 11, "#", "." * 2, "#", "." * 11, ",", "#"),
    row("#", ",", "." * 11, "#" * 4, "." * 11, ",", "#"),
    row("+", ".", "." * 26, ",", "#"),
    row("+", ".", "." * 26, ",", "#"),
    row("#", ",", "." * 26, ",", "#"),
    row("#", ",", "." * 11, "x" * 4, "." * 11, ",", "#"),
    row("#", ",", "." * 11, "x" * 4, "." * 11, ",", "#"),
    row("#", ",", "." * 26, ",", "#"),
    row("#", ",", "." * 26, ",", "#"),
    row("#", "," * 28, "#"),
    row("#" * 30),
    row("#" * 30),
    row("#" * 30),
    row("#" * 30),
]
room(
    "d1_vault",
    vault,
    [{"direction": "w", "target": "d1_causeway", "locked": False}],
    [
        {
            "type": "chest",
            "id": "vault_hoard",
            "tx": 15,
            "ty": 6,
            "lootTable": [
                {"itemId": "blade_riverfang", "weight": 6},
                {"itemId": "spear_windrake", "weight": 6},
                {"itemId": "spell_frostlance", "weight": 6},
                {"itemId": "ward_stone", "weight": 5},
            ],
        },
        {"type": "enemy", "id": "thorn_slinger", "tx": 6, "ty": 8},
        {"type": "enemy", "id": "husk_thrall", "tx": 23, "ty": 12},
    ],
    {"optional": True},
)

# d1_sanctum: boss arena. Ring of scorched stone, four spike clusters at the corners.
sanctum = [
    row(" " * 8, "#" * 14, " " * 8),
    row(" " * 5, "#" * 5, "," * 10, "#" * 5, " " * 5),
    row(" " * 3, "#" * 4, "," * 16, "#" * 4, " " * 3),
    row(" ", "#" * 4, "." * 20, "#" * 4, " "),
    row("#" * 3, "." * 24, "#" * 3),
    row("#" * 2, ".", "x", "x", "." * 20, "x", "x", ".", "#" * 2),
    row("#", ".", "x", "x", "." * 22, "x", "x", ".", "#"),
    row("#", "." * 28, "#"),
    row("#", "." * 28, "#"),
    row("+", "." * 12, ",", "," * 2, ",", "." * 12, "#"),
    row("+", "." * 12, ",", "," * 2, ",", "." * 12, "#"),
    row("#", "." * 28, "#"),
    row("#", "." * 28, "#"),
    row("#", ".", "x", "x", "." * 22, "x", "x", ".", "#"),
    row("#" * 2, ".", "x", "x", "." * 20, "x", "x", ".", "#" * 2),
    row("#" * 3, "." * 24, "#" * 3),
    row(" ", "#" * 4, "." * 20, "#" * 4, " "),
    row(" " * 3, "#" * 4, "," * 16, "#" * 4, " " * 3),
    row(" " * 5, "#" * 5, "," * 10, "#" * 5, " " * 5),
    row(" " * 8, "#" * 14, " " * 8),
]
room(
    "d1_sanctum",
    sanctum,
    [{"direction": "w", "target": "d1_causeway", "locked": False}],
    [
        {"type": "player_start", "tx": 4, "ty": 10},
        {"type": "boss", "id": "emberfall_ashwarden", "tx": 21, "ty": 10},
    ],
    {"isBoss": True},
)

print("authored rooms:", sorted(os.listdir(OUT)))
