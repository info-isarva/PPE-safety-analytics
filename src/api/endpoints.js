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

/** Completed annotated video file (when backend stores it). */
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

export { API_BASE_URL };
