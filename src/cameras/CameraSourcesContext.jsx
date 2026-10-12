import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "ppe-camera-sources";
const CHANGE_EVENT = "ppe-camera-sources-changed";

export const SOURCE_TYPES = [
  { id: "rtsp", label: "RTSP / CCTV" },
  { id: "webcam", label: "Server webcam" },
  { id: "http", label: "HTTP / MJPEG" },
];

function uid() {
  return `cam_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readList() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function normalizeCameraInput(input) {
  const type = String(input.type || "rtsp").toLowerCase();
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Camera name is required");

  const enabled = input.enabled !== false;
  const notes = String(input.notes || "").trim();
  const base = {
    id: input.id || uid(),
    name,
    type,
    enabled,
    notes,
    updated_at: new Date().toISOString(),
    created_at: input.created_at || new Date().toISOString(),
  };

  if (type === "webcam") {
    const index = Number(input.camera_index ?? 0);
    if (!Number.isFinite(index) || index < 0) {
      throw new Error("Webcam camera_index must be 0 or higher");
    }
    return { ...base, camera_index: Math.floor(index), url: "" };
  }

  if (type === "rtsp" || type === "http") {
    const url = String(input.url || "").trim();
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
  const [cameras, setCameras] = useState(() => readList());

  useEffect(() => {
    function sync() {
      setCameras(readList());
    }
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const upsertCamera = useCallback((input) => {
    const nextItem = normalizeCameraInput(input);
    const prev = readList();
    const exists = prev.some((c) => c.id === nextItem.id);
    const list = exists
      ? prev.map((c) => (c.id === nextItem.id ? { ...c, ...nextItem } : c))
      : [nextItem, ...prev];
    writeList(list);
    setCameras(list);
    return nextItem;
  }, []);

  const removeCamera = useCallback((id) => {
    const list = readList().filter((c) => c.id !== id);
    writeList(list);
    setCameras(list);
  }, []);

  const setEnabled = useCallback((id, enabled) => {
    const list = readList().map((c) =>
      c.id === id
        ? { ...c, enabled: Boolean(enabled), updated_at: new Date().toISOString() }
        : c
    );
    writeList(list);
    setCameras(list);
  }, []);

  const value = useMemo(
    () => ({
      cameras,
      enabledCameras: cameras.filter((c) => c.enabled),
      upsertCamera,
      removeCamera,
      setEnabled,
    }),
    [cameras, upsertCamera, removeCamera, setEnabled]
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
      upsertCamera: () => {},
      removeCamera: () => {},
      setEnabled: () => {},
    };
  }
  return ctx;
}
