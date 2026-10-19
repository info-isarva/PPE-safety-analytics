import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createCamera,
  deleteCamera,
  getCameras,
  updateCamera,
} from "../api/endpoints";

export const SOURCE_TYPES = [
  { id: "rtsp", label: "RTSP / CCTV" },
  { id: "webcam", label: "Server webcam" },
  { id: "http", label: "HTTP / MJPEG" },
];

/** Client-side validation before calling the Camera Management API. */
export function normalizeCameraInput(input) {
  const type = String(input.type || "rtsp").toLowerCase();
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Camera name is required");

  const enabled = input.enabled !== false;
  const notes = String(input.notes || "").trim();
  const base = {
    id: input.id || input.camera_id || undefined,
    name,
    type,
    enabled,
    notes,
  };

  if (type === "webcam") {
    const index = Number(input.camera_index ?? 0);
    if (!Number.isFinite(index) || index < 0) {
      throw new Error("Webcam camera_index must be 0 or higher");
    }
    return { ...base, camera_index: Math.floor(index), url: "" };
  }

  if (type === "rtsp" || type === "http") {
    const url = String(input.url || input.source || "").trim();
    if (!url) throw new Error("Connection URL is required");
    if (type === "rtsp" && !/^rtsp:\/\//i.test(url)) {
      throw new Error("RTSP URL must start with rtsp://");
    }
    if (type === "http" && !/^https?:\/\//i.test(url)) {
      throw new Error("HTTP URL must start with http:// or https://");
    }
    return {
      ...base,
      url,
      camera_index: null,
      transport: input.transport === "udp" ? "udp" : "tcp",
    };
  }

  throw new Error("Unsupported source type");
}

const CameraSourcesContext = createContext(null);

export function CameraSourcesProvider({ children }) {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshCameras = useCallback(async ({ signal } = {}) => {
    setError(null);
    try {
      const list = await getCameras({ signal });
      setCameras(Array.isArray(list) ? list : []);
      return list;
    } catch (err) {
      if (err?.name === "AbortError") throw err;
      setError(err.message || "Failed to load cameras");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refreshCameras({ signal: controller.signal }).catch(() => {
      /* error stored in state */
    });
    return () => controller.abort();
  }, [refreshCameras]);

  const upsertCamera = useCallback(
    async (input) => {
      const nextItem = normalizeCameraInput(input);
      const saved = nextItem.id
        ? await updateCamera(nextItem.id, nextItem)
        : await createCamera(nextItem);
      await refreshCameras();
      return saved;
    },
    [refreshCameras]
  );

  const removeCamera = useCallback(
    async (id) => {
      await deleteCamera(id);
      await refreshCameras();
    },
    [refreshCameras]
  );

  const setEnabled = useCallback(
    async (id, enabled) => {
      const cam = cameras.find((c) => c.id === id);
      if (!cam) throw new Error("Camera not found");
      await updateCamera(id, { ...cam, enabled: Boolean(enabled) });
      await refreshCameras();
    },
    [cameras, refreshCameras]
  );

  const patchLocalCamera = useCallback((id, patch) => {
    setCameras((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
  }, []);

  const value = useMemo(
    () => ({
      cameras,
      enabledCameras: cameras.filter((c) => c.enabled),
      loading,
      error,
      refreshCameras,
      upsertCamera,
      removeCamera,
      setEnabled,
      patchLocalCamera,
    }),
    [
      cameras,
      loading,
      error,
      refreshCameras,
      upsertCamera,
      removeCamera,
      setEnabled,
      patchLocalCamera,
    ]
  );

  return (
    <CameraSourcesContext.Provider value={value}>
      {children}
    </CameraSourcesContext.Provider>
  );
}

export function useCameraSources() {
  const ctx = useContext(CameraSourcesContext);
  if (!ctx) {
    return {
      cameras: [],
      enabledCameras: [],
      loading: false,
      error: null,
      refreshCameras: async () => [],
      upsertCamera: async () => {},
      removeCamera: async () => {},
      setEnabled: async () => {},
      patchLocalCamera: () => {},
    };
  }
  return ctx;
}
