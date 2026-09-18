import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getJobStreamUrl,
  getJobZones,
  getLiveVideo,
  getVideoJob,
  getVideoJobs,
  resolveProcessedVideoUrl,
  saveJobZones,
  stopVideoJob,
  uploadVideo,
} from "../../api/endpoints";
import { useToast } from "../common/ToastContext";
import { MjpegStreamPlayer } from "./MjpegStreamPlayer";
import { ProcessedVideoPlayer } from "./ProcessedVideoPlayer";
import {
  framePointsToOverlay,
  normalizeZonePoints,
  pointerToFrameCoords,
} from "./liveFeedCoords";
import {
  formatBytes,
  isMp4File,
  MAX_UPLOAD_BYTES,
  normalizeJobsList,
  patchJobInList,
  upsertJobInList,
} from "./jobHistory";

const POLL_MS = 2000;
const HISTORY_POLL_MS = 8000;
const ACCEPT_VIDEO = ".mp4,video/mp4";

function statusTone(status) {
  if (status === "processing" || status === "queued") return "accent";
  if (status === "completed") return "ok";
  if (status === "failed" || status === "cancelled") return "danger";
  return "muted";
}

export function LiveFeedCard({ compact = false }) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const mediaRef = useRef(null);
  const stageRef = useRef(null);

  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [label, setLabel] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState(null);
  const [streamError, setStreamError] = useState(false);
  const [streamEmpty, setStreamEmpty] = useState(false);
  const [processedUrl, setProcessedUrl] = useState(null);
  const [processedOk, setProcessedOk] = useState(false);
  const [frameSize, setFrameSize] = useState({ w: 0, h: 0 });
  const [overlayTick, setOverlayTick] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(null);

  const [drawing, setDrawing] = useState(false);
  const [draftPoints, setDraftPoints] = useState([]);
  const [savedPoints, setSavedPoints] = useState([]);
  const [zoneMeta, setZoneMeta] = useState({
    zone_id: "zone_1",
    name: "Restricted Area",
  });
  const [savingZone, setSavingZone] = useState(false);

  const status = job?.status || (streamUrl ? "processing" : "idle");
  const progress = Number(job?.progress ?? 0);
  const tone = statusTone(status);
  const canStop =
    Boolean(jobId) && (status === "queued" || status === "processing");

  const refreshHistory = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);
    try {
      const data = await getVideoJobs({ signal: controller.signal });
      setHistory(normalizeJobsList(data));
      setHistoryError(null);
    } catch (err) {
      if (err?.name === "AbortError") {
        setHistoryError("Job list timed out. Backend /video/jobs may be busy.");
      } else {
        setHistoryError(err.message || "Could not load job history");
      }
    } finally {
      window.clearTimeout(timeoutId);
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!cancelled) await refreshHistory();
    }
    load();
    const id = setInterval(() => {
      if (!cancelled) refreshHistory();
    }, HISTORY_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refreshHistory]);

  const activateJob = useCallback((data, filename) => {
    const id = data.job_id;
    const name = data.filename || filename || null;
    setJobId(id);
    setJob(data);
    setLabel(name);
    setStreamUrl(getJobStreamUrl(data.stream_url || id));
    setProcessedUrl(resolveProcessedVideoUrl(data));
    setProcessedOk(false);
    setStreamError(false);
    setStreamEmpty(false);
    setError(null);
    setDraftPoints([]);
    setSavedPoints([]);
    setDrawing(false);
    setHistory((prev) =>
      upsertJobInList(prev, {
        job_id: id,
        filename: name,
        status: data.status,
        progress: data.progress,
        source_type: data.source_type,
        stream_url: data.stream_url,
        started_at: data.started_at,
      })
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const live = await getLiveVideo();
        if (cancelled || !live?.active || !live?.job_id) return;
        activateJob(
          {
            job_id: live.job_id,
            status: live.status,
            source_type: live.source_type,
            filename: live.label,
            stream_url: live.stream_url,
          },
          live.label
        );
      } catch {
        /* idle */
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [activateJob]);

  useEffect(() => {
    if (!jobId) return undefined;
    let cancelled = false;

    async function poll() {
      try {
        const data = await getVideoJob(jobId);
        if (cancelled) return;
        setJob(data);
        setLabel((prev) => data.filename || prev);
        setProcessedUrl(resolveProcessedVideoUrl(data));
        if (data.stream_url) {
          const next = getJobStreamUrl(data.stream_url);
          setStreamUrl((prev) => (prev === next ? prev : next));
        } else if (
          data.status === "processing" ||
          data.status === "queued" ||
          data.status === "completed"
        ) {
          const next = getJobStreamUrl(jobId);
          setStreamUrl((prev) => (prev === next ? prev : next));
        }
        if (data.status === "completed") {
          // Completed jobs often stop sending MJPEG frames
          setStreamEmpty(false);
        }
        setHistory((prev) =>
          patchJobInList(prev, jobId, {
            status: data.status,
            progress: data.progress,
            filename: data.filename,
            stream_url: data.stream_url,
          })
        );
        if (data.status === "failed") {
          const msg = data.error || "Video processing failed";
          setError(msg);
          toast.error(msg);
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
  }, [jobId, toast]);

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
        /* no zones */
      }
    }

    loadZones();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  useEffect(() => {
    function onResize() {
      setOverlayTick((t) => t + 1);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const draftPointsRef = useRef(draftPoints);
  draftPointsRef.current = draftPoints;

  useEffect(() => {
    function onKey(event) {
      if (!drawing) return;
      if (event.key === "Escape") {
        setDrawing(false);
        setDraftPoints([]);
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const points = draftPointsRef.current;
        if (points.length >= 3 && !savingZone) {
          // trigger save via button path
          document.getElementById("ppe-save-zone-btn")?.click();
        }
      }
      if (
        (event.key === "Backspace" || event.key === "Delete") &&
        draftPointsRef.current.length
      ) {
        event.preventDefault();
        setDraftPoints((prev) => prev.slice(0, -1));
        setOverlayTick((t) => t + 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawing, savingZone]);

  const displayPoints = drawing ? draftPoints : savedPoints;

  const overlayPoints = useMemo(() => {
    void overlayTick;
    return framePointsToOverlay(
      displayPoints,
      mediaRef.current,
      stageRef.current
    );
  }, [displayPoints, overlayTick, frameSize.w, frameSize.h, streamUrl]);

  async function processFile(file) {
    if (!file) return;

    if (!isMp4File(file)) {
      const msg = "Please upload an .mp4 video file.";
      setError(msg);
      toast.error(msg);
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      const msg = `File is too large (max ${formatBytes(MAX_UPLOAD_BYTES)}).`;
      setError(msg);
      toast.error(msg);
      return;
    }

    setUploading(true);
    setError(null);
    setStreamError(false);
    setDraftPoints([]);
    setSavedPoints([]);
    setDrawing(false);

    try {
      const result = await uploadVideo(file);
      activateJob(result, file.name);
      toast.success(`Uploaded ${result.filename || file.name}`);
      refreshHistory();
    } catch (err) {
      const msg = err.message || "Upload failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    processFile(file);
  }

  function onDrop(event) {
    event.preventDefault();
    setDragOver(false);
    if (drawing || uploading) return;
    const file = event.dataTransfer.files?.[0];
    processFile(file);
  }

  function onMediaLoad() {
    const el = mediaRef.current;
    if (!el) return;
    const w = el.naturalWidth || el.videoWidth || 0;
    const h = el.naturalHeight || el.videoHeight || 0;
    if (w && h) {
      setFrameSize((prev) =>
        prev.w === w && prev.h === h ? prev : { w, h }
      );
    }
    setStreamError(false);
    setOverlayTick((t) => t + 1);
  }

  // Stable callbacks so stream player does not reconnect every render
  const onMediaLoadRef = useRef(onMediaLoad);
  onMediaLoadRef.current = onMediaLoad;
  const statusRef = useRef(status);
  statusRef.current = status;

  const handleStreamFrame = useCallback(() => {
    onMediaLoadRef.current();
  }, []);

  const handleStreamEmpty = useCallback(() => {
    setStreamEmpty(true);
    if (statusRef.current === "completed") {
      setProcessedOk(false);
    } else {
      setStreamError(true);
    }
  }, []);

  const handleStreamError = useCallback(() => {
    if (statusRef.current === "completed") {
      setStreamEmpty(true);
    } else {
      setStreamError(true);
    }
  }, []);


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
      toast.info("Upload a video before drawing a zone.");
      return;
    }
    setDrawing(true);
    setDraftPoints(savedPoints.length ? [...savedPoints] : []);
    setError(null);
  }

  function cancelDrawing() {
    setDrawing(false);
    setDraftPoints([]);
  }

  function clearDraft() {
    setDraftPoints([]);
    setOverlayTick((t) => t + 1);
  }

  async function saveZone() {
    if (!jobId) return;
    if (draftPoints.length < 3) {
      toast.error("Add at least 3 points to form a polygon.");
      return;
    }

    const el = mediaRef.current;
    const w = frameSize.w || el?.naturalWidth || 0;
    const h = frameSize.h || el?.naturalHeight || 0;
    if (!w || !h) {
      toast.info("Waiting for video frame size. Try again in a moment.");
      return;
    }

    setSavingZone(true);
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
      toast.success(result?.message || "Restricted zone saved.");
      setStreamUrl((prev) => bumpStreamCache(prev));
    } catch (err) {
      toast.error(err.message || "Failed to save zone");
    } finally {
      setSavingZone(false);
    }
  }

  async function clearSavedZone() {
    if (!jobId) return;
    setSavingZone(true);
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
      toast.success("Restricted zone cleared.");
    } catch (err) {
      setSavedPoints([]);
      setDraftPoints([]);
      setDrawing(false);
      toast.info(err.message || "Zone cleared locally.");
    } finally {
      setSavingZone(false);
    }
  }

  async function handleStop() {
    if (!jobId || !canStop) return;
    setStopping(true);
    try {
      const result = await stopVideoJob(jobId);
      setJob((prev) => ({ ...prev, ...result, status: result.status || "cancelled" }));
      setHistory((prev) =>
        patchJobInList(prev, jobId, { status: result.status || "cancelled" })
      );
      toast.info("Processing stopped.");
      refreshHistory();
    } catch (err) {
      toast.error(err.message || "Could not stop job");
    } finally {
      setStopping(false);
    }
  }

  async function reopenJob(entry) {
    if (!entry?.job_id || uploading) return;
    try {
      const data = await getVideoJob(entry.job_id);
      activateJob(data, entry.filename);
      toast.info(`Opened ${data.filename || entry.filename}`);
    } catch (err) {
      toast.error(err.message || "Could not open job");
    }
  }

  const polygonPointsAttr = overlayPoints.map((p) => `${p.x},${p.y}`).join(" ");
  const showStream =
    Boolean(streamUrl) && status !== "failed" && status !== "cancelled";

  return (
    <div
      className={`grid h-full gap-3 ${
        compact ? "lg:grid-cols-[minmax(0,1fr)_240px]" : "grid-cols-1"
      }`}
    >
      <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h3 className="m-0 text-sm font-semibold text-ink">Live Feed</h3>
            <p className="m-0 text-xs text-muted">
              {label
                ? `AI-annotated stream · ${label}`
                : "Drop an .mp4 or click Upload to start"}
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
            {canStop ? (
              <button
                type="button"
                disabled={stopping}
                onClick={handleStop}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-danger/30 bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger hover:opacity-90 disabled:opacity-60"
              >
                {stopping ? "Stopping…" : "Stop"}
              </button>
            ) : null}
          </div>
        </div>

        {(status === "queued" || status === "processing") && (
          <div className="border-b border-line px-4 py-2">
            <div className="flex items-center justify-between text-[0.7rem] font-semibold text-muted">
              <span>{status === "queued" ? "Queued" : "Processing"}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(progress, 4))}%` }}
              />
            </div>
          </div>
        )}

        {error ? (
          <p className="m-0 border-b border-line bg-danger-soft px-4 py-2 text-xs text-danger">
            {error}
          </p>
        ) : null}

        <div
          ref={stageRef}
          className={`relative flex flex-1 items-center justify-center bg-[#0b1220] transition-colors ${
            compact ? "min-h-[360px]" : "min-h-[280px] sm:min-h-[360px]"
          } ${drawing ? "cursor-crosshair" : ""} ${
            dragOver ? "ring-2 ring-inset ring-accent" : ""
          }`}
          onClick={handleStageClick}
          onDragEnter={(e) => {
            e.preventDefault();
            if (!drawing) setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDragLeave={(e) => {
            if (!stageRef.current?.contains(e.relatedTarget)) {
              setDragOver(false);
            }
          }}
          onDrop={onDrop}
        >
          {dragOver ? (
            <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-accent/15">
              <p className="m-0 rounded-xl bg-panel px-4 py-2 text-sm font-semibold text-ink shadow">
                Drop .mp4 to upload
              </p>
            </div>
          ) : null}

          {showStream && !streamError && !streamEmpty ? (
            <MjpegStreamPlayer
              key={jobId || streamUrl}
              url={streamUrl}
              mediaRef={mediaRef}
              alt="AI annotated live feed"
              className="max-h-[520px] w-full object-contain"
              onFrame={handleStreamFrame}
              onEmpty={handleStreamEmpty}
              onError={handleStreamError}
            />
          ) : showStream && (streamEmpty || streamError) && processedUrl ? (
            <div className="flex w-full flex-col items-center gap-3 p-4">
              {status === "completed" ? (
                <p className="m-0 text-center text-xs font-medium text-white/80">
                  Live frame stream ended. Playing processed video…
                </p>
              ) : null}
              <ProcessedVideoPlayer
                key={processedUrl}
                url={processedUrl}
                mediaRef={mediaRef}
                className="max-h-[520px] w-full object-contain"
                onReady={() => {
                  setProcessedOk(true);
                  setStreamError(false);
                  onMediaLoad();
                }}
                onError={() => {
                  setProcessedOk(false);
                  setProcessedUrl(null);
                  setStreamError(true);
                }}
              />
              <button
                type="button"
                className="rounded-xl border border-white/35 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
                onClick={() => {
                  setStreamError(false);
                  setStreamEmpty(false);
                  setStreamUrl((prev) => bumpStreamCache(prev));
                }}
              >
                Retry live stream
              </button>
            </div>
          ) : showStream && (streamError || streamEmpty) ? (
            <div className="flex max-w-lg flex-col items-center gap-3 rounded-2xl border border-white/15 bg-black/35 px-5 py-6 text-center backdrop-blur-sm">
              <p className="m-0 text-base font-semibold text-white">
                {status === "completed"
                  ? "Processing complete"
                  : "Stream unavailable"}
              </p>
              <p className="m-0 text-sm leading-relaxed text-white/75">
                {status === "completed" ? (
                  <>
                    This job finished, but the backend is not providing video
                    frames on <span className="font-mono text-amber-300">/stream</span>
                    , and there is no{" "}
                    <span className="font-mono text-amber-300">processed_url</span>{" "}
                    on the job. Ask backend to either replay annotated frames
                    after completion or return a working processed video URL.
                  </>
                ) : (
                  <>
                    Job is <strong className="text-white">{status}</strong>. The
                    live stream returned no frames.
                  </>
                )}
              </p>
              <button
                type="button"
                className="rounded-xl border border-white/35 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20"
                onClick={() => {
                  setStreamError(false);
                  setStreamEmpty(false);
                  setStreamUrl((prev) => bumpStreamCache(prev));
                }}
              >
                Retry stream
              </button>
            </div>
          ) : (
            <EmptyFeed
              uploading={uploading}
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
                  fill={
                    drawing ? "rgba(220,38,38,0.22)" : "rgba(220,38,38,0.18)"
                  }
                  stroke="#dc2626"
                  strokeWidth="2"
                  strokeDasharray={drawing ? "6 4" : "0"}
                />
              ) : null}
              {overlayPoints.map((p, i) => (
                <g key={`${p.x}-${p.y}-${i}`}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="5"
                    fill="#dc2626"
                    stroke="#fff"
                    strokeWidth="1.5"
                  />
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
              Click points · Enter save · Esc cancel · {draftPoints.length} pts
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
                  id="ppe-save-zone-btn"
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
          <p className="m-0 text-[0.7rem] text-muted">
            Max upload {formatBytes(MAX_UPLOAD_BYTES)}. Screenshots stay on
            Incidents as evidence only.
          </p>
        </div>
      </section>

      {compact ? (
        <JobHistoryPanel
          history={history}
          activeId={jobId}
          onOpen={reopenJob}
          disabled={uploading}
          loading={historyLoading}
          error={historyError}
          onRetry={() => {
            setHistoryLoading(true);
            setHistoryError(null);
            refreshHistory();
          }}
        />
      ) : history.length > 0 ? (
        <div className="rounded-2xl border border-line bg-panel px-3 py-2 shadow-sm">
          <p className="m-0 mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
            Recent jobs
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {history.slice(0, 5).map((item) => (
              <button
                key={item.job_id}
                type="button"
                disabled={uploading}
                onClick={() => reopenJob(item)}
                className={`shrink-0 cursor-pointer rounded-xl border px-2.5 py-1.5 text-left text-xs transition-colors ${
                  item.job_id === jobId
                    ? "border-accent bg-accent-soft"
                    : "border-line hover:bg-elevated"
                }`}
              >
                <span className="block max-w-[9rem] truncate font-semibold text-ink">
                  {item.filename}
                </span>
                <span className="text-dim">{item.status}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function bumpStreamCache(prev) {
  if (!prev) return prev;
  try {
    const u = new URL(prev, window.location.href);
    u.searchParams.set("_t", String(Date.now()));
    return u.toString();
  } catch {
    return `${prev}${prev.includes("?") ? "&" : "?"}_t=${Date.now()}`;
  }
}

function JobHistoryPanel({
  history,
  activeId,
  onOpen,
  disabled,
  loading,
  error,
  onRetry,
}) {
  return (
    <aside className="rounded-2xl border border-line bg-panel p-3 shadow-sm">
      <h4 className="m-0 text-sm font-semibold text-ink">Job history</h4>
      <p className="m-0 mt-0.5 text-[0.7rem] text-muted">
        From server · reopen any upload
      </p>
      {loading && history.length === 0 ? (
        <p className="mt-4 m-0 text-xs text-muted">Loading jobs…</p>
      ) : error && history.length === 0 ? (
        <div className="mt-4 flex flex-col gap-2">
          <p className="m-0 text-xs text-danger">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="cursor-pointer rounded-lg border border-line px-2 py-1.5 text-xs font-semibold text-ink hover:bg-elevated"
          >
            Retry
          </button>
        </div>
      ) : history.length === 0 ? (
        <p className="mt-4 m-0 text-xs text-muted">No jobs yet.</p>
      ) : (
        <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
          {error ? (
            <li className="text-[0.65rem] text-danger">{error}</li>
          ) : null}
          {history.map((item) => (
            <li key={item.job_id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onOpen(item)}
                className={`w-full cursor-pointer rounded-xl border px-2.5 py-2 text-left transition-colors ${
                  item.job_id === activeId
                    ? "border-accent bg-accent-soft"
                    : "border-line hover:bg-elevated"
                }`}
              >
                <span className="block truncate text-xs font-semibold text-ink">
                  {item.filename}
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2 text-[0.65rem] text-muted">
                  <span className="truncate font-mono">{item.job_id}</span>
                  <span>{item.status}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
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

function EmptyFeed({ uploading, onUpload }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-white/10 text-white/80 shadow-sm">
        <CameraIcon className="h-7 w-7" />
      </div>
      <p className="m-0 text-sm font-semibold text-white">
        {uploading ? "Uploading video…" : "Drop an .mp4 here"}
      </p>
      <p className="m-0 max-w-sm text-xs text-white/70">
        AI-annotated stream with detections and zones. Not incident screenshots.
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
