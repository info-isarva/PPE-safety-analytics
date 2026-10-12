import { apiFetch, API_BASE_URL, resolveApiUrl, resolveStreamUrl } from "./client";

export function getHealth() {
  return apiFetch("/health");
}

export function getDashboardStats() {
  return apiFetch("/stats/dashboard");
}

export function getComplianceStats() {
  return apiFetch("/stats/compliance");
}

export function getViolationStats() {
  return apiFetch("/stats/violations");
}

export function getWorkerStats() {
  return apiFetch("/stats/workers");
}

export function getPpeDistributionStats() {
  return apiFetch("/stats/ppe-distribution");
}

export function getEvents() {
  return apiFetch("/events");
}

export function getEvent(eventId) {
  return apiFetch(`/events/${eventId}`);
}

export function getEventsByType(eventType) {
  return apiFetch(`/events/type/${eventType}`);
}

export function getScreenshotUrl(screenshotPath) {
  return resolveApiUrl(screenshotPath);
}

/** Normalize API event types used across UI filters. */
export function isZoneEvent(type) {
  return type === "ZONE_VIOLATION" || type === "RESTRICTED_ZONE";
}

export function isPpeEvent(type) {
  return type === "PPE_VIOLATION";
}

/* ---------- Video processing (Day 2) ---------- */

export function uploadVideo(file) {
  const form = new FormData();
  form.append("file", file);
  return apiFetch("/video/upload", {
    method: "POST",
    body: form,
  });
}

export function getVideoJob(jobId) {
  return apiFetch(`/video/jobs/${jobId}`);
}

export function getLiveVideo() {
  return apiFetch("/video/live");
}

/** List uploaded video jobs (server-side history). */
export function getVideoJobs({ signal } = {}) {
  return apiFetch("/video/jobs", { signal });
}

export function getJobStreamUrl(jobIdOrStreamPath) {
  if (!jobIdOrStreamPath) return null;
  if (String(jobIdOrStreamPath).includes("/")) {
    return resolveStreamUrl(jobIdOrStreamPath);
  }
  return resolveStreamUrl(`/video/jobs/${jobIdOrStreamPath}/stream`);
}

/** Absolute stream/file URL helper for optional processed_url from job JSON. */
export function resolveProcessedVideoUrl(jobOrPath) {
  if (!jobOrPath) return null;
  if (typeof jobOrPath === "string") {
    return resolveStreamUrl(jobOrPath);
  }
  const path =
    jobOrPath.processed_url ||
    jobOrPath.output_url ||
    jobOrPath.video_url ||
    null;
  // Do not guess /video/processed/{filename} — API returns 404 for original names
  return path ? resolveStreamUrl(path) : null;
}

export function getProcessedVideoUrl(filename) {
  if (!filename) return null;
  const safe = encodeURIComponent(String(filename).replace(/^\/+/, ""));
  return resolveStreamUrl(`/video/processed/${safe}`);
}

export function getJobZones(jobId) {
  return apiFetch(`/video/jobs/${jobId}/zones`);
}

export function saveJobZones(jobId, payload) {
  return apiFetch(`/video/jobs/${jobId}/zones`, {
    method: "PUT",
    json: payload,
  });
}

export function stopVideoJob(jobId) {
  return apiFetch(`/video/jobs/${jobId}/stop`, {
    method: "POST",
  });
}

/* ---------- Webcam live source ---------- */

/** Start laptop/USB webcam processing. Optional camera_index (default 0). */
export function startWebcam(cameraIndex = 0) {
  const q = new URLSearchParams({
    camera_index: String(cameraIndex ?? 0),
  });
  return apiFetch(`/video/webcam/start?${q}`, {
    method: "POST",
  });
}

/** Stop a webcam job (preferred over generic /video/jobs/.../stop). */
export function stopWebcam(jobId) {
  return apiFetch(`/video/webcam/${jobId}/stop`, {
    method: "POST",
  });
}

/* ---------- RTSP / CCTV live source ---------- */

/** Start RTSP camera processing. */
export function startRtsp({ rtspUrl, label, transport = "tcp" }) {
  return apiFetch("/video/rtsp/start", {
    method: "POST",
    json: {
      rtsp_url: rtspUrl,
      label: label || "RTSP Camera",
      transport: transport || "tcp",
    },
  });
}

export function stopRtsp(jobId) {
  return apiFetch(`/video/rtsp/${jobId}/stop`, {
    method: "POST",
  });
}

/** Start HTTP/MJPEG camera if backend supports it. */
export function startHttpCamera({ url, label }) {
  return apiFetch("/video/http/start", {
    method: "POST",
    json: {
      url,
      label: label || "HTTP Camera",
    },
  });
}

export function stopHttpCamera(jobId) {
  return apiFetch(`/video/http/${jobId}/stop`, {
    method: "POST",
  });
}

/**
 * Start a saved camera registry entry.
 * Returns the backend job payload (job_id, stream_url, ...).
 */
export async function startSavedCamera(camera) {
  if (!camera) throw new Error("No camera selected");
  const type = camera.type;

  if (type === "webcam") {
    return startWebcam(camera.camera_index ?? 0);
  }
  if (type === "rtsp") {
    return startRtsp({
      rtspUrl: camera.url,
      label: camera.name,
      transport: camera.transport || "tcp",
    });
  }
  if (type === "http") {
    return startHttpCamera({ url: camera.url, label: camera.name });
  }
  throw new Error(`Unsupported camera type: ${type}`);
}

/** Stop by source type when known; falls back to generic job stop. */
export async function stopLiveSource(jobId, sourceType) {
  if (!jobId) throw new Error("Missing job id");
  if (sourceType === "webcam") return stopWebcam(jobId);
  if (sourceType === "rtsp") return stopRtsp(jobId);
  if (sourceType === "http") return stopHttpCamera(jobId);
  return stopVideoJob(jobId);
}

/* ---------- Dataset & model management ---------- */

/**
 * Upload a YOLO dataset ZIP.
 * Backend expects: multipart file + required query param `name`.
 * POST /datasets/upload?name=Construction%20Site
 */
export function uploadDataset(file, name) {
  const form = new FormData();
  form.append("file", file);
  const datasetName =
    String(name || "").trim() ||
    String(file?.name || "dataset")
      .replace(/\.zip$/i, "")
      .trim() ||
    "dataset";
  const q = new URLSearchParams({ name: datasetName });
  return apiFetch(`/datasets/upload?${q}`, {
    method: "POST",
    body: form,
  });
}

/**
 * Start training on a validated dataset.
 * @param {string} datasetId
 * @param {{ model_name: string, epochs?: number, imgsz?: number, batch?: number, device?: string }} config
 */
export function startDatasetTraining(datasetId, config) {
  const id = encodeURIComponent(String(datasetId));
  return apiFetch(`/datasets/${id}/train`, {
    method: "POST",
    json: {
      model_name: config.model_name,
      epochs: Number(config.epochs ?? 30),
      imgsz: Number(config.imgsz ?? 320),
      batch: Number(config.batch ?? 4),
      device: config.device || "cpu",
    },
  });
}

/** Poll training job status / progress. */
export function getTrainingStatus(jobId) {
  const id = encodeURIComponent(String(jobId));
  return apiFetch(`/training/${id}`);
}

/** List all trained models. */
export function getModels() {
  return apiFetch("/models");
}

/** Currently active detection model (404/null when none). */
export async function getActiveModel() {
  try {
    return await apiFetch("/models/active");
  } catch (err) {
    if (err?.status === 404) return null;
    throw err;
  }
}

/** Rename a trained model. */
export function renameModel(modelId, name) {
  return apiFetch(`/models/${modelId}`, {
    method: "PUT",
    json: { name },
  });
}

/** Activate a trained model for the detection pipeline. */
export function activateModel(modelId) {
  return apiFetch(`/models/${modelId}/activate`, {
    method: "POST",
  });
}

export { API_BASE_URL };
