export type WeaponClass = 'sword' | 'spear' | 'heavy' | 'magic';
export type Direction = 'n' | 's' | 'e' | 'w';
export type Faction = 'player' | 'enemy';
export type EnemyBehavior = 'melee_chaser' | 'ranged_kiter' | 'stationary_turret';

export interface WeaponStats {
  readonly id: string;
  readonly displayName: string;
  readonly weaponClass: WeaponClass;
  readonly damage: number;
  readonly attackSpeed: number;
  readonly range: number;
  readonly swapCancelWindowMs: number;
  readonly abilityEffectId: string;
  readonly knockback: number;
  readonly activeMs: number;
  readonly recoveryMs: number;
  readonly arcDegrees: number;
  readonly comboLength: number;
  readonly projectileSpeed?: number;
  readonly manaCost?: number;
}

export interface WeightedEntry {
  readonly itemId: string;
  readonly weight: number;
}

export interface RoomExit {
  readonly direction: Direction;
  readonly targetRoomId: string;
  readonly locked: boolean;
  /** When set, this door only unlocks when a lever with this same channel id is pulled. */
  readonly channel?: string;
}

export interface RoomDefinition {
  readonly id: string;
  readonly tiledMapKey: string;
  readonly exits: ReadonlyArray<RoomExit>;
  readonly enemySpawns: ReadonlyArray<{ enemyType: string; x: number; y: number }>;
  readonly lootTable: ReadonlyArray<WeightedEntry>;
  /** Side room: doesn't gate the boss path and isn't counted in main-path progress. */
  readonly optional?: boolean;
  cleared: boolean;
}

export interface DungeonDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly tilesetKey: string;
  readonly palette: DungeonPalette;
  readonly entryRoomId: string;
  readonly rooms: ReadonlyArray<RoomDefinition>;
  readonly bossRoomId: string;
}

export interface DungeonPalette {
  readonly floor: number;
  readonly floorAlt: number;
  readonly wall: number;
  readonly wallTop: number;
  readonly accent: number;
}

export interface EnemyDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly health: number;
  readonly moveSpeed: number;
  readonly aggroRange: number;
  readonly damage: number;
  readonly behavior: EnemyBehavior;
  readonly attackRange: number;
  readonly attackWindupMs: number;
  readonly attackActiveMs: number;
  readonly attackRecoveryMs: number;
  readonly fleeHealthRatio: number;
  readonly bodyRadius: number;
  readonly tint: number;
  readonly projectileSpeed?: number;
  readonly dropTable: ReadonlyArray<WeightedEntry>;
  readonly currencyDrop: number;
}

export type BossAttackKind = 'radial_burst' | 'charge' | 'slam' | 'volley' | 'summon';

export interface BossAttackPattern {
  readonly attackId: string;
  readonly kind: BossAttackKind;
  readonly telegraphMs: number;
  readonly activeMs: number;
  readonly cooldownMs: number;
  readonly damage: number;
  readonly projectileCount: number;
  readonly radius: number;
  readonly healthRatioMax: number;
  readonly summonEnemyId?: string;
}

export interface BossDefinition extends EnemyDefinition {
  readonly attackPatterns: ReadonlyArray<BossAttackPattern>;
  readonly isMiniBoss: boolean;
}

export type PotionKind = 'heal' | 'speed' | 'damage' | 'shield';

export interface PotionDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly kind: PotionKind;
  readonly magnitude: number;
  readonly durationMs: number;
  readonly tint: number;
}
