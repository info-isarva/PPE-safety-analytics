import { useEffect, useRef } from "react";
import { subscribeLiveSafetyEvents } from "../events/liveEventsBus";

/**
 * Prepend live WebSocket safety events into a list state setter.
 * Dedupes by `id` / `event_id`.
 */
export function useLiveEventFeed(setEvents, { onEvent } = {}) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    return subscribeLiveSafetyEvents((event) => {
      setEvents((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        const id = event.id ?? event.event_id;
        if (list.some((e) => String(e.id ?? e.event_id) === String(id))) {
          return list;
        }
        return [event, ...list];
      });
      onEventRef.current?.(event);
    });
  }, [setEvents]);
}
