/**
 * Map a pointer event on an object-contain media element to frame pixels.
 */
export function pointerToFrameCoords(event, mediaEl) {
  if (!mediaEl) return null;

  const rect = mediaEl.getBoundingClientRect();
  const nw = mediaEl.naturalWidth || mediaEl.videoWidth || 0;
  const nh = mediaEl.naturalHeight || mediaEl.videoHeight || 0;
  if (!nw || !nh) return null;

  const scale = Math.min(rect.width / nw, rect.height / nh);
  const dispW = nw * scale;
  const dispH = nh * scale;
  const offsetX = (rect.width - dispW) / 2;
  const offsetY = (rect.height - dispH) / 2;

  const x = (event.clientX - rect.left - offsetX) / scale;
  const y = (event.clientY - rect.top - offsetY) / scale;

  if (x < 0 || y < 0 || x > nw || y > nh) return null;

  return {
    x: Math.round(Math.min(nw, Math.max(0, x))),
    y: Math.round(Math.min(nh, Math.max(0, y))),
    frameWidth: nw,
    frameHeight: nh,
  };
}

/** Convert frame-space points [[x,y],...] to SVG overlay % within object-contain box. */
export function framePointsToOverlay(points, mediaEl, containerEl) {
  if (!mediaEl || !containerEl || !points?.length) return [];

  const mediaRect = mediaEl.getBoundingClientRect();
  const containerRect = containerEl.getBoundingClientRect();
  const nw = mediaEl.naturalWidth || mediaEl.videoWidth || 0;
  const nh = mediaEl.naturalHeight || mediaEl.videoHeight || 0;
  if (!nw || !nh) return [];

  const scale = Math.min(mediaRect.width / nw, mediaRect.height / nh);
  const dispW = nw * scale;
  const dispH = nh * scale;
  const offsetX = (mediaRect.width - dispW) / 2;
  const offsetY = (mediaRect.height - dispH) / 2;

  return points.map(([x, y]) => {
    const px =
      mediaRect.left - containerRect.left + offsetX + Number(x) * scale;
    const py =
      mediaRect.top - containerRect.top + offsetY + Number(y) * scale;
    return { x: px, y: py };
  });
}

export function normalizeZonePoints(rawPoints) {
  if (!Array.isArray(rawPoints)) return [];
  return rawPoints
    .map((p) => {
      if (Array.isArray(p) && p.length >= 2) {
        return [Number(p[0]), Number(p[1])];
      }
      if (p && typeof p === "object") {
        return [Number(p.x), Number(p.y)];
      }
      return null;
    })
    .filter(
      (p) =>
        p &&
        Number.isFinite(p[0]) &&
        Number.isFinite(p[1])
    );
}
