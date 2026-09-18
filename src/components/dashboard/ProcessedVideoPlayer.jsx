import { useEffect, useRef, useState } from "react";

/** Load /video/processed file with ngrok header, then play via blob URL. */
export function ProcessedVideoPlayer({
  url,
  className,
  mediaRef,
  onReady,
  onError,
}) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(Boolean(url));
  const blobRef = useRef(null);
  const localRef = useRef(null);

  useEffect(() => {
    if (!url) {
      setSrc(null);
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setSrc(null);

    async function load() {
      try {
        const response = await fetch(url, {
          headers: { "ngrok-skip-browser-warning": "true" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Video not found (${response.status})`);
        const blob = await response.blob();
        if (cancelled) return;
        // Reject HTML interstitial mistaken as video
        if (blob.type.includes("text/html")) {
          throw new Error("Received HTML instead of video");
        }
        const objectUrl = URL.createObjectURL(blob);
        if (blobRef.current) URL.revokeObjectURL(blobRef.current);
        blobRef.current = objectUrl;
        setSrc(objectUrl);
        setLoading(false);
      } catch (err) {
        if (cancelled || err?.name === "AbortError") return;
        setLoading(false);
        onError?.(err);
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [url, onError]);

  function setRefs(node) {
    localRef.current = node;
    if (!mediaRef) return;
    if (typeof mediaRef === "function") mediaRef(node);
    else mediaRef.current = node;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-6 text-white/80">
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-white/25 border-t-accent" />
        <p className="m-0 text-xs font-medium text-white">Loading processed video…</p>
      </div>
    );
  }

  if (!src) return null;

  return (
    <video
      ref={setRefs}
      src={src}
      controls
      playsInline
      autoPlay
      className={className}
      onLoadedMetadata={onReady}
      onLoadedData={onReady}
    />
  );
}
