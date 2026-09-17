export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB

/** Normalize GET /video/jobs (or single job) into UI history rows. */
export function normalizeJobsList(payload) {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.jobs)
      ? payload.jobs
      : Array.isArray(payload?.items)
        ? payload.items
        : [];

  return list
    .map((job) => ({
      job_id: job.job_id,
      filename: job.filename || job.label || "video.mp4",
      status: job.status || "unknown",
      progress: Number(job.progress ?? 0),
      source_type: job.source_type || "upload",
      stream_url: job.stream_url || null,
      started_at: job.started_at || job.created_at || null,
    }))
    .filter((job) => Boolean(job.job_id))
    .sort((a, b) => {
      const ta = a.started_at ? new Date(a.started_at).getTime() : 0;
      const tb = b.started_at ? new Date(b.started_at).getTime() : 0;
      return tb - ta;
    });
}

export function upsertJobInList(list, entry) {
  if (!entry?.job_id) return list || [];
  const prev = (list || []).filter((j) => j.job_id !== entry.job_id);
  return [
    {
      job_id: entry.job_id,
      filename: entry.filename || entry.label || "video.mp4",
      status: entry.status || "queued",
      progress: Number(entry.progress ?? 0),
      source_type: entry.source_type || "upload",
      stream_url: entry.stream_url || null,
      started_at: entry.started_at || new Date().toISOString(),
    },
    ...prev,
  ];
}

export function patchJobInList(list, jobId, patch) {
  return (list || []).map((j) =>
    j.job_id === jobId ? { ...j, ...patch } : j
  );
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isMp4File(file) {
  if (!file) return false;
  return (
    file.name.toLowerCase().endsWith(".mp4") || file.type === "video/mp4"
  );
}
