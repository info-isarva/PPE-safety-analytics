import { useEffect, useState } from "react";

export function ScreenshotViewer({ src, alt = "Safety event screenshot" }) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(Boolean(src));

  useEffect(() => {
    let revoked = null;
    let cancelled = false;

    async function load() {
      setFailed(false);
      setObjectUrl(null);

      if (!src) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(src, {
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
        });
        if (!response.ok) throw new Error("Screenshot request failed");
        const blob = await response.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revoked = url;
        setObjectUrl(url);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [src]);

  const emptyShell =
    "flex min-h-72 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-elevated px-6 py-10 text-center text-muted";

  if (!src) {
    return (
      <div className={emptyShell}>
        <CameraOffIcon />
        <p className="m-0 text-sm font-medium">No screenshot available for this event.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={emptyShell}>
        <div
          className="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-accent"
          aria-hidden="true"
        />
        <p className="m-0 text-sm font-medium">Loading screenshot…</p>
      </div>
    );
  }

  if (failed || !objectUrl) {
    return (
      <div className={emptyShell}>
        <CameraOffIcon />
        <p className="m-0 text-sm font-medium">Could not load screenshot.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-[#0b1220] shadow-inner">
      <img
        src={objectUrl}
        alt={alt}
        className="mx-auto block h-auto max-h-[72vh] w-full object-contain"
      />
    </div>
  );
}

function CameraOffIcon() {
  return (
    <svg
      className="h-8 w-8 text-dim"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path
        d="m3 3 18 18M10 7h7l3 3v7M7 7H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
