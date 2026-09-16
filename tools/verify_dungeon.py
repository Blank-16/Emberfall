"""Cross-checks dungeons.json against the built Tiled maps in public/maps.

Hard failures (asserts): a room's exit has no matching door object in its built
map, or targets a room id that doesn't exist in the dungeon.

Soft warnings (printed, not raised): a room's exit has no reciprocal exit in
the target room using the geometrically opposite direction. Rooms are authored
independently and don't have to tile like a continuous world grid, so this is
often intentional (see d1_sanctum, entered from the causeway's south exit but
only reachable back out through its own west door) -- but it's worth a glance
whenever a new room is added, since it's also the shape a genuine typo takes.
"""
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..")
OPPOSITE = {"n": "s", "s": "n", "e": "w", "w": "e"}


def check(dungeons_path: str, maps_dir: str) -> None:
    for dungeon in json.load(open(dungeons_path, encoding="utf-8")):
        rooms_by_id = {r["id"]: r for r in dungeon["rooms"]}
        print(f"== {dungeon['id']} ({len(rooms_by_id)} rooms) ==")

        for room_id, room in rooms_by_id.items():
            map_path = os.path.join(maps_dir, f"{room_id}.json")
            assert os.path.exists(map_path), f"{room_id}: no built map at {map_path}"
            built = json.load(open(map_path, encoding="utf-8"))
            objects = built["layers"][2]["objects"]
            exit_names = {o["name"] for o in objects if o["type"] == "exit"}

            for exit_def in room["exits"]:
                name = f"exit_{exit_def['direction']}"
                assert name in exit_names, f"{room_id}: no built exit object for '{exit_def['direction']}'"
                target_id = exit_def["targetRoomId"]
                assert target_id in rooms_by_id, f"{room_id}: exit targets unknown room '{target_id}'"

        for room_id, room in rooms_by_id.items():
            for exit_def in room["exits"]:
                target = rooms_by_id[exit_def["targetRoomId"]]
                reverse = OPPOSITE[exit_def["direction"]]
                if reverse not in {e["direction"] for e in target["exits"]}:
                    print(
                        f"  warning: {room_id} -> {exit_def['targetRoomId']} "
                        f"('{exit_def['direction']}') has no reciprocal '{reverse}' exit back"
                    )

        print(f"  {len(rooms_by_id)} rooms OK\n")


if __name__ == "__main__":
    check(os.path.join(ROOT, "src/game/data/dungeons.json"), os.path.join(ROOT, "public/maps"))
