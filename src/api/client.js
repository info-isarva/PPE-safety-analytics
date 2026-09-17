const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

export { API_BASE_URL };

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const { json, headers: customHeaders, body, ...rest } = options;

  const headers = {
    "ngrok-skip-browser-warning": "true",
    ...(customHeaders || {}),
  };

  let finalBody = body;

  if (json !== undefined) {
    headers.Accept = headers.Accept || "application/json";
    headers["Content-Type"] = "application/json";
    finalBody = JSON.stringify(json);
  } else if (body instanceof FormData) {
    // Browser sets multipart boundary; do not set Content-Type
    headers.Accept = headers.Accept || "application/json";
  } else {
    headers.Accept = headers.Accept || "application/json";
  }

  const response = await fetch(url, {
    ...rest,
    headers,
    body: finalBody,
  });

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.json();
      detail = errBody?.detail || errBody?.message || "";
    } catch {
      /* ignore */
    }
    const error = new Error(
      detail || `Request failed (${response.status})`
    );
    error.status = response.status;
    throw error;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response;
}

/** Absolute URL for relative API paths (streams, screenshots). */
export function resolveApiUrl(path) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** MJPEG/img stream URL with ngrok bypass query when needed. */
export function resolveStreamUrl(path) {
  const absolute = resolveApiUrl(path);
  if (!absolute) return null;
  try {
    const url = new URL(absolute);
    if (url.hostname.includes("ngrok")) {
      url.searchParams.set("ngrok-skip-browser-warning", "true");
    }
    return url.toString();
  } catch {
    return absolute;
  }
}
