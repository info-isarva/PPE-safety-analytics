/** Tiny pub/sub so one WebSocket can feed alerts + live lists. */
const LIVE_EVENT = "ppe-safety-event";

const target =
  typeof window !== "undefined" && typeof EventTarget !== "undefined"
    ? new EventTarget()
    : null;

export function emitLiveSafetyEvent(event) {
  if (!target || !event) return;
  target.dispatchEvent(new CustomEvent(LIVE_EVENT, { detail: event }));
}

export function subscribeLiveSafetyEvents(handler) {
  if (!target) return () => {};
  const listener = (e) => handler(e.detail);
  target.addEventListener(LIVE_EVENT, listener);
  return () => target.removeEventListener(LIVE_EVENT, listener);
}

/** Map backend WS payload to dashboard event shape (`id` used by UI routes). */
export function normalizeLiveEvent(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = raw.event_id ?? raw.id;
  if (id == null) return null;
  const event_type = raw.event_type || raw.type;
  return {
    ...raw,
    id,
    event_id: id,
    event_type,
    person_id: raw.person_id ?? raw.personId ?? null,
    message: raw.message || "",
    violation: raw.violation || raw.message || null,
    timestamp: raw.timestamp || new Date().toISOString(),
  };
}
