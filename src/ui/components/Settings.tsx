import { useState } from 'react';
import { GameBridge } from '@game/core/GameBridge';

const CHANNELS = ['master', 'sfx', 'music'] as const;
type Channel = (typeof CHANNELS)[number];

export function Settings(): JSX.Element {
  const [values, setValues] = useState<Record<Channel, number>>({ master: 0.8, sfx: 0.8, music: 0.6 });

  const update = (channel: Channel, value: number): void => {
    setValues((prev) => ({ ...prev, [channel]: value }));
    GameBridge.setVolume(channel, value);
  };

  return (
    <div className="settings-panel plate">
      {CHANNELS.map((channel) => (
        <label key={channel} className="settings-row">
          {channel}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={values[channel]}
            onChange={(event) => update(channel, Number(event.target.value))}
          />
        </label>
      ))}
    </div>
  );
}
