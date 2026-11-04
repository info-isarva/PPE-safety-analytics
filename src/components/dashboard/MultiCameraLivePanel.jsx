import { useMemo, useState } from "react";
import {
  getJobStreamUrl,
  normalizeCameraBatchResult,
  startAllCameras,
  stopAllCameras,
} from "../../api/endpoints";
import { useCameraSources } from "../../cameras/CameraSourcesContext";
import { useToast } from "../common/ToastContext";
import { MjpegStreamPlayer } from "./MjpegStreamPlayer";

function feedKey(item) {
  return item.camera_id || item.job_id || item.stream_url;
}

function isPlayable(item) {
  if (!item?.stream_url) return false;
  const s = String(item.status || "").toLowerCase();
  return (
    s === "starting" ||
    s === "processing" ||
    s === "running" ||
    s === "already_running" ||
    !s
  );
}

export function MultiCameraLivePanel() {
  const toast = useToast();
  const { refreshCameras, patchLocalCamera } = useCameraSources();
  const [busy, setBusy] = useState(false);
  const [feeds, setFeeds] = useState([]);
  const [summary, setSummary] = useState(null);

  const playable = useMemo(() => feeds.filter(isPlayable), [feeds]);

  function applyLocalPatches(results, { clearing = false } = {}) {
    for (const raw of results || []) {
      const row = normalizeCameraBatchResult(raw);
      if (!row?.camera_id) continue;
      if (clearing) {
        patchLocalCamera(row.camera_id, {
          status: row.status || "stopping",
          job_id: null,
          stream_url: null,
        });
      } else {
        patchLocalCamera(row.camera_id, {
          status: row.status || "starting",
          job_id: row.job_id ?? null,
          stream_url: row.stream_url ?? null,
        });
      }
    }
  }

  async function handleStartAll() {
    setBusy(true);
    try {
      const data = await startAllCameras();
      const results = (Array.isArray(data?.results) ? data.results : [])
        .map(normalizeCameraBatchResult)
        .filter(Boolean);
      setFeeds(results);
      setSummary({
        kind: "start",
        started: Number(data?.started ?? 0),
        already_running: Number(data?.already_running ?? 0),
        skipped: Number(data?.skipped ?? 0),
        failed: Number(data?.failed ?? 0),
      });
      applyLocalPatches(results);
      toast.success(
        `Start all · ${data?.started ?? 0} starting · ${data?.already_running ?? 0} already running`
      );
      refreshCameras().catch(() => {});
    } catch (err) {
      toast.error(err.message || "Could not start all cameras");
    } finally {
      setBusy(false);
    }
  }

  async function handleStopAll() {
    setBusy(true);
    try {
      const data = await stopAllCameras();
      const results = (Array.isArray(data?.results) ? data.results : [])
        .map(normalizeCameraBatchResult)
        .filter(Boolean);
      setFeeds((prev) =>
        prev.map((f) => {
          const match = results.find((r) => r.camera_id === f.camera_id);
          if (!match) {
            return { ...f, status: "stopping", stream_url: null };
          }
          return {
            ...f,
            ...match,
            stream_url: null,
          };
        })
      );
      setSummary({
        kind: "stop",
        status: data?.status || "stopping",
        requested: Number(data?.requested ?? 0),
        already_stopped: Number(data?.already_stopped ?? 0),
        failed: Number(data?.failed ?? 0),
      });
      applyLocalPatches(results, { clearing: true });
      toast.info(
        data?.status === "already_stopped"
          ? "All cameras already stopped"
          : `Stop all requested · ${data?.requested ?? 0} cameras`
      );
      refreshCameras().catch(() => {});
    } catch (err) {
      toast.error(err.message || "Could not stop all cameras");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-panel shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h3 className="m-0 text-sm font-semibold text-ink">
            All cameras live
          </h3>
          <p className="m-0 mt-0.5 text-xs text-muted">
            Start all enabled RTSP cameras, then play each returned{" "}
            <code className="text-[0.7rem]">stream_url</code> separately. Job
            ids change every start — always use the latest response.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleStartAll}
            className="inline-flex cursor-pointer items-center rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? "Working…" : "Start all cameras"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleStopAll}
            className="inline-flex cursor-pointer items-center rounded-xl border border-danger/30 bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger disabled:opacity-60"
          >
            Stop all
          </button>
        </div>
      </div>

      {summary ? (
        <p className="m-0 border-b border-line px-4 py-2 text-xs text-muted">
          {summary.kind === "start"
            ? `${summary.started} starting · ${summary.already_running} already running · ${summary.skipped} skipped · ${summary.failed} failed`
            : `Stop ${summary.status} · ${summary.requested} requested · ${summary.already_stopped} already stopped · ${summary.failed} failed`}
        </p>
      ) : null}

      {playable.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted">
          No live streams yet. Click <strong>Start all cameras</strong> to open
          each camera’s AI feed.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {playable.map((item) => {
            const url = getJobStreamUrl(item.stream_url);
            return (
              <article
                key={feedKey(item)}
                className="overflow-hidden rounded-xl border border-line bg-elevated/40"
              >
                <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
                  <div className="min-w-0">
                    <p className="m-0 truncate text-xs font-bold text-ink">
                      {item.camera_name || item.camera_id || "Camera"}
                    </p>
                    <p className="m-0 truncate font-mono text-[0.65rem] text-dim">
                      {item.job_id || item.stream_url}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[0.65rem] font-semibold capitalize text-accent">
                    {item.status || "live"}
                  </span>
                </div>
                <div className="relative aspect-video bg-black">
                  {url ? (
                    <MjpegStreamPlayer
                      url={url}
                      alt={item.camera_name || "Camera stream"}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <p className="m-0 grid h-full place-items-center text-xs text-white/70">
                      Missing stream_url
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {feeds.some((f) => f && !isPlayable(f)) ? (
        <ul className="m-0 list-none space-y-1 border-t border-line px-4 py-3">
          {feeds
            .filter((f) => f && !isPlayable(f))
            .map((f) => (
              <li key={feedKey(f)} className="text-xs text-muted">
                <span className="font-semibold text-ink">
                  {f.camera_name || f.camera_id}
                </span>
                {" · "}
                {f.status || "skipped"}
                {f.message ? ` — ${f.message}` : ""}
              </li>
            ))}
        </ul>
      ) : null}
    </section>
  );
}
