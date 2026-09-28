import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "ppe-brand-logos";
const CHANGE_EVENT = "ppe-brand-logos-changed";

export const DEFAULT_FULL_LOGO = "/isarva-nethra-logo.png?v=3";
export const DEFAULT_MARK_LOGO = "/isarva-nethra-mark.png?v=3";

const MAX_BYTES = 1.5 * 1024 * 1024; // 1.5 MB per image

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { full: null, mark: null };
    const parsed = JSON.parse(raw);
    return {
      full: typeof parsed?.full === "string" ? parsed.full : null,
      mark: typeof parsed?.mark === "string" ? parsed.mark : null,
    };
  } catch {
    return { full: null, mark: null };
  }
}

function writeStored(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch (err) {
    throw new Error(
      err?.name === "QuotaExceededError"
        ? "Storage full — use a smaller image."
        : "Could not save logo."
    );
  }
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No file selected"));
      return;
    }
    if (!String(file.type || "").startsWith("image/")) {
      reject(new Error("Please choose an image file (PNG, JPG, WebP, SVG)."));
      return;
    }
    if (file.size > MAX_BYTES) {
      reject(new Error("Image is too large (max 1.5 MB)."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

const BrandLogoContext = createContext(null);

export function BrandLogoProvider({ children }) {
  const [custom, setCustom] = useState(() => readStored());

  useEffect(() => {
    function sync() {
      setCustom(readStored());
    }
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setFullLogo = useCallback(async (fileOrNull) => {
    const prev = readStored();
    if (fileOrNull == null) {
      const next = { ...prev, full: null };
      writeStored(next);
      setCustom(next);
      return;
    }
    const dataUrl = await fileToDataUrl(fileOrNull);
    const next = { ...prev, full: dataUrl };
    writeStored(next);
    setCustom(next);
  }, []);

  const setMarkLogo = useCallback(async (fileOrNull) => {
    const prev = readStored();
    if (fileOrNull == null) {
      const next = { ...prev, mark: null };
      writeStored(next);
      setCustom(next);
      return;
    }
    const dataUrl = await fileToDataUrl(fileOrNull);
    const next = { ...prev, mark: dataUrl };
    writeStored(next);
    setCustom(next);
  }, []);

  const resetLogos = useCallback(() => {
    const next = { full: null, mark: null };
    writeStored(next);
    setCustom(next);
  }, []);

  const value = useMemo(
    () => ({
      fullLogoSrc: custom.full || DEFAULT_FULL_LOGO,
      markLogoSrc: custom.mark || DEFAULT_MARK_LOGO,
      hasCustomFull: Boolean(custom.full),
      hasCustomMark: Boolean(custom.mark),
      setFullLogo,
      setMarkLogo,
      resetLogos,
    }),
    [custom, setFullLogo, setMarkLogo, resetLogos]
  );

  return (
    <BrandLogoContext.Provider value={value}>
      {children}
    </BrandLogoContext.Provider>
  );
}

export function useBrandLogos() {
  const ctx = useContext(BrandLogoContext);
  if (!ctx) {
    return {
      fullLogoSrc: DEFAULT_FULL_LOGO,
      markLogoSrc: DEFAULT_MARK_LOGO,
      hasCustomFull: false,
      hasCustomMark: false,
      setFullLogo: async () => {},
      setMarkLogo: async () => {},
      resetLogos: () => {},
    };
  }
  return ctx;
}
