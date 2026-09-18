import { API_BASE_URL } from "./client";

/** Build WebSocket URL from API base (http→ws, https→wss). Default: /ws/events */
export function resolveWsUrl(path = "/ws/events") {
  const override = import.meta.env.VITE_WS_URL;
  if (override) return String(override).replace(/\/$/, "");

  const wsPath = (
    import.meta.env.VITE_WS_PATH || path
  ).startsWith("/")
    ? import.meta.env.VITE_WS_PATH || path
    : `/${import.meta.env.VITE_WS_PATH || path}`;

  try {
    const base = new URL(API_BASE_URL);
    const protocol = base.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${base.host}${wsPath}`;
  } catch {
    const protocol = API_BASE_URL.startsWith("https") ? "wss" : "ws";
    const host = API_BASE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `${protocol}://${host}${wsPath}`;
  }
}
