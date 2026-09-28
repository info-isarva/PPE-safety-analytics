import { useRef, useState } from "react";
import { useBrandLogos } from "../settings/BrandLogoContext";
import { useToast } from "../components/common/ToastContext";

function LogoSlot({
  title,
  hint,
  src,
  isCustom,
  previewClass,
  onPick,
  onReset,
  inputRef,
  busy,
}) {
  return (
    <article className="rounded-2xl border border-line bg-panel p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-sm font-semibold text-ink">{title}</h3>
          <p className="mt-1 m-0 text-xs text-muted">{hint}</p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
            isCustom
              ? "bg-ok-soft text-ok"
              : "bg-elevated text-muted"
          }`}
        >
          {isCustom ? "Custom" : "Default"}
        </span>
      </div>

      <div className="mt-4 grid place-items-center rounded-xl border border-dashed border-line bg-[#10243a] p-6">
        <img
          src={src}
          alt={title}
          className={`object-contain drop-shadow-sm ${previewClass}`}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={onPick}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex cursor-pointer items-center rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {busy ? "Saving…" : "Upload logo"}
        </button>
        <button
          type="button"
          disabled={busy || !isCustom}
          onClick={onReset}
          className="inline-flex cursor-pointer items-center rounded-xl border border-line bg-elevated px-3 py-2 text-xs font-semibold text-ink hover:bg-panel-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset to default
        </button>
      </div>
    </article>
  );
}

export default function Settings() {
  const toast = useToast();
  const {
    fullLogoSrc,
    markLogoSrc,
    hasCustomFull,
    hasCustomMark,
    setFullLogo,
    setMarkLogo,
    resetLogos,
  } = useBrandLogos();

  const fullInputRef = useRef(null);
  const markInputRef = useRef(null);
  const [busyKey, setBusyKey] = useState(null);

  async function handleFull(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusyKey("full");
    try {
      await setFullLogo(file);
      toast.success("Sidebar logo updated");
    } catch (err) {
      toast.error(err.message || "Could not update logo");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleMark(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusyKey("mark");
    try {
      await setMarkLogo(file);
      toast.success("Collapsed logo updated");
    } catch (err) {
      toast.error(err.message || "Could not update logo");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <section className="rounded-2xl border border-line bg-panel p-4 shadow-sm sm:p-5">
        <h2 className="m-0 text-base font-semibold text-ink">Brand logos</h2>
        <p className="mt-1 m-0 max-w-2xl text-sm text-muted">
          Replace the sidebar logos used in this browser. Changes are saved
          locally (not uploaded to the API). Prefer PNG with a transparent
          background for best results on the dark sidebar.
        </p>
        {(hasCustomFull || hasCustomMark) && (
          <button
            type="button"
            className="mt-3 inline-flex cursor-pointer rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:bg-elevated hover:text-ink"
            onClick={() => {
              resetLogos();
              toast.info("Restored default isarva Nethra logos");
            }}
          >
            Reset all logos
          </button>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LogoSlot
          title="Expanded sidebar logo"
          hint="Full wordmark shown when the sidebar is open. Max 1.5 MB."
          src={fullLogoSrc}
          isCustom={hasCustomFull}
          previewClass="h-14 w-auto max-w-full"
          inputRef={fullInputRef}
          busy={busyKey === "full"}
          onPick={handleFull}
          onReset={async () => {
            setBusyKey("full");
            try {
              await setFullLogo(null);
              toast.info("Expanded logo reset");
            } finally {
              setBusyKey(null);
            }
          }}
        />
        <LogoSlot
          title="Collapsed sidebar mark"
          hint="Icon-only mark when the sidebar is collapsed. Max 1.5 MB."
          src={markLogoSrc}
          isCustom={hasCustomMark}
          previewClass="h-16 w-16"
          inputRef={markInputRef}
          busy={busyKey === "mark"}
          onPick={handleMark}
          onReset={async () => {
            setBusyKey("mark");
            try {
              await setMarkLogo(null);
              toast.info("Collapsed logo reset");
            } finally {
              setBusyKey(null);
            }
          }}
        />
      </section>
    </div>
  );
}
