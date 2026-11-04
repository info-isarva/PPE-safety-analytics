import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  normalizeCameraBatchResult,
  startAllCameras,
  startCamera,
  stopAllCameras,
  stopCamera,
  testCamera,
} from "../api/endpoints";
import {
  SOURCE_TYPES,
  useCameraSources,
} from "../cameras/CameraSourcesContext";
import { FilterSelect } from "../components/common/FilterSelect";
import { useToast } from "../components/common/ToastContext";

const TRANSPORT_OPTIONS = [
  { id: "tcp", label: "TCP (recommended)" },
  { id: "udp", label: "UDP" },
];

const FORM_SELECT_LABEL = "text-xs font-semibold text-muted";

function validateSourceForm(form) {
  const errors = {};
  const name = form.name.trim();
  if (!name) {
    errors.name = "Name is required";
  } else if (name.length < 2) {
    errors.name = "Name must be at least 2 characters";
  } else if (name.length > 80) {
    errors.name = "Name must be 80 characters or fewer";
  }

  if (!SOURCE_TYPES.some((t) => t.id === form.type)) {
    errors.type = "Select a valid source type";
  }

  if (form.type === "webcam") {
    const raw = String(form.camera_index ?? "").trim();
    if (raw === "") {
      errors.camera_index = "Camera index is required";
    } else {
      const index = Number(raw);
      if (!Number.isFinite(index) || !Number.isInteger(index) || index < 0) {
        errors.camera_index = "Enter a whole number 0 or higher";
      } else if (index > 64) {
        errors.camera_index = "Camera index looks too high (0–64)";
      }
    }
  } else {
    const url = form.url.trim();
    if (!url) {
      errors.url = "Connection URL is required";
    } else if (form.type === "rtsp" && !/^rtsp:\/\//i.test(url)) {
      errors.url = "RTSP URL must start with rtsp://";
    } else if (form.type === "http" && !/^https?:\/\//i.test(url)) {
      errors.url = "HTTP URL must start with http:// or https://";
    } else if (/\s/.test(url)) {
      errors.url = "URL cannot contain spaces";
    }

    if (form.type === "rtsp" && form.transport !== "tcp" && form.transport !== "udp") {
      errors.transport = "Select TCP or UDP";
    }
  }

  if (form.notes && form.notes.length > 200) {
    errors.notes = "Notes must be 200 characters or fewer";
  }

  return errors;
}

function FieldError({ message }) {
  if (!message) return null;
  return (
    <p className="m-0 mt-1.5 text-[0.75rem] font-medium text-danger" role="alert">
      {message}
    </p>
  );
}

function RequiredMark() {
  return (
    <span className="ml-0.5 text-danger" aria-hidden="true">
      *
    </span>
  );
}

const EMPTY_FORM = {
  id: null,
  name: "",
  type: "rtsp",
  url: "",
  camera_index: "0",
  transport: "tcp",
  notes: "",
  enabled: true,
};

function typeLabel(type) {
  return SOURCE_TYPES.find((t) => t.id === type)?.label || type;
}

function PlusIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function CameraIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 8h4l2-2h6l2 2h4v11H3V8Z" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function SearchIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function FilterIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 5h16M7 12h10M10 19h4" strokeLinecap="round" />
    </svg>
  );
}

function ResetIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 12a9 9 0 1 1-2.6-6.3" strokeLinecap="round" />
      <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function statusLabel(status) {
  const s = String(status || "not_connected").toLowerCase();
  if (s === "processing" || s === "starting") return "Processing";
  if (s === "stopping") return "Stopping";
  if (s === "idle") return "Idle";
  if (s === "failed" || s === "error") return "Failed";
  if (s === "not_tested") return "Not tested";
  return "Not connected";
}

function StatusPill({ cam }) {
  if (!cam.enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
        <span className="h-2 w-2 rounded-full bg-dim" />
        Disabled
      </span>
    );
  }
  const s = String(cam.status || "").toLowerCase();
  const processing = s === "processing" || s === "starting";
  const failed = s === "failed" || s === "error";
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
        failed ? "text-danger" : processing ? "text-accent" : "text-muted"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          failed ? "bg-danger" : processing ? "bg-accent" : "bg-dim"
        }`}
      />
      {statusLabel(cam.status)}
    </span>
  );
}

export default function Cameras() {
  const toast = useToast();
  const {
    cameras,
    loading,
    error: loadError,
    refreshCameras,
    upsertCamera,
    removeCamera,
    setEnabled,
    patchLocalCamera,
  } = useCameraSources();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showFilter, setShowFilter] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchSummary, setBatchSummary] = useState(null);
  const formRef = useRef(null);

  function applyBatchResults(results) {
    const list = Array.isArray(results) ? results : [];
    for (const raw of list) {
      const row = normalizeCameraBatchResult(raw);
      if (!row?.camera_id) continue;
      const patch = { status: row.status || undefined };
      if (row.job_id != null) patch.job_id = row.job_id;
      if (row.stream_url != null) patch.stream_url = row.stream_url;
      if (
        row.status === "stopping" ||
        row.status === "idle" ||
        row.status === "already_stopped"
      ) {
        if (!row.stream_url) patch.stream_url = null;
        if (row.status !== "stopping") patch.job_id = row.job_id || null;
      }
      patchLocalCamera(row.camera_id, patch);
    }
  }

  async function handleStartAll() {
    setBatchBusy(true);
    setBatchSummary(null);
    try {
      const data = await startAllCameras();
      applyBatchResults(data?.results);
      setBatchSummary({
        kind: "start",
        started: Number(data?.started ?? 0),
        already_running: Number(data?.already_running ?? 0),
        skipped: Number(data?.skipped ?? 0),
        failed: Number(data?.failed ?? 0),
        results: (Array.isArray(data?.results) ? data.results : []).map(
          normalizeCameraBatchResult
        ),
      });
      const started = Number(data?.started ?? 0);
      const failed = Number(data?.failed ?? 0);
      if (failed && !started) {
        toast.error(
          `Start all finished with ${failed} failed · ${data?.skipped ?? 0} skipped`
        );
      } else {
        toast.success(
          `Start all · ${started} starting · ${data?.already_running ?? 0} already running · ${data?.skipped ?? 0} skipped · ${failed} failed`
        );
      }
      await refreshCameras().catch(() => {});
    } catch (err) {
      toast.error(err.message || "Could not start all cameras");
    } finally {
      setBatchBusy(false);
    }
  }

  async function handleStopAll() {
    setBatchBusy(true);
    setBatchSummary(null);
    try {
      const data = await stopAllCameras();
      applyBatchResults(data?.results);
      setBatchSummary({
        kind: "stop",
        status: data?.status || "stopping",
        requested: Number(data?.requested ?? 0),
        already_stopped: Number(data?.already_stopped ?? 0),
        failed: Number(data?.failed ?? 0),
        results: (Array.isArray(data?.results) ? data.results : []).map(
          normalizeCameraBatchResult
        ),
      });
      toast.info(
        data?.status === "already_stopped"
          ? "All cameras already stopped"
          : `Stop all · ${data?.requested ?? 0} requested · ${data?.already_stopped ?? 0} already stopped · ${data?.failed ?? 0} failed`
      );
      await refreshCameras().catch(() => {});
    } catch (err) {
      toast.error(err.message || "Could not stop all cameras");
    } finally {
      setBatchBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cameras.filter((c) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.url || "").toLowerCase().includes(q) ||
        (c.notes || "").toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q)
      );
    });
  }, [cameras, query, typeFilter]);

  function clearFieldError(field) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    clearFieldError(field);
  }

  function markTouched(field) {
    setTouched((t) => (t[field] ? t : { ...t, [field]: true }));
  }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setTouched({});
  }

  function openEdit(cam) {
    setEditingId(cam.id);
    setForm({
      id: cam.id,
      name: cam.name || "",
      type: cam.type || "rtsp",
      url: cam.url || "",
      camera_index: String(cam.camera_index ?? 0),
      transport: cam.transport || "tcp",
      notes: cam.notes || "",
      enabled: cam.enabled !== false,
    });
    setErrors({});
    setTouched({});
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateSourceForm(form);
    setErrors(nextErrors);
    setTouched({
      name: true,
      type: true,
      url: true,
      camera_index: true,
      transport: true,
      notes: true,
    });

    const firstKey = Object.keys(nextErrors)[0];
    if (firstKey) {
      toast.error(nextErrors[firstKey]);
      const focusMap = {
        name: "cam-name",
        url: "cam-url",
        camera_index: "cam-index",
      };
      const el = focusMap[firstKey]
        ? document.getElementById(focusMap[firstKey])
        : null;
      el?.focus();
      return;
    }

    setSaving(true);
    try {
      const saved = await upsertCamera({
        id: editingId || undefined,
        name: form.name,
        type: form.type,
        url: form.url,
        camera_index: Number(form.camera_index),
        transport: form.transport,
        notes: form.notes,
        enabled: form.enabled,
      });
      toast.success(
        editingId ? `Updated ${saved.name}` : `Added ${saved.name}`
      );
      openCreate();
    } catch (err) {
      toast.error(err.message || "Could not save camera");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection(cam) {
    setTestingId(cam.id);
    toast.info(`Testing ${cam.name}…`);
    try {
      const result = await testCamera(cam.id);
      if (result?.status) {
        patchLocalCamera(cam.id, { status: result.status });
      }
      toast.success(
        result?.message || `Connection check finished for ${cam.name}`
      );
      await refreshCameras().catch(() => {});
    } catch (err) {
      toast.error(err.message || `Connection failed for ${cam.name}`);
    } finally {
      setTestingId(null);
    }
  }

  async function handleStart(cam) {
    setActionId(cam.id);
    try {
      const result = await startCamera(cam.id);
      patchLocalCamera(cam.id, {
        status: result?.status || "starting",
        job_id: result?.job_id ?? null,
        stream_url: result?.stream_url ?? null,
      });
      toast.success(
        result?.message || `Started ${result?.camera_name || cam.name}`
      );
      await refreshCameras().catch(() => {});
    } catch (err) {
      toast.error(err.message || `Could not start ${cam.name}`);
    } finally {
      setActionId(null);
    }
  }

  async function handleStop(cam) {
    setActionId(cam.id);
    try {
      const result = await stopCamera(cam.id);
      patchLocalCamera(cam.id, {
        status: result?.status || "idle",
        job_id: null,
        stream_url: null,
      });
      toast.info(result?.message || `Stop requested for ${cam.name}`);
      await refreshCameras().catch(() => {});
    } catch (err) {
      toast.error(err.message || `Could not stop ${cam.name}`);
    } finally {
      setActionId(null);
    }
  }

  async function handleToggleEnabled(cam) {
    setActionId(cam.id);
    try {
      await setEnabled(cam.id, !cam.enabled);
      toast.success(
        cam.enabled ? `Disabled ${cam.name}` : `Enabled ${cam.name}`
      );
    } catch (err) {
      toast.error(err.message || "Could not update camera");
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(cam) {
    if (!window.confirm(`Delete “${cam.name}”?`)) return;
    setActionId(cam.id);
    try {
      await removeCamera(cam.id);
      if (editingId === cam.id) openCreate();
      toast.info("Camera removed");
    } catch (err) {
      toast.error(err.message || "Could not delete camera");
    } finally {
      setActionId(null);
    }
  }

  const fieldClass =
    "mt-1.5 w-full rounded-xl border bg-elevated px-3 py-2.5 text-sm font-medium text-ink outline-none transition-colors placeholder:text-dim focus:bg-panel";
  const fieldOk = "border-line focus:border-accent";
  const fieldErr =
    "border-danger bg-danger-soft/40 focus:border-danger focus:ring-2 focus:ring-danger/20";

  function inputClass(field, extra = "") {
    const hasError = Boolean(errors[field] && touched[field]);
    return `${fieldClass} ${hasError ? fieldErr : fieldOk} ${extra}`.trim();
  }

  return (
    <div className="flex w-full flex-col gap-5">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-accent"
            style={{ background: "var(--theme-brand-soft)" }}
          >
            <CameraIcon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="m-0 text-[1.75rem] leading-tight font-bold tracking-tight text-ink">
              Cameras
            </h1>
            <p className="m-0 mt-1 text-sm text-muted">RTSP · Webcam · HTTP sources</p>
          </div>
        </div>
        <p className="m-0 text-xs font-medium text-muted">
          <Link to="/" className="hover:text-ink">
            Home
          </Link>
          <span className="mx-1.5 text-dim">›</span>
          <span className="text-ink">Cameras</span>
        </p>
      </div>

      {/* Info banner */}
      <section className="cameras-sources-banner">
        <div className="cameras-sources-content">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[#1677E8] text-white shadow-[0_4px_12px_rgba(22,119,232,0.28)]">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M8 7h11M8 12h11M8 17h8" strokeLinecap="round" />
              <path d="M4 6v12" strokeLinecap="round" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 className="m-0 text-[1.125rem] leading-none font-bold tracking-tight text-ink">
              Cameras & sources
            </h2>
            <p className="m-0 mt-2 text-[0.875rem] leading-[1.55] text-muted">
              Cameras are stored on the backend. Add RTSP, webcam, or HTTP
              sources, then start an enabled camera from{" "}
              <Link
                to="/live"
                className="font-semibold text-accent hover:underline"
              >
                Live
              </Link>{" "}
              to show the AI-processed stream.
            </p>
          </div>
        </div>

        <div className="cameras-sources-actions">
          <button
            type="button"
            disabled={batchBusy || loading}
            onClick={handleStartAll}
            className="inline-flex h-8 items-center rounded-full bg-accent px-3.5 text-xs font-bold text-white shadow-sm hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {batchBusy ? "Working…" : "Start all"}
          </button>
          <button
            type="button"
            disabled={batchBusy || loading}
            onClick={handleStopAll}
            className="inline-flex h-8 items-center rounded-full border border-danger/40 bg-danger-soft px-3.5 text-xs font-bold text-danger hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Stop all
          </button>
          <button
            type="button"
            onClick={() => {
              refreshCameras().catch((err) =>
                toast.error(err.message || "Could not refresh cameras")
              );
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#B7D4F8] bg-white px-3.5 text-xs font-bold text-[#123B66] shadow-sm transition-colors hover:bg-[#F5F9FF] dark:border-line dark:bg-panel dark:text-ink dark:hover:bg-panel-hover"
          >
            <ResetIcon className="h-3.5 w-3.5" />
            Refresh
          </button>
          <span className="cameras-sources-badge">
            {loading ? "Loading…" : `${cameras.length} saved`}
          </span>
        </div>
      </section>

      {batchSummary ? (
        <section className="rounded-xl border border-line bg-panel px-4 py-3 text-sm shadow-sm">
          <p className="m-0 font-semibold text-ink">
            {batchSummary.kind === "start" ? "Start all result" : "Stop all result"}
          </p>
          <p className="m-0 mt-1 text-xs text-muted">
            {batchSummary.kind === "start"
              ? `${batchSummary.started} starting · ${batchSummary.already_running} already running · ${batchSummary.skipped} skipped · ${batchSummary.failed} failed`
              : `Status ${batchSummary.status} · ${batchSummary.requested} requested · ${batchSummary.already_stopped} already stopped · ${batchSummary.failed} failed`}
          </p>
          {batchSummary.results?.length ? (
            <ul className="m-0 mt-2 list-none space-y-1 p-0">
              {batchSummary.results.filter(Boolean).map((row) => (
                <li
                  key={`${row.camera_id}-${row.job_id || row.status}`}
                  className="text-xs text-muted"
                >
                  <span className="font-semibold text-ink">
                    {row.camera_name || row.camera_id}
                  </span>
                  {" · "}
                  {row.status || "unknown"}
                  {row.message ? ` — ${row.message}` : ""}
                  {row.stream_url ? (
                    <>
                      {" · "}
                      <Link
                        to="/live"
                        className="font-semibold text-accent hover:underline"
                      >
                        Open in Live
                      </Link>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {loadError ? (
        <p className="m-0 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          {loadError}{" "}
          <button
            type="button"
            onClick={() => refreshCameras().catch(() => {})}
            className="ml-2 font-semibold underline"
          >
            Retry
          </button>
        </p>
      ) : null}

      {/* Two columns */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1.15fr_0.95fr]">
        {/* Add source */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
          className="rounded-[18px] border border-[#E5EAF2] bg-panel p-5 shadow-[0_8px_24px_rgba(15,42,74,0.06)] sm:p-6"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-white">
              <PlusIcon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="m-0 text-lg font-bold text-ink">
                {editingId ? "Edit source" : "Add source"}
              </h3>
              <p className="m-0 mt-0.5 text-sm text-muted">
                Configure and add a new camera source
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col text-xs font-semibold text-muted sm:col-span-2">
              <span>
                Name
                <RequiredMark />
              </span>
              <input
                id="cam-name"
                name="name"
                autoComplete="off"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                onBlur={() => markTouched("name")}
                placeholder="Gate Camera 1"
                aria-invalid={Boolean(errors.name && touched.name)}
                aria-describedby={errors.name ? "cam-name-error" : undefined}
                className={inputClass("name")}
              />
              <span id="cam-name-error">
                <FieldError message={touched.name ? errors.name : ""} />
              </span>
            </label>

            <FilterSelect
              label="Type"
              value={form.type}
              onChange={(type) => {
                setForm((f) => ({ ...f, type }));
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.type;
                  delete next.url;
                  delete next.camera_index;
                  delete next.transport;
                  return next;
                });
              }}
              options={SOURCE_TYPES}
              labelClassName={FORM_SELECT_LABEL}
              className="min-w-0"
            />

            {form.type === "webcam" ? (
              <label className="flex flex-col text-xs font-semibold text-muted">
                <span>
                  Camera index
                  <RequiredMark />
                </span>
                <input
                  id="cam-index"
                  name="camera_index"
                  type="number"
                  min="0"
                  step="1"
                  value={form.camera_index}
                  onChange={(e) => updateField("camera_index", e.target.value)}
                  onBlur={() => markTouched("camera_index")}
                  aria-invalid={Boolean(errors.camera_index && touched.camera_index)}
                  aria-describedby={
                    errors.camera_index ? "cam-index-error" : undefined
                  }
                  className={inputClass("camera_index")}
                />
                <span id="cam-index-error">
                  <FieldError
                    message={touched.camera_index ? errors.camera_index : ""}
                  />
                </span>
              </label>
            ) : (
              <FilterSelect
                label="Transport"
                value={form.transport}
                onChange={(transport) => updateField("transport", transport)}
                options={TRANSPORT_OPTIONS}
                disabled={form.type !== "rtsp"}
                labelClassName={FORM_SELECT_LABEL}
                className="min-w-0"
              />
            )}

            {form.type !== "webcam" ? (
              <label className="flex flex-col text-xs font-semibold text-muted sm:col-span-2">
                <span>
                  Connection URL
                  <RequiredMark />
                </span>
                <span className="relative mt-1.5 block">
                  <svg
                    className={`pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 ${
                      errors.url && touched.url ? "text-danger" : "text-accent"
                    }`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 5" strokeLinecap="round" />
                    <path d="M14 11a5 5 0 0 0-7.07 0L4.8 13.12a5 5 0 0 0 7.07 7.07L13 19" strokeLinecap="round" />
                  </svg>
                  <input
                    id="cam-url"
                    name="url"
                    autoComplete="off"
                    spellCheck={false}
                    value={form.url}
                    onChange={(e) => updateField("url", e.target.value)}
                    onBlur={() => markTouched("url")}
                    placeholder={
                      form.type === "rtsp"
                        ? "rtsp://user:pass@192.168.1.10:554/stream1"
                        : "http://192.168.1.10/mjpeg"
                    }
                    aria-invalid={Boolean(errors.url && touched.url)}
                    aria-describedby={errors.url ? "cam-url-error" : undefined}
                    className={inputClass("url", "mt-0 pl-10 font-mono text-[0.8rem]")}
                  />
                </span>
                <span id="cam-url-error">
                  <FieldError message={touched.url ? errors.url : ""} />
                </span>
              </label>
            ) : null}

            <label className="flex flex-col text-xs font-semibold text-muted sm:col-span-2">
              Notes (optional)
              <input
                name="notes"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                onBlur={() => markTouched("notes")}
                placeholder="North gate - outdoor"
                aria-invalid={Boolean(errors.notes && touched.notes)}
                className={inputClass("notes")}
              />
              <FieldError message={touched.notes ? errors.notes : ""} />
            </label>

            <div className="flex items-start justify-between gap-3 rounded-xl border border-line bg-elevated/60 px-3 py-3 sm:col-span-2">
              <div>
                <p className="m-0 text-sm font-semibold text-ink">
                  Enabled (show in Live picker)
                </p>
                <p className="m-0 mt-0.5 text-xs text-muted">
                  Enable this source to make it available in the Live view
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.enabled}
                onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
                className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors ${
                  form.enabled ? "bg-accent" : "bg-line-strong"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    form.enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover disabled:opacity-60"
            >
              <PlusIcon className="h-4 w-4" />
              {saving
                ? "Saving…"
                : editingId
                  ? "Save changes"
                  : "Add camera"}
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-accent bg-panel px-4 py-2.5 text-sm font-semibold text-accent hover:bg-accent-soft"
            >
              <ResetIcon className="h-4 w-4" />
              Reset
            </button>
            {Object.keys(errors).length > 0 ? (
              <p className="m-0 w-full text-xs font-medium text-danger sm:ml-1 sm:w-auto">
                Fix the highlighted fields to continue
              </p>
            ) : null}
          </div>
        </form>

        {/* Saved sources */}
        <section className="flex min-h-[420px] flex-col rounded-[18px] border border-[#E5EAF2] bg-panel p-5 shadow-[0_8px_24px_rgba(15,42,74,0.06)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-accent"
                style={{ background: "var(--theme-brand-soft)" }}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <h3 className="m-0 text-lg font-bold text-ink">Saved sources</h3>
                <p className="m-0 mt-0.5 text-sm text-muted">Manage your camera sources</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search sources..."
                  className="h-9 w-40 rounded-xl border border-line bg-elevated pr-3 pl-8 text-xs text-ink outline-none focus:border-accent sm:w-48"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowFilter((v) => !v)}
                className={`grid h-9 w-9 place-items-center rounded-xl border ${
                  showFilter || typeFilter !== "all"
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line bg-elevated text-muted"
                }`}
                aria-label="Filter"
              >
                <FilterIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {showFilter ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {[{ id: "all", label: "All" }, ...SOURCE_TYPES].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeFilter(t.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    typeFilter === t.id
                      ? "bg-accent text-white"
                      : "bg-elevated text-muted hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          ) : null}

          {loading && cameras.length === 0 ? (
            <p className="m-0 mt-8 text-center text-sm text-muted">
              Loading cameras from backend…
            </p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
              <span
                className="grid h-24 w-24 place-items-center rounded-full"
                style={{ background: "var(--theme-brand-soft)" }}
              >
                <CameraIcon className="h-10 w-10 text-accent" />
              </span>
              <h4 className="m-0 mt-5 text-lg font-bold text-ink">No cameras yet</h4>
              <p className="m-0 mt-2 max-w-sm text-sm text-muted">
                Add an RTSP, webcam, or HTTP source using the form on the left.
              </p>
              <button
                type="button"
                onClick={() => {
                  openCreate();
                  formRef.current?.scrollIntoView({ behavior: "smooth" });
                }}
                className="mt-5 inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
              >
                <PlusIcon className="h-4 w-4" />
                Add your first camera
              </button>
            </div>
          ) : (
            <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
              {filtered.map((cam) => {
                const busy = actionId === cam.id || testingId === cam.id;
                const running =
                  String(cam.status || "").toLowerCase() === "processing" ||
                  String(cam.status || "").toLowerCase() === "starting";
                return (
                <li
                  key={cam.id}
                  className="rounded-2xl border border-line bg-elevated/40 px-4 py-3.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="m-0 truncate text-sm font-bold text-ink">
                          {cam.name}
                        </p>
                        <StatusPill cam={cam} />
                      </div>
                      <p className="m-0 mt-1 text-xs font-medium text-muted">
                        {typeLabel(cam.type)}
                        {cam.type === "webcam"
                          ? ` · index ${cam.camera_index ?? 0}`
                          : ""}
                        {" · "}
                        {cam.enabled ? "Enabled" : "Disabled"}
                        {cam.job_id ? ` · ${cam.job_id}` : ""}
                      </p>
                      {cam.notes ? (
                        <p className="m-0 mt-1 text-xs text-muted">{cam.notes}</p>
                      ) : null}
                      {cam.url ? (
                        <p className="m-0 mt-1 truncate font-mono text-[0.65rem] text-dim">
                          {cam.url}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Link
                        to="/live"
                        className="rounded-lg border border-line bg-panel px-2.5 py-1 text-[0.7rem] font-semibold text-ink hover:bg-elevated"
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openEdit(cam)}
                        className="cursor-pointer rounded-lg border border-line bg-panel px-2.5 py-1 text-[0.7rem] font-semibold text-ink hover:bg-elevated disabled:opacity-60"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => testConnection(cam)}
                        className="cursor-pointer rounded-lg border border-line bg-panel px-2.5 py-1 text-[0.7rem] font-semibold text-ink hover:bg-elevated disabled:opacity-60"
                      >
                        {testingId === cam.id ? "Testing…" : "Test"}
                      </button>
                      {running ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleStop(cam)}
                          className="cursor-pointer rounded-lg border border-danger/30 bg-danger-soft px-2.5 py-1 text-[0.7rem] font-semibold text-danger disabled:opacity-60"
                        >
                          {actionId === cam.id ? "Stopping…" : "Stop"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy || !cam.enabled}
                          onClick={() => handleStart(cam)}
                          className="cursor-pointer rounded-lg border border-accent/40 bg-accent-soft px-2.5 py-1 text-[0.7rem] font-semibold text-accent hover:bg-accent hover:text-white disabled:opacity-60"
                        >
                          {actionId === cam.id ? "Starting…" : "Start"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleToggleEnabled(cam)}
                        className="cursor-pointer rounded-lg border border-line bg-panel px-2.5 py-1 text-[0.7rem] font-semibold text-muted hover:bg-elevated disabled:opacity-60"
                      >
                        {cam.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDelete(cam)}
                        className="cursor-pointer rounded-lg border border-danger/30 bg-danger-soft px-2.5 py-1 text-[0.7rem] font-semibold text-danger disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
