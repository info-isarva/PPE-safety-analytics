import { useEffect, useRef, useState } from "react";

/**
 * Play multipart MJPEG with custom headers (needed for ngrok).
 * Frames update the <img> via ref to avoid React re-render flicker.
 */
export function MjpegStreamPlayer({
  url,
  className,
  alt = "Live stream",
  mediaRef,
  onFrame,
  onError,
  onEmpty,
  emptyTimeoutMs = 8000,
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef(null);
  const blobRef = useRef(null);
  const gotFrameRef = useRef(false);
  const reportedSizeRef = useRef("");

  // Keep latest callbacks without retriggering the stream effect
  const onFrameRef = useRef(onFrame);
  const onErrorRef = useRef(onError);
  const onEmptyRef = useRef(onEmpty);
  onFrameRef.current = onFrame;
  onErrorRef.current = onError;
  onEmptyRef.current = onEmpty;

  useEffect(() => {
    if (!url) {
      setReady(false);
      setFailed(false);
      gotFrameRef.current = false;
      reportedSizeRef.current = "";
      return undefined;
    }

    const controller = new AbortController();
    let cancelled = false;
    gotFrameRef.current = false;
    reportedSizeRef.current = "";
    setFailed(false);
    setReady(false);

    const emptyTimer = window.setTimeout(() => {
      if (!gotFrameRef.current && !cancelled) {
        onEmptyRef.current?.();
        setFailed(true);
      }
    }, emptyTimeoutMs);

    async function run() {
      try {
        const response = await fetch(url, {
          headers: {
            Accept: "multipart/x-mixed-replace,image/jpeg,*/*",
            "ngrok-skip-browser-warning": "true",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Stream failed (${response.status})`);
        }
        if (!response.body) {
          throw new Error("Stream body unavailable");
        }

        const reader = response.body.getReader();
        let buffer = new Uint8Array(0);

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value?.length) continue;

          const merged = new Uint8Array(buffer.length + value.length);
          merged.set(buffer);
          merged.set(value, buffer.length);
          buffer = merged;

          while (true) {
            const start = indexOfBytes(buffer, [0xff, 0xd8]);
            if (start < 0) {
              buffer = buffer.slice(Math.max(0, buffer.length - 1));
              break;
            }
            const endRel = indexOfBytes(buffer.slice(start + 2), [0xff, 0xd9]);
            if (endRel < 0) {
              buffer = buffer.slice(start);
              break;
            }
            const end = start + 2 + endRel + 2;
            const jpeg = buffer.slice(start, end);
            buffer = buffer.slice(end);
            publishFrame(jpeg);
          }

          if (buffer.length > 2_000_000) {
            buffer = buffer.slice(buffer.length - 64_000);
          }
        }

        if (!gotFrameRef.current && !cancelled) {
          setFailed(true);
          onEmptyRef.current?.();
        }
      } catch (err) {
        if (cancelled || err?.name === "AbortError") return;
        setFailed(true);
        onErrorRef.current?.(err);
      }
    }

    function publishFrame(jpegBytes) {
      if (cancelled || !jpegBytes?.length) return;

      const blob = new Blob([jpegBytes], { type: "image/jpeg" });
      const nextUrl = URL.createObjectURL(blob);
      const prevUrl = blobRef.current;
      blobRef.current = nextUrl;

      const img = imgRef.current;
      if (img) {
        img.src = nextUrl;
      }

      const first = !gotFrameRef.current;
      gotFrameRef.current = true;
      if (first) setReady(true);

      // Revoke previous blob after the browser swaps the image
      if (prevUrl) {
        window.setTimeout(() => URL.revokeObjectURL(prevUrl), 250);
      }
    }

    run();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(emptyTimer);
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [url, emptyTimeoutMs]);

  function setRefs(node) {
    imgRef.current = node;
    if (!mediaRef) return;
    if (typeof mediaRef === "function") mediaRef(node);
    else mediaRef.current = node;
  }

  function handleImgLoad() {
    const img = imgRef.current;
    if (!img) return;
    const key = `${img.naturalWidth}x${img.naturalHeight}`;
    if (key !== reportedSizeRef.current && img.naturalWidth > 0) {
      reportedSizeRef.current = key;
      onFrameRef.current?.();
    }
  }

  if (failed && !ready) {
    return null;
  }

  return (
    <>
      {!ready ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-white/80">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-white/25 border-t-accent" />
          <p className="m-0 text-xs font-medium text-white">Connecting to live stream…</p>
        </div>
      ) : null}
      <img
        ref={setRefs}
        alt={alt}
        className={`${className} ${ready ? "opacity-100" : "opacity-0"}`}
        onLoad={handleImgLoad}
      />
    </>
  );
}

function indexOfBytes(haystack, needle) {
  outer: for (let i = 0; i <= haystack.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}
