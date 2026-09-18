import { useState } from 'react';
import { GameBridge } from '@game/core/GameBridge';
import { SceneKeys } from '@game/core/SceneKeys';
import { useGameEvent, useGameEventEffect } from '../hooks/useGameEvent';
import { Inventory } from './Inventory';

interface ToastEntry {
  readonly key: number;
  readonly message: string;
  readonly tone: 'info' | 'reward' | 'warn';
}

interface CooldownEntry {
  readonly totalMs: number;
  readonly nonce: number;
}

let toastSeq = 0;

export function HUD(): JSX.Element {
  const health = useGameEvent('player:health-changed', { current: 100, max: 100 });
  const shield = useGameEvent('player:shield-changed', { amount: 0 });
  const loadout = useGameEvent('weapon:loadout-changed', { activeSlot: 0 as const, slots: [] });
  const currency = useGameEvent('currency:changed', { total: 0 });
  const room = useGameEvent('room:entered', { roomId: '', locked: false, index: 0, total: 0 });
  const interactPrompt = useGameEvent('ui:interact-prompt', { label: null });
  const paused = useGameEvent('game:paused', { paused: false });

  const [bossState, setBossState] = useState<{ displayName: string; current: number; max: number } | null>(null);
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [deathVisible, setDeathVisible] = useState(false);
  const [clearedReward, setClearedReward] = useState<number | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, CooldownEntry>>({});

  useGameEventEffect('boss:spawned', ({ displayName, max }) => setBossState({ displayName, current: max, max }));
  useGameEventEffect('boss:health-changed', ({ current, max }) =>
    setBossState((prev) => (prev ? { ...prev, current, max } : prev)),
  );
  useGameEventEffect('boss:defeated', () => setBossState(null));

  useGameEventEffect('weapon:cooldown', ({ weaponId, totalMs }) => {
    setCooldowns((prev) => ({ ...prev, [weaponId]: { totalMs, nonce: (prev[weaponId]?.nonce ?? 0) + 1 } }));
  });

  useGameEventEffect('ui:toast', ({ message, tone }) => {
    const key = toastSeq++;
    setToasts((prev) => [...prev.slice(-3), { key, message, tone }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.key !== key)), 2400);
  });

  useGameEventEffect('player:died', () => setDeathVisible(true));
  useGameEventEffect('dungeon:cleared', ({ currency: total }) => setClearedReward(total));
  useGameEventEffect('game:scene-changed', ({ scene }) => {
    if (scene === SceneKeys.Hub) {
      setDeathVisible(false);
      setClearedReward(null);
      setBossState(null);
    }
  });

  const healthRatio = health.max > 0 ? health.current / health.max : 0;
  const shieldRatio = health.max > 0 ? Math.min(1, shield.amount / health.max) : 0;

  return (
    <div className="hud-layer">
      <div className="hud-top-left plate">
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          Room {room.total > 0 ? room.index + 1 : 0}/{room.total}
        </span>
      </div>

      <div className="hud-top-right plate">
        <span aria-hidden>&#9679;</span>
        <span>{currency.total}</span>
      </div>

      {bossState && (
        <div className="boss-bar-wrap">
          <div className="boss-name">{bossState.displayName}</div>
          <div className="boss-bar-track">
            <div
              className="boss-bar-fill"
              style={{ width: `${Math.max(0, (bossState.current / bossState.max) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.key} className={`toast plate ${toast.tone}`}>
            {toast.message}
          </div>
        ))}
      </div>

      {interactPrompt.label && (
        <div className="interact-prompt plate">
          <span className="key-hint">E</span>
          <span>{interactPrompt.label}</span>
        </div>
      )}

      <div className="hud-bottom-left">
        <div className="plate">
          <div className="health-row">
            <div className="bar-track">
              <div className="bar-fill health" style={{ transform: `scaleX(${healthRatio})` }} />
              <div className="bar-fill shield" style={{ transform: `scaleX(${shieldRatio})` }} />
            </div>
            <span className="bar-readout">
              {Math.ceil(health.current)}/{health.max}
            </span>
          </div>
        </div>
        <Inventory />
      </div>

      <div className="hud-bottom-right">
        {[0, 1].map((slotIndex) => {
          const weapon = loadout.slots[slotIndex];
          const cooldown = weapon ? cooldowns[weapon.id] : undefined;
          return (
            <div key={slotIndex} className={`weapon-slot plate ${loadout.activeSlot === slotIndex ? 'active' : ''}`}>
              <div className="weapon-name">{weapon?.displayName ?? '—'}</div>
              <span className="key-hint">{slotIndex === loadout.activeSlot ? 'Q' : ''}</span>
              {cooldown && (
                <div
                  key={`${weapon?.id}-${cooldown.nonce}`}
                  className="weapon-cooldown"
                  style={{ width: '100%', animation: `cooldown-sweep ${cooldown.totalMs}ms linear forwards` }}
                />
              )}
            </div>
          );
        })}
      </div>

      {deathVisible && (
        <div className="full-overlay death">
          <div className="headline">You Have Fallen</div>
          <div className="subline">Returning to the hub...</div>
        </div>
      )}

      {clearedReward !== null && (
        <div className="full-overlay cleared">
          <div className="headline">Dungeon Cleared</div>
          <div className="subline">{clearedReward} embers banked</div>
        </div>
      )}

      {paused.paused && !deathVisible && clearedReward === null && (
        <div className="pause-overlay">
          <div className="headline">Paused</div>
          <button className="pause-resume" onClick={() => GameBridge.pauseGame(false)}>
            Resume
          </button>
        </div>
      )}
    </div>
  );
}
