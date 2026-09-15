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
| `/live` | Placeholder (Phase 11) |
| `/reports` | Placeholder (Phase 14) |
