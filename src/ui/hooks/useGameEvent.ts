import { useEffect, useRef, useState } from "react";
import { EventBus, type GameEventMap } from "@game/core/EventBus";

/** Subscribes to one EventBus topic and re-renders with its latest payload. No polling. */
export function useGameEvent<K extends keyof GameEventMap>(
  event: K,
  initial: GameEventMap[K],
): GameEventMap[K] {
  const [value, setValue] = useState<GameEventMap[K]>(initial);

  useEffect(() => {
    return EventBus.on(event, setValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  return value;
}

/** Fire-and-forget events (toasts, prompts) that should not persist as component state on their own. */
export function useGameEventEffect<K extends keyof GameEventMap>(
  event: K,
  handler: (payload: GameEventMap[K]) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return EventBus.on(event, (payload) => handlerRef.current(payload));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
}
