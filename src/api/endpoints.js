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
 * Backend expects training options as query params (not JSON body), e.g.:
 * POST /datasets/{dataset_id}/train?model_name=...&epochs=30&imgsz=320&batch=4&device=cpu
 * @param {string} datasetId
 * @param {{ model_name: string, epochs?: number, imgsz?: number, batch?: number, device?: string }} config
 */
export function startDatasetTraining(datasetId, config) {
  const id = encodeURIComponent(String(datasetId));
  const q = new URLSearchParams({
    model_name: String(config.model_name || "").trim(),
    epochs: String(Number(config.epochs ?? 30)),
    imgsz: String(Number(config.imgsz ?? 320)),
    batch: String(Number(config.batch ?? 4)),
    device: String(config.device || "cpu"),
  });
  return apiFetch(`/datasets/${id}/train?${q}`, {
    method: "POST",
  });
}

/** Poll training job status / progress. */
export function getTrainingStatus(jobId) {
  const id = encodeURIComponent(String(jobId));
  return apiFetch(`/training/${id}`);
}

/** Normalize backend model payloads (`id` vs `model_id`, metrics aliases, etc.). */
export function normalizeModel(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id =
    raw.id ??
    raw.model_id ??
    raw.modelId ??
    raw.trained_model_id ??
    raw.pk ??
    null;
  const metrics = raw.metrics && typeof raw.metrics === "object" ? raw.metrics : {};
  return {
    ...raw,
    id,
    name: raw.name ?? raw.model_name ?? "Untitled model",
    status: raw.status ?? "completed",
    active: Boolean(raw.active ?? raw.is_active),
    precision: raw.precision ?? metrics.precision,
    recall: raw.recall ?? metrics.recall,
    map50:
      raw.map50 ??
      raw.mAP50 ??
      raw.map_50 ??
      metrics.map50 ??
      metrics.mAP50 ??
      metrics.map_50,
    map50_95:
      raw.map50_95 ??
      raw.mAP50_95 ??
      raw.map5095 ??
      metrics.map50_95 ??
      metrics.mAP50_95,
  };
}

function normalizeModelList(payload) {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.models)
      ? payload.models
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
  return list.map(normalizeModel).filter(Boolean);
}

/** List all trained models. */
export async function getModels() {
  const payload = await apiFetch("/models");
  return normalizeModelList(payload);
}

/** Currently active detection model (404/null when none). */
export async function getActiveModel() {
  try {
    const payload = await apiFetch("/models/active");
    return normalizeModel(payload);
  } catch (err) {
    if (err?.status === 404) return null;
    throw err;
  }
}

/**
 * Rename a trained model.
 * Backend expects name as a query param (not JSON body):
 * PUT /models/{model_id}?name=Construction%20Site%20V1
 */
export function renameModel(modelId, name) {
  if (modelId == null || modelId === "") {
    return Promise.reject(new Error("Missing model id"));
  }
  const nextName = String(name || "").trim();
  if (!nextName) {
    return Promise.reject(new Error("Name is required"));
  }
  const q = new URLSearchParams({ name: nextName });
  return apiFetch(
    `/models/${encodeURIComponent(String(modelId))}?${q}`,
    { method: "PUT" }
  ).then(normalizeModel);
}

/** Activate a trained model for the detection pipeline. */
export function activateModel(modelId) {
  if (modelId == null || modelId === "") {
    return Promise.reject(new Error("Missing model id — refresh the models list"));
  }
  return apiFetch(
    `/models/${encodeURIComponent(String(modelId))}/activate`,
    { method: "POST" }
  ).then(normalizeModel);
}

export { API_BASE_URL };
