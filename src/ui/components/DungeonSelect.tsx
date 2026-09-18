import { GameData } from '@game/data/GameData';
import { GameBridge } from '@game/core/GameBridge';

export function DungeonSelect(): JSX.Element {
  const dungeons = [...GameData.dungeons.values()];

  return (
    <div className="dungeon-select-list">
      {dungeons.map((dungeon) => (
        <div key={dungeon.id} className="dungeon-card plate">
          <span className="dungeon-name">{dungeon.displayName}</span>
          <span style={{ fontSize: 11, color: 'var(--parchment-dim)' }}>{dungeon.rooms.length} rooms</span>
          <button onClick={() => GameBridge.enterDungeon(dungeon.id)}>Enter</button>
        </div>
      ))}
    </div>
  );
}
