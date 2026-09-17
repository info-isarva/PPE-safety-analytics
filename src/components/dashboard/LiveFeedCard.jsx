import { useEffect, useMemo, useRef, useState } from "react";
import {
  getJobStreamUrl,
  getJobZones,
  getLiveVideo,
  getVideoJob,
  saveJobZones,
  uploadVideo,
} from "../../api/endpoints";
import {
  framePointsToOverlay,
  normalizeZonePoints,
  pointerToFrameCoords,
} from "./liveFeedCoords";

const POLL_MS = 2000;
const ACCEPT_VIDEO = ".mp4,video/mp4";

function statusTone(status) {
  if (status === "processing" || status === "queued") return "accent";
  if (status === "completed") return "ok";
  if (status === "failed" || status === "cancelled") return "danger";
  return "muted";
}

export function LiveFeedCard({ compact = false }) {
  const fileInputRef = useRef(null);
  const mediaRef = useRef(null);
  const stageRef = useRef(null);

  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [label, setLabel] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [streamError, setStreamError] = useState(false);
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  const [overlayTick, setOverlayTick] = useState(0);

  const [drawing, setDrawing] = useState(false);
  const [draftPoints, setDraftPoints] = useState([]);
  const [savedPoints, setSavedPoints] = useState([]);
  const [zoneMeta, setZoneMeta] = useState({
    zone_id: "zone_1",
    name: "Restricted Area",
  });
  const [savingZone, setSavingZone] = useState(false);
  const [zoneMessage, setZoneMessage] = useState(null);

  const status = job?.status || (streamUrl ? "processing" : "idle");
  const progress = Number(job?.progress ?? 0);
  const tone = statusTone(status);

  // Restore active live source on mount
  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const live = await getLiveVideo();
        if (cancelled || !live?.active || !live?.job_id) return;
        setJobId(live.job_id);
        setLabel(live.label || null);
        setStreamUrl(
          getJobStreamUrl(live.stream_url || live.job_id)
        );
        setJob({
          job_id: live.job_id,
          status: live.status,
          source_type: live.source_type,
          filename: live.label,
          stream_url: live.stream_url,
        });
      } catch {
        /* idle is fine */
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll job status while active
  useEffect(() => {
    if (!jobId) return undefined;
    let cancelled = false;

    async function poll() {
      try {
        const data = await getVideoJob(jobId);
        if (cancelled) return;
        setJob(data);
        setLabel(data.filename || label);
        if (data.stream_url) {
          setStreamUrl(getJobStreamUrl(data.stream_url));
        } else if (
          data.status === "processing" ||
          data.status === "queued" ||
          data.status === "completed"
        ) {
          setStreamUrl(getJobStreamUrl(jobId));
        }
        if (data.status === "failed") {
          setError(data.error || "Video processing failed");
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load job status");
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [jobId]);

  // Load saved zones when job is ready
  useEffect(() => {
    if (!jobId) return undefined;
    let cancelled = false;

    async function loadZones() {
      try {
        const data = await getJobZones(jobId);
        if (cancelled) return;
        const zone = data?.zones?.[0];
        if (!zone) {
          setSavedPoints([]);
          return;
        }
        setZoneMeta({
          zone_id: zone.zone_id || "zone_1",
          name: zone.name || "Restricted Area",
        });
        setSavedPoints(normalizeZonePoints(zone.points));
        if (zone.frame_width && zone.frame_height) {
          setFrameSize({
            w: Number(zone.frame_width),
            h: Number(zone.frame_height),
          });
        }
      } catch {
        /* no zones yet */
      }
    }

    loadZones();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  // Recompute overlay positions on resize / frame size change
  useEffect(() => {
    function onResize() {
      setOverlayTick((t) => t + 1);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const displayPoints = drawing ? draftPoints : savedPoints;

  const overlayPoints = useMemo(() => {
    void overlayTick;
    return framePointsToOverlay(
      displayPoints,
      mediaRef.current,
      stageRef.current
    );
  }, [displayPoints, overlayTick, frameSize.w, frameSize.h, streamUrl]);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".mp4") && file.type !== "video/mp4") {
      setError("Please upload an .mp4 video file.");
      return;
    }

    setUploading(true);
    setError(null);
    setStreamError(false);
    setZoneMessage(null);
    setDraftPoints([]);
    setSavedPoints([]);
    setDrawing(false);

    try {
      const result = await uploadVideo(file);
      const id = result.job_id;
      setJobId(id);
      setJob(result);
      setLabel(result.filename || file.name);
      setStreamUrl(getJobStreamUrl(result.stream_url || id));
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onMediaLoad() {
    const el = mediaRef.current;
    if (!el) return;
    const w = el.naturalWidth || 0;
    const h = el.naturalHeight || 0;
    if (w && h) setFrameSize({ w, h });
    setStreamError(false);
    setOverlayTick((t) => t + 1);
  }

  function handleStageClick(event) {
    if (!drawing) return;
    const coords = pointerToFrameCoords(event, mediaRef.current);
    if (!coords) return;
    setFrameSize({ w: coords.frameWidth, h: coords.frameHeight });
    setDraftPoints((prev) => [...prev, [coords.x, coords.y]]);
    setOverlayTick((t) => t + 1);
  }

  function startDrawing() {
    if (!streamUrl || !jobId) {
      setError("Upload and start a video before drawing a zone.");
      return;
    }
    setDrawing(true);
    setDraftPoints(savedPoints.length ? [...savedPoints] : []);
    setZoneMessage(null);
    setError(null);
  }

  function cancelDrawing() {
    setDrawing(false);
    setDraftPoints([]);
    setZoneMessage(null);
  }

  function clearDraft() {
    setDraftPoints([]);
    setOverlayTick((t) => t + 1);
  }

  async function saveZone() {
    if (!jobId) return;
    if (draftPoints.length < 3) {
      setZoneMessage("Add at least 3 points to form a polygon.");
      return;
    }

    const el = mediaRef.current;
    const w = frameSize.w || el?.naturalWidth || 0;
    const h = frameSize.h || el?.naturalHeight || 0;
    if (!w || !h) {
      setZoneMessage("Waiting for video frame size. Try again in a moment.");
      return;
    }

    setSavingZone(true);
    setZoneMessage(null);
    try {
      const payload = {
        zones: [
          {
            zone_id: zoneMeta.zone_id || "zone_1",
            name: zoneMeta.name || "Restricted Area",
            enabled: true,
            coordinate_space: "frame",
            frame_width: w,
            frame_height: h,
            points: draftPoints,
          },
        ],
      };
      const result = await saveJobZones(jobId, payload);
      setSavedPoints(draftPoints);
      setDrawing(false);
      setZoneMessage(result?.message || "Restricted zone saved.");
      // Refresh stream cache so overlay updates from AI
      setStreamUrl((prev) => {
        if (!prev) return prev;
        const u = new URL(prev, window.location.href);
        u.searchParams.set("_t", String(Date.now()));
        return u.toString();
      });
    } catch (err) {
      setZoneMessage(err.message || "Failed to save zone");
    } finally {
      setSavingZone(false);
    }
  }

  async function clearSavedZone() {
    if (!jobId) return;
    setSavingZone(true);
    setZoneMessage(null);
    try {
      const el = mediaRef.current;
      const w = frameSize.w || el?.naturalWidth || 1920;
      const h = frameSize.h || el?.naturalHeight || 1080;
      await saveJobZones(jobId, {
        zones: [
          {
            zone_id: zoneMeta.zone_id || "zone_1",
            name: zoneMeta.name || "Restricted Area",
            enabled: false,
            coordinate_space: "frame",
            frame_width: w,
            frame_height: h,
            points: [],
          },
        ],
      });
      setSavedPoints([]);
      setDraftPoints([]);
      setDrawing(false);
      setZoneMessage("Restricted zone cleared.");
    } catch (err) {
      // If backend rejects empty points, still clear local UI
      setSavedPoints([]);
      setDraftPoints([]);
      setDrawing(false);
      setZoneMessage(err.message || "Zone cleared locally.");
    } finally {
      setSavingZone(false);
    }
  }

  const polygonPointsAttr = overlayPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const showStream =
    Boolean(streamUrl) && status !== "failed" && status !== "cancelled";

  return (
    <section
      className={`flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-sm ${
        compact ? "" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h3 className="m-0 text-sm font-semibold text-ink">Live Feed</h3>
          <p className="m-0 text-xs text-muted">
            {label
              ? `AI-annotated stream · ${label}`
              : "Upload an .mp4 to start live AI monitoring"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={status} tone={tone} progress={progress} />
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_VIDEO}
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-elevated px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-accent/40 hover:bg-accent-soft disabled:cursor-wait disabled:opacity-70"
          >
            <UploadIcon className="h-3.5 w-3.5 text-accent" />
            {uploading ? "Uploading…" : "Upload Video"}
          </button>
        </div>
      </div>

      {(status === "queued" || status === "processing") && progress > 0 ? (
        <div className="border-b border-line px-4 py-2">
          <div className="flex items-center justify-between text-[0.7rem] font-semibold text-muted">
            <span>Processing</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="m-0 border-b border-line bg-danger-soft px-4 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      <div
        ref={stageRef}
        className={`relative flex flex-1 items-center justify-center bg-[#0b1220] ${
          compact ? "min-h-[320px]" : "min-h-[280px] sm:min-h-[360px]"
        } ${drawing ? "cursor-crosshair" : ""}`}
        onClick={handleStageClick}
      >
        {showStream && !streamError ? (
          <img
            ref={mediaRef}
            src={streamUrl}
            alt="AI annotated live feed"
            className="max-h-[520px] w-full object-contain"
            onLoad={onMediaLoad}
            onError={() => {
              // MJPEG may fail briefly while job is still queued
              if (status === "processing" || status === "completed") {
                setStreamError(true);
              }
            }}
          />
        ) : showStream && streamError ? (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <p className="m-0 text-sm font-medium text-ink">Stream unavailable</p>
            <p className="m-0 text-xs text-muted">
              Job is {status}. Retrying may help once processing advances.
            </p>
            <button
              type="button"
              className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-elevated"
              onClick={() => {
                setStreamError(false);
                setStreamUrl((prev) => {
                  if (!prev) return prev;
                  try {
                    const u = new URL(prev);
                    u.searchParams.set("_t", String(Date.now()));
                    return u.toString();
                  } catch {
                    return `${prev}${prev.includes("?") ? "&" : "?"}_t=${Date.now()}`;
                  }
                });
              }}
            >
              Retry stream
            </button>
          </div>
        ) : (
          <EmptyFeed
            uploading={uploading}
            failed={false}
            onUpload={() => fileInputRef.current?.click()}
          />
        )}

        {overlayPoints.length > 0 ? (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            {overlayPoints.length >= 3 ? (
              <polygon
                points={polygonPointsAttr}
                fill={drawing ? "rgba(220,38,38,0.22)" : "rgba(220,38,38,0.18)"}
                stroke="#dc2626"
                strokeWidth="2"
                strokeDasharray={drawing ? "6 4" : "0"}
              />
            ) : null}
            {overlayPoints.map((p, i) => (
              <g key={`${p.x}-${p.y}-${i}`}>
                <circle cx={p.x} cy={p.y} r="5" fill="#dc2626" stroke="#fff" strokeWidth="1.5" />
                <text
                  x={p.x + 8}
                  y={p.y - 8}
                  fill="#fff"
                  fontSize="11"
                  fontWeight="600"
                >
                  {i + 1}
                </text>
              </g>
            ))}
            {drawing && overlayPoints.length >= 2 ? (
              <polyline
                points={polygonPointsAttr}
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
            ) : null}
          </svg>
        ) : null}

        {drawing ? (
          <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/60 px-2.5 py-1.5 text-[0.7rem] font-semibold text-white">
            Click to add points · {draftPoints.length} point
            {draftPoints.length === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {!drawing ? (
            <>
              <button
                type="button"
                disabled={!jobId || !streamUrl}
                onClick={startDrawing}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PolygonIcon className="h-3.5 w-3.5" />
                Draw Restricted Zone
              </button>
              {savedPoints.length > 0 ? (
                <button
                  type="button"
                  disabled={savingZone}
                  onClick={clearSavedZone}
                  className="inline-flex cursor-pointer items-center rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:bg-elevated disabled:opacity-50"
                >
                  Clear Zone
                </button>
              ) : null}
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={savingZone || draftPoints.length < 3}
                onClick={saveZone}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingZone ? "Saving…" : "Save Zone"}
              </button>
              <button
                type="button"
                disabled={savingZone}
                onClick={clearDraft}
                className="inline-flex cursor-pointer items-center rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:bg-elevated"
              >
                Clear Points
              </button>
              <button
                type="button"
                disabled={savingZone}
                onClick={cancelDrawing}
                className="inline-flex cursor-pointer items-center rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:bg-elevated"
              >
                Cancel
              </button>
            </>
          )}
          {frameSize.w > 0 ? (
            <span className="ml-auto text-[0.7rem] text-dim">
              Frame {frameSize.w}×{frameSize.h}
            </span>
          ) : null}
        </div>
        {zoneMessage ? (
          <p
            className={`m-0 text-xs ${
              zoneMessage.toLowerCase().includes("fail") ||
              zoneMessage.toLowerCase().includes("least")
                ? "text-danger"
                : "text-ok"
            }`}
          >
            {zoneMessage}
          </p>
        ) : (
          <p className="m-0 text-[0.7rem] text-muted">
            Screenshots stay on Incidents as evidence. Live Feed shows AI video
            only.
          </p>
        )}
      </div>
    </section>
  );
}

function StatusChip({ status, tone, progress }) {
  const label =
    status === "processing"
      ? `Live · ${Math.round(progress || 0)}%`
      : status === "queued"
        ? "Queued"
        : status === "completed"
          ? "Completed"
          : status === "failed"
            ? "Failed"
            : status === "cancelled"
              ? "Cancelled"
              : "Idle";

  const classes =
    tone === "accent"
      ? "bg-danger-soft text-danger"
      : tone === "ok"
        ? "bg-ok-soft text-ok"
        : tone === "danger"
          ? "bg-danger-soft text-danger"
          : "bg-elevated text-muted";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold ${classes}`}
    >
      {(status === "processing" || status === "queued") && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {label}
    </span>
  );
}

function EmptyFeed({ uploading, failed, onUpload }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-panel text-muted shadow-sm">
        <CameraIcon className="h-7 w-7" />
      </div>
      <p className="m-0 text-sm font-medium text-ink">
        {failed
          ? "Could not load live stream"
          : uploading
            ? "Uploading video…"
            : "No live stream yet"}
      </p>
      <p className="m-0 max-w-sm text-xs text-muted">
        Upload an .mp4 to process with YOLO. The Live Feed will show annotated
        frames with detections and zones — not incident screenshots.
      </p>
      <button
        type="button"
        onClick={onUpload}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent-hover"
      >
        <UploadIcon className="h-3.5 w-3.5" />
        Upload Video
      </button>
    </div>
  );
}

function UploadIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 16V5" strokeLinecap="round" />
      <path d="m8 9 4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 19h16" strokeLinecap="round" />
    </svg>
  );
}

function PolygonIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 4h10l4 7-4 9H7L3 11l4-7Z" strokeLinejoin="round" />
    </svg>
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
