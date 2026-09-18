import { useEffect, useRef } from "react";
import { resolveWsUrl } from "../api/ws";
import { useToast } from "../components/common/ToastContext";

const ALERT_TYPES = new Set(["PPE_VIOLATION", "RESTRICTED_ZONE", "ZONE_VIOLATION"]);
const MIN_ALERT_GAP_MS = 2500;
const RECONNECT_BASE_MS = 1500;
const RECONNECT_MAX_MS = 30000;

function extractEventType(payload) {
  if (payload == null) return null;
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (ALERT_TYPES.has(trimmed)) return trimmed;
    try {
      return extractEventType(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  if (typeof payload !== "object") return null;

  const candidates = [
    payload.event_type,
    payload.eventType,
    payload.type,
    payload.alert_type,
    payload.alertType,
    payload?.data?.event_type,
    payload?.data?.eventType,
    payload?.data?.type,
    payload?.payload?.event_type,
    payload?.payload?.eventType,
    payload?.payload?.type,
    payload?.event?.event_type,
    payload?.event?.type,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && ALERT_TYPES.has(value)) return value;
  }
  return null;
}

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
      tag: "ppe-safety-alert",
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

/**
 * Subscribe to backend WebSocket alerts and surface them in the browser
 * (beep + Notification + toast). Backend play_alert_sound() only runs server-side.
 */
export function useViolationAlerts() {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const lastAlertAt = useRef(0);

  useEffect(() => {
    let closed = false;
    let ws = null;
    let reconnectTimer = null;
    let attempt = 0;

    function handleAlert(type, raw) {
      const now = Date.now();
      if (now - lastAlertAt.current < MIN_ALERT_GAP_MS) return;
      lastAlertAt.current = now;

      const title =
        type === "PPE_VIOLATION" ? "PPE Violation" : "Restricted Zone";
      const message = labelForType(type);
      const detail =
        raw?.message ||
        raw?.detail ||
        raw?.description ||
        raw?.payload?.message ||
        "";

      playAlertBeep();
      showBrowserNotification(
        title,
        detail ? `${message}: ${detail}` : message
      );
      toastRef.current?.error?.(detail ? `${message} — ${detail}` : message);
    }

    function connect() {
      if (closed) return;
      const url = resolveWsUrl("/ws");
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

      ws.onmessage = (event) => {
        let parsed = event.data;
        try {
          parsed =
            typeof event.data === "string"
              ? JSON.parse(event.data)
              : event.data;
        } catch {
          parsed = event.data;
        }
        const type = extractEventType(parsed);
        if (type) handleAlert(type, typeof parsed === "object" ? parsed : {});
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

    // Unlock AudioContext after first user gesture (browser autoplay policy).
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
        ws.close();
      }
    };
  }, []);
}
