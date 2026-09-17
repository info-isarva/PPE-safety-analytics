const JOB_HISTORY_KEY = "ppe-video-job-history";
const MAX_HISTORY = 8;
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB

export function loadJobHistory() {
  try {
    const raw = localStorage.getItem(JOB_HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function rememberJob(entry) {
  if (!entry?.job_id) return loadJobHistory();
  const prev = loadJobHistory().filter((j) => j.job_id !== entry.job_id);
  const next = [
    {
      job_id: entry.job_id,
      filename: entry.filename || entry.label || "video.mp4",
      status: entry.status || "queued",
      progress: entry.progress ?? 0,
      saved_at: new Date().toISOString(),
    },
    ...prev,
  ].slice(0, MAX_HISTORY);
  localStorage.setItem(JOB_HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function updateJobInHistory(jobId, patch) {
  const next = loadJobHistory().map((j) =>
    j.job_id === jobId ? { ...j, ...patch, saved_at: new Date().toISOString() } : j
  );
  localStorage.setItem(JOB_HISTORY_KEY, JSON.stringify(next));
  return next;
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
