import { useEffect, useRef } from "react";
import { resolveWsUrl } from "../api/ws";
import { useToast } from "../components/common/ToastContext";
import {
  emitLiveSafetyEvent,
  normalizeLiveEvent,
} from "../events/liveEventsBus";

const ALERT_TYPES = new Set(["PPE_VIOLATION", "RESTRICTED_ZONE", "ZONE_VIOLATION"]);
const RECONNECT_BASE_MS = 1500;
const RECONNECT_MAX_MS = 30000;
const SEEN_CAP = 200;

function labelForType(type) {
  if (type === "PPE_VIOLATION") return "PPE violation detected";
  if (type === "RESTRICTED_ZONE" || type === "ZONE_VIOLATION") {
    return "Restricted zone entry detected";
  }
  return "Safety alert";
}

function playAlertBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = playAlertBeep._ctx || new Ctx();
    playAlertBeep._ctx = ctx;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(660, now + 0.12);
    osc.frequency.setValueAtTime(880, now + 0.24);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.42);
  } catch {
    /* autoplay / AudioContext restrictions */
  }
}

function showBrowserNotification(title, body) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      tag: `ppe-safety-${Date.now()}`,
      renotify: true,
    });
  } catch {
    /* ignore */
  }
}

async function ensureNotificationPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      /* ignore */
    }
  }
}

function parseMessage(data) {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return data && typeof data === "object" ? data : null;
}

/**
 * Connect to `wss://<api-host>/ws/events`.
 * On PPE_VIOLATION / RESTRICTED_ZONE: beep, notification, toast, and publish for live lists.
 */
export function useViolationAlerts() {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const seenIds = useRef(new Set());

  useEffect(() => {
    let closed = false;
    let ws = null;
    let reconnectTimer = null;
    let attempt = 0;

    function remember(id) {
      const key = String(id);
      if (seenIds.current.has(key)) return false;
      seenIds.current.add(key);
      if (seenIds.current.size > SEEN_CAP) {
        const first = seenIds.current.values().next().value;
        seenIds.current.delete(first);
      }
      return true;
    }

    function handleAlert(raw) {
      const event = normalizeLiveEvent(raw);
      if (!event) return;
      if (!ALERT_TYPES.has(event.event_type)) return;
      if (!remember(event.id)) return;

      emitLiveSafetyEvent(event);

      const title =
        event.event_type === "PPE_VIOLATION"
          ? "PPE Violation"
          : "Restricted Zone";
      const message = labelForType(event.event_type);
      const detail = event.message || "";

      playAlertBeep();
      showBrowserNotification(
        title,
        detail ? `${message}: ${detail}` : message
      );
      toastRef.current?.error?.(
        detail
          ? `${message} — ${detail} (#${event.id})`
          : `${message} (#${event.id})`
      );
    }

    function connect() {
      if (closed) return;
      const url = resolveWsUrl("/ws/events");
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        attempt = 0;
        ensureNotificationPermission();
      };

      ws.onmessage = (msg) => {
        const parsed = parseMessage(msg.data);
        if (parsed) handleAlert(parsed);
      };

      ws.onerror = () => {
        /* onclose handles reconnect */
      };

      ws.onclose = () => {
        ws = null;
        if (!closed) scheduleReconnect();
      };
    }

    function scheduleReconnect() {
      if (closed || reconnectTimer) return;
      const delay = Math.min(
        RECONNECT_BASE_MS * 2 ** attempt,
        RECONNECT_MAX_MS
      );
      attempt += 1;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    }

    const unlock = () => {
      playAlertBeep._ctx =
        playAlertBeep._ctx ||
        (window.AudioContext || window.webkitAudioContext
          ? new (window.AudioContext || window.webkitAudioContext)()
          : null);
      if (playAlertBeep._ctx?.state === "suspended") {
        playAlertBeep._ctx.resume().catch(() => {});
      }
      ensureNotificationPermission();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    connect();

    return () => {
      closed = true;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);
}
