# PPE Safety Analytics — Frontend

React + Vite + **Tailwind CSS** dashboard for the PPE Safety Analytics Platform.

## Desktop exe note

Tailwind is CSS only. It works the same in:

- Browser (`npm run dev`)
- Packaged desktop apps that embed a webview (**Electron**, **Tauri**, etc.)

It does **not** style native WinForms/WPF/Qt widgets. For a `.exe`, wrap this React app in Electron or Tauri — Tailwind classes still apply.

## Setup

```bash
cd frontend
npm install
```

Set API URL in `.env`:

```env
VITE_API_BASE_URL=https://tapeless-juvenile-drainer.ngrok-free.dev
```

Or local:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Optional WebSocket alert URL (defaults to `wss://<api-host>/ws/events`):

```env
# VITE_WS_PATH=/ws/events
# VITE_WS_URL=wss://tapeless-juvenile-drainer.ngrok-free.dev/ws/events
```

Live events: dashboard connects to `/ws/events` for `PPE_VIOLATION` / `RESTRICTED_ZONE` — updates lists live and plays a browser beep (no page refresh).

## Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Pages

| Route | Description |
|-------|-------------|
| `/` | Overview — KPIs, PPE chart, recent incidents |
| `/incidents` | Filterable incident list |
| `/incidents/:id` | Event detail + screenshot |
| `/live` | Live Monitor — upload, MJPEG stream, zones |
| `/reports` | Placeholder (Phase 14) |

**Browser alerts:** Connects to `/ws/events` for `PPE_VIOLATION` / `RESTRICTED_ZONE` — live list updates + beep + notification + toast.
