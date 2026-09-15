import { apiFetch, API_BASE_URL } from "./client";

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
  if (!screenshotPath) return null;
  if (screenshotPath.startsWith("http")) return screenshotPath;
  return `${API_BASE_URL}${screenshotPath.startsWith("/") ? "" : "/"}${screenshotPath}`;
}

/** Normalize API event types used across UI filters. */
export function isZoneEvent(type) {
  return type === "ZONE_VIOLATION" || type === "RESTRICTED_ZONE";
}

export function isPpeEvent(type) {
  return type === "PPE_VIOLATION";
}
