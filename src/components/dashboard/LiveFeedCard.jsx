import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getScreenshotUrl } from "../../api/endpoints";

export function LiveFeedCard({ latestEvent }) {
  const src = latestEvent ? getScreenshotUrl(latestEvent.screenshot_url) : null;
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    let revoked = null;
    let cancelled = false;

    async function load() {
      setImageUrl(null);
      if (!src) return;
      try {
        const response = await fetch(src, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        if (!response.ok) throw new Error("failed");
        const blob = await response.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revoked = url;
        setImageUrl(url);
      } catch {
        if (!cancelled) setImageUrl(null);
      }
    }

    load();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [src]);

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h3 className="m-0 text-sm font-semibold text-ink">Live Feed</h3>
          <p className="m-0 text-xs text-muted">
            {latestEvent
              ? `Latest capture · Event #${latestEvent.id}`
              : "Waiting for camera / pipeline frames"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-[0.7rem] font-semibold text-danger">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
          LIVE
        </span>
      </div>

      <div className="relative flex min-h-[260px] flex-1 items-center justify-center bg-[#0b1220] sm:min-h-[320px]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={
              latestEvent?.violation
                ? `Frame: ${latestEvent.violation}`
                : "Latest safety frame"
            }
            className="max-h-[480px] w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-panel text-muted shadow-sm">
              <CameraIcon className="h-7 w-7" />
            </div>
            <p className="m-0 text-sm font-medium text-ink">No live frame yet</p>
            <p className="m-0 max-w-sm text-xs text-muted">
              WebSocket / RTSP live video arrives in Phase 11–12. Until then, the
              newest event screenshot appears here.
            </p>
            <Link
              to="/live"
              className="text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400"
            >
              Open Live Monitor →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function CameraIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 8h4l2-2h6l2 2h4v11H3V8Z" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
