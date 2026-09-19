import weaponsJson from "./weapons.json";
import enemiesJson from "./enemies.json";
import bossesJson from "./bosses.json";
import dungeonsJson from "./dungeons.json";
import itemsJson from "./items.json";
import { AbilityEffectRegistry } from "../combat/AbilityEffectRegistry";
import type {
  BossDefinition,
  DungeonDefinition,
  EnemyDefinition,
  PotionDefinition,
  WeaponStats,
} from "../core/types";

function indexById<T extends { id: string }>(
  rows: ReadonlyArray<T>,
  label: string,
): ReadonlyMap<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (!row.id) throw new Error(`${label}: entry missing id`);
    if (map.has(row.id)) throw new Error(`${label}: duplicate id ${row.id}`);
    map.set(row.id, row);
  }
  if (map.size === 0) throw new Error(`${label}: no entries loaded`);
  return map;
}

function assertFiniteNumber(
  owner: string,
  field: string,
  value: unknown,
): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      `${owner}: field '${field}' must be a finite number, got ${JSON.stringify(value)}`,
    );
  }
}

function assertNonNegative(owner: string, field: string, value: unknown): void {
  assertFiniteNumber(owner, field, value);
  if ((value as number) < 0)
    throw new Error(`${owner}: field '${field}' must be >= 0, got ${value}`);
}

function assertPositive(owner: string, field: string, value: unknown): void {
  assertFiniteNumber(owner, field, value);
  if ((value as number) <= 0)
    throw new Error(`${owner}: field '${field}' must be > 0, got ${value}`);
}

function assertString(owner: string, field: string, value: unknown): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(
      `${owner}: field '${field}' must be a non-empty string, got ${JSON.stringify(value)}`,
    );
  }
}

const weapons = indexById(weaponsJson as ReadonlyArray<WeaponStats>, "weapons");
const enemies = indexById(
  enemiesJson as ReadonlyArray<EnemyDefinition>,
  "enemies",
);
const bosses = indexById(bossesJson as ReadonlyArray<BossDefinition>, "bosses");
const dungeons = indexById(
  dungeonsJson as ReadonlyArray<DungeonDefinition>,
  "dungeons",
);
const potions = indexById(
  itemsJson as ReadonlyArray<PotionDefinition>,
  "items",
);

function validate(): void {
  for (const weapon of weapons.values()) {
    const owner = `weapon ${weapon.id}`;
    assertString(owner, "displayName", weapon.displayName);
    assertNonNegative(owner, "damage", weapon.damage);
    assertPositive(owner, "attackSpeed", weapon.attackSpeed);
    assertPositive(owner, "range", weapon.range);
    assertNonNegative(owner, "swapCancelWindowMs", weapon.swapCancelWindowMs);
    assertNonNegative(owner, "knockback", weapon.knockback);
    assertNonNegative(owner, "activeMs", weapon.activeMs);
    assertNonNegative(owner, "recoveryMs", weapon.recoveryMs);
    assertPositive(owner, "comboLength", weapon.comboLength);
    if (!AbilityEffectRegistry.has(weapon.abilityEffectId)) {
      throw new Error(
        `${owner}: unknown abilityEffectId ${weapon.abilityEffectId}`,
      );
    }
  }

  for (const enemy of enemies.values()) {
    const owner = `enemy ${enemy.id}`;
    assertString(owner, "displayName", enemy.displayName);
    assertPositive(owner, "health", enemy.health);
    assertNonNegative(owner, "moveSpeed", enemy.moveSpeed);
    assertNonNegative(owner, "aggroRange", enemy.aggroRange);
    assertNonNegative(owner, "damage", enemy.damage);
    assertNonNegative(owner, "attackRange", enemy.attackRange);
    assertNonNegative(owner, "attackWindupMs", enemy.attackWindupMs);
    assertNonNegative(owner, "attackActiveMs", enemy.attackActiveMs);
    assertNonNegative(owner, "attackRecoveryMs", enemy.attackRecoveryMs);
    assertPositive(owner, "bodyRadius", enemy.bodyRadius);
    assertNonNegative(owner, "currencyDrop", enemy.currencyDrop);
    if (enemy.fleeHealthRatio < 0 || enemy.fleeHealthRatio > 1) {
      throw new Error(
        `${owner}: fleeHealthRatio must be in [0,1], got ${enemy.fleeHealthRatio}`,
      );
    }
  }

  for (const potion of potions.values()) {
    const owner = `potion ${potion.id}`;
    assertString(owner, "displayName", potion.displayName);
    assertFiniteNumber(owner, "magnitude", potion.magnitude);
    assertNonNegative(owner, "durationMs", potion.durationMs);
  }

  const knownItems = new Set<string>([
    ...potions.keys(),
    ...weapons.keys(),
    "none",
  ]);
  const checkDrops = (
    ownerId: string,
    table: ReadonlyArray<{ itemId: string }>,
  ): void => {
    for (const entry of table) {
      if (!knownItems.has(entry.itemId))
        throw new Error(`${ownerId}: unknown drop ${entry.itemId}`);
    }
  };

  for (const enemy of enemies.values()) checkDrops(enemy.id, enemy.dropTable);
  for (const boss of bosses.values()) {
    const owner = `boss ${boss.id}`;
    checkDrops(boss.id, boss.dropTable);
    if (boss.attackPatterns.length === 0)
      throw new Error(`${owner}: no attack patterns`);
    for (const pattern of boss.attackPatterns) {
      const patternOwner = `${owner} pattern ${pattern.attackId}`;
      assertNonNegative(patternOwner, "telegraphMs", pattern.telegraphMs);
      assertNonNegative(patternOwner, "activeMs", pattern.activeMs);
      assertNonNegative(patternOwner, "cooldownMs", pattern.cooldownMs);
      assertNonNegative(patternOwner, "damage", pattern.damage);
      assertNonNegative(patternOwner, "radius", pattern.radius);
      if (pattern.healthRatioMax <= 0 || pattern.healthRatioMax > 1) {
        throw new Error(
          `${patternOwner}: healthRatioMax must be in (0,1], got ${pattern.healthRatioMax}`,
        );
      }
      if (pattern.kind === "summon" && !pattern.summonEnemyId) {
        throw new Error(`${patternOwner}: summon pattern has no summonEnemyId`);
      }
      if (pattern.summonEnemyId && !enemies.has(pattern.summonEnemyId)) {
        throw new Error(
          `${patternOwner}: unknown summon target ${pattern.summonEnemyId}`,
        );
      }
    }
  }

  for (const dungeon of dungeons.values()) {
    const roomIds = new Set(dungeon.rooms.map((room) => room.id));
    if (!roomIds.has(dungeon.entryRoomId))
      throw new Error(`${dungeon.id}: missing entry room`);
    if (!roomIds.has(dungeon.bossRoomId))
      throw new Error(`${dungeon.id}: missing boss room`);
    for (const room of dungeon.rooms) {
      checkDrops(room.id, room.lootTable);
      for (const exit of room.exits) {
        if (!roomIds.has(exit.targetRoomId)) {
          throw new Error(
            `${dungeon.id}/${room.id}: exit targets unknown room ${exit.targetRoomId}`,
          );
        }
      }
    }
  }
}

validate();

export const GameData = {
  weapons,
  enemies,
  bosses,
  dungeons,
  potions,

  weapon(id: string): WeaponStats {
    const found = weapons.get(id);
    if (!found) throw new Error(`Unknown weapon: ${id}`);
    return found;
  },

  enemy(id: string): EnemyDefinition {
    const found = enemies.get(id);
    if (!found) throw new Error(`Unknown enemy: ${id}`);
    return found;
  },

  boss(id: string): BossDefinition {
    const found = bosses.get(id);
    if (!found) throw new Error(`Unknown boss: ${id}`);
    return found;
  },

  dungeon(id: string): DungeonDefinition {
    const found = dungeons.get(id);
    if (!found) throw new Error(`Unknown dungeon: ${id}`);
    return found;
  },

  isPotion(id: string): boolean {
    return potions.has(id);
  },
} as const;

export const DEFAULT_LOADOUT: readonly [string, string] = [
  "blade_emberfall",
  "spell_emberlance",
];
