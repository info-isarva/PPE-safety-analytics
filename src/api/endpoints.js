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

/* ---------- RTSP / CCTV live source (legacy job APIs) ---------- */

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

/* ---------- Camera management (PostgreSQL registry) ---------- */

/** Normalize backend camera payloads for UI (`camera_id` → `id`, etc.). */
export function normalizeCamera(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = raw.camera_id ?? raw.id ?? null;
  if (id == null || id === "") return null;
  const type = String(raw.source_type ?? raw.type ?? "rtsp").toLowerCase();
  const source = raw.source ?? raw.url ?? "";
  const isWebcam = type === "webcam";
  const cameraIndex = isWebcam
    ? Math.floor(Number(raw.camera_index ?? source ?? 0)) || 0
    : null;
  return {
    ...raw,
    id: String(id),
    camera_id: String(id),
    name: raw.name ?? "Camera",
    type,
    source_type: type,
    source: String(source ?? ""),
    url: isWebcam ? "" : String(source ?? ""),
    camera_index: cameraIndex,
    enabled: raw.enabled !== false,
    status: raw.status || "not_connected",
    transport: raw.transport === "udp" ? "udp" : "tcp",
    notes: String(raw.notes || ""),
    job_id: raw.job_id ?? null,
    stream_url: raw.stream_url ?? null,
  };
}

function normalizeCameraList(payload) {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.cameras)
      ? payload.cameras
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
  return list.map(normalizeCamera).filter(Boolean);
}

/** Map UI form fields → POST/PUT /cameras body. */
export function toCameraApiPayload(input) {
  const type = String(input.type || input.source_type || "rtsp").toLowerCase();
  let source = "";
  if (type === "webcam") {
    source = String(input.camera_index ?? input.source ?? 0);
  } else {
    source = String(input.url || input.source || "").trim();
  }
  return {
    name: String(input.name || "").trim(),
    source_type: type,
    source,
    enabled: input.enabled !== false,
  };
}

export async function getCameras({ signal } = {}) {
  const payload = await apiFetch("/cameras", { signal });
  return normalizeCameraList(payload);
}

export async function getCamera(cameraId) {
  const id = encodeURIComponent(String(cameraId));
  const payload = await apiFetch(`/cameras/${id}`);
  return normalizeCamera(payload);
}

export async function createCamera(input) {
  const payload = await apiFetch("/cameras", {
    method: "POST",
    json: toCameraApiPayload(input),
  });
  return normalizeCamera(payload);
}

export async function updateCamera(cameraId, input) {
  if (cameraId == null || cameraId === "") {
    return Promise.reject(new Error("Missing camera id"));
  }
  const id = encodeURIComponent(String(cameraId));
  const payload = await apiFetch(`/cameras/${id}`, {
    method: "PUT",
    json: toCameraApiPayload(input),
  });
  return normalizeCamera(payload);
}

export function deleteCamera(cameraId) {
  if (cameraId == null || cameraId === "") {
    return Promise.reject(new Error("Missing camera id"));
  }
  const id = encodeURIComponent(String(cameraId));
  return apiFetch(`/cameras/${id}`, { method: "DELETE" });
}

/** Test whether the configured camera can be reached. */
export function testCamera(cameraId) {
  if (cameraId == null || cameraId === "") {
    return Promise.reject(new Error("Missing camera id"));
  }
  const id = encodeURIComponent(String(cameraId));
  return apiFetch(`/cameras/${id}/test`, { method: "POST" });
}

/** Start AI processing for a registered camera; returns stream_url. */
export function startCamera(cameraId) {
  if (cameraId == null || cameraId === "") {
    return Promise.reject(new Error("Missing camera id"));
  }
  const id = encodeURIComponent(String(cameraId));
  return apiFetch(`/cameras/${id}/start`, { method: "POST" });
}

/** Stop processing for a registered camera. */
export function stopCamera(cameraId) {
  if (cameraId == null || cameraId === "") {
    return Promise.reject(new Error("Missing camera id"));
  }
  const id = encodeURIComponent(String(cameraId));
  return apiFetch(`/cameras/${id}/stop`, { method: "POST" });
}

/**
 * Start all enabled RTSP cameras.
 * Each results[] item may include stream_url for that camera's live feed.
 */
export function startAllCameras() {
  return apiFetch("/cameras/start-all", { method: "POST" });
}

/** Request stop for all camera jobs. */
export function stopAllCameras() {
  return apiFetch("/cameras/stop-all", { method: "POST" });
}

/** Normalize start-all / stop-all per-camera rows for the UI. */
export function normalizeCameraBatchResult(raw) {
  if (!raw || typeof raw !== "object") return null;
  const cameraId = raw.camera_id ?? raw.id ?? null;
  return {
    ...raw,
    camera_id: cameraId != null ? String(cameraId) : null,
    job_id: raw.job_id ?? null,
    status: raw.status || null,
    camera_name: raw.camera_name || raw.name || null,
    source_type: raw.source_type || raw.type || null,
    stream_url: raw.stream_url || null,
    message: raw.message || raw.error || null,
  };
}

/**
 * Start a saved camera via Camera Management API.
 * Returns job payload including stream_url for Live View.
 */
export async function startSavedCamera(camera) {
  const id = camera?.id ?? camera?.camera_id;
  if (!id) throw new Error("No camera selected");
  return startCamera(id);
}

/**
 * Stop a live source.
 * Prefer Camera Management stop; fall back to generic job stop.
 * Do not use /video/rtsp|webcam|http/{id}/stop — those routes 404 on current backend.
 */
export async function stopLiveSource(jobId, _sourceType, cameraId) {
  if (cameraId) {
    try {
      return await stopCamera(cameraId);
    } catch (err) {
      // If camera stop is unavailable, fall through to job stop when we have a job id.
      if (!jobId || (err?.status !== 404 && err?.status !== 405)) throw err;
    }
  }
  if (!jobId) throw new Error("Missing job id");
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

/**
 * Activate the built-in default PPE model (models/best.pt).
 * Deactivates all custom-trained models on the backend.
 */
export async function activateDefaultModel() {
  const payload = await apiFetch("/models/activate-default", {
    method: "POST",
  });
  return normalizeModel({
    ...payload,
    id: payload?.model_id ?? payload?.id ?? "DEFAULT",
    model_id: payload?.model_id ?? payload?.id ?? "DEFAULT",
    active: payload?.active !== false,
    name: payload?.name || "Default PPE Model (10 classes)",
  });
}

export { API_BASE_URL };
