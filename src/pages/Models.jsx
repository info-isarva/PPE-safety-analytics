import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  activateModel,
  getActiveModel,
  getModels,
  getTrainingStatus,
  renameModel,
  startDatasetTraining,
  uploadDataset,
} from "../api/endpoints";
import { useToast } from "../components/common/ToastContext";

const DATASETS_KEY = "ppe-recent-datasets";
const TRAIN_JOB_KEY = "ppe-active-training-job";
const POLL_MS = 2500;

const DEFAULT_TRAIN = {
  model_name: "",
  epochs: "30",
  imgsz: "320",
  batch: "4",
  device: "cpu",
};

function readRecentDatasets() {
  try {
    const raw = localStorage.getItem(DATASETS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeRecentDatasets(list) {
  localStorage.setItem(DATASETS_KEY, JSON.stringify(list.slice(0, 12)));
}

function rememberDataset(dataset) {
  if (!dataset?.dataset_id) return;
  const prev = readRecentDatasets().filter(
    (d) => d.dataset_id !== dataset.dataset_id
  );
  writeRecentDatasets([
    {
      dataset_id: dataset.dataset_id,
      name: dataset.name || dataset.dataset_id,
      status: dataset.status || "validated",
      uploaded_at: new Date().toISOString(),
    },
    ...prev,
  ]);
}

function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "completed" || s === "validated" || s === "active") {
    return "bg-ok-soft text-ok";
  }
  if (s === "running" || s === "queued" || s === "training") {
    return "bg-accent-soft text-accent";
  }
  if (s === "failed" || s === "error") {
    return "bg-danger-soft text-danger";
  }
  return "bg-elevated text-muted";
}

function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold capitalize ${statusTone(status)}`}
    >
      {status || "unknown"}
    </span>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-line bg-elevated/60 px-3 py-2">
      <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="m-0 mt-0.5 text-sm font-bold text-ink">{value}</p>
    </div>
  );
}

export default function Models() {
  const toast = useToast();
  const fileRef = useRef(null);

  const [datasets, setDatasets] = useState(() => readRecentDatasets());
  const [selectedId, setSelectedId] = useState(
    () => readRecentDatasets()[0]?.dataset_id || ""
  );
  const [uploading, setUploading] = useState(false);
  const [datasetName, setDatasetName] = useState("");
  const [trainForm, setTrainForm] = useState(DEFAULT_TRAIN);
  const [startingTrain, setStartingTrain] = useState(false);

  const [jobId, setJobId] = useState(
    () => localStorage.getItem(TRAIN_JOB_KEY) || ""
  );
  const [training, setTraining] = useState(null);
  const [polling, setPolling] = useState(false);

  const [models, setModels] = useState([]);
  const [active, setActive] = useState(null);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState(null);
  const [busyModelId, setBusyModelId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

  const selected = datasets.find((d) => d.dataset_id === selectedId) || null;
  const canTrain =
    selected &&
    String(selected.status || "").toLowerCase() !== "failed" &&
    !startingTrain;

  const refreshModels = useCallback(async () => {
    setModelsError(null);
    try {
      const [list, activeModel] = await Promise.all([
        getModels(),
        getActiveModel(),
      ]);
      setModels(Array.isArray(list) ? list : list?.models || []);
      setActive(activeModel);
    } catch (err) {
      setModelsError(err.message || "Failed to load models");
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshModels();
  }, [refreshModels]);

  useEffect(() => {
    if (!selected) return;
    setTrainForm((f) =>
      f.model_name
        ? f
        : {
            ...f,
            model_name: `${selected.name || "Custom Model"} V1`,
          }
    );
  }, [selected]);

  const pollTraining = useCallback(
    async (id) => {
      if (!id) return;
      setPolling(true);
      try {
        const status = await getTrainingStatus(id);
        setTraining(status);
        const s = String(status?.status || "").toLowerCase();
        if (s === "completed") {
          localStorage.removeItem(TRAIN_JOB_KEY);
          setJobId("");
          toast.success("Training completed");
          refreshModels();
          setPolling(false);
          return false;
        }
        if (s === "failed" || s === "error") {
          localStorage.removeItem(TRAIN_JOB_KEY);
          setJobId("");
          toast.error(status?.message || "Training failed");
          setPolling(false);
          return false;
        }
        return true;
      } catch (err) {
        toast.error(err.message || "Could not fetch training status");
        setPolling(false);
        return false;
      }
    },
    [refreshModels, toast]
  );

  useEffect(() => {
    if (!jobId) return undefined;
    let cancelled = false;
    let timer;

    async function tick() {
      const keepGoing = await pollTraining(jobId);
      if (!cancelled && keepGoing) {
        timer = window.setTimeout(tick, POLL_MS);
      }
    }

    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [jobId, pollTraining]);

  function nameFromZip(filename) {
    return String(filename || "")
      .replace(/\.zip$/i, "")
      .replace(/\.v\d+i\.[^.]+$/i, "")
      .replace(/[_-]+/g, " ")
      .trim();
  }

  async function handleUpload(file, nameOverride) {
    if (!file) return;
    if (!/\.zip$/i.test(file.name)) {
      toast.error("Please upload a .zip dataset file");
      return;
    }
    const name =
      String(nameOverride || datasetName || "").trim() ||
      nameFromZip(file.name) ||
      "dataset";
    setDatasetName(name);
    setUploading(true);
    try {
      const result = await uploadDataset(file, name);
      const saved = {
        dataset_id: result.dataset_id,
        name: result.name || name,
        status: result.status || "validated",
        uploaded_at: new Date().toISOString(),
      };
      rememberDataset(saved);
      const next = readRecentDatasets();
      setDatasets(next);
      setSelectedId(saved.dataset_id);
      setTrainForm((f) => ({
        ...f,
        model_name: `${saved.name || "Custom Model"} V1`,
      }));
      toast.success(
        saved.status === "validated"
          ? `Dataset validated · ${saved.dataset_id}`
          : `Dataset uploaded · ${saved.dataset_id}`
      );
    } catch (err) {
      toast.error(err.message || "Dataset upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleTrain(event) {
    event.preventDefault();
    if (!selected?.dataset_id) {
      toast.error("Select a validated dataset first");
      return;
    }
    const modelName = trainForm.model_name.trim();
    if (!modelName) {
      toast.error("Model name is required");
      return;
    }
    setStartingTrain(true);
    try {
      const job = await startDatasetTraining(selected.dataset_id, {
        model_name: modelName,
        epochs: Number(trainForm.epochs) || 30,
        imgsz: Number(trainForm.imgsz) || 320,
        batch: Number(trainForm.batch) || 4,
        device: trainForm.device || "cpu",
      });
      const id = job.job_id || job.id;
      if (!id) throw new Error("Training started but no job_id returned");
      localStorage.setItem(TRAIN_JOB_KEY, id);
      setJobId(id);
      setTraining({
        job_id: id,
        status: job.status || "queued",
        progress: 0,
        epoch: 0,
        total_epochs: Number(trainForm.epochs) || 30,
      });
      toast.success("Training queued");
    } catch (err) {
      toast.error(err.message || "Could not start training");
    } finally {
      setStartingTrain(false);
    }
  }

  async function handleActivate(model) {
    setBusyModelId(model.id);
    try {
      await activateModel(model.id);
      toast.success(`Activated · ${model.name}`);
      await refreshModels();
    } catch (err) {
      toast.error(err.message || "Could not activate model");
    } finally {
      setBusyModelId(null);
    }
  }

  async function handleRename(model) {
    const name = editName.trim();
    if (!name) {
      toast.error("Name cannot be empty");
      return;
    }
    setBusyModelId(model.id);
    try {
      await renameModel(model.id, name);
      toast.success("Model renamed");
      setEditingId(null);
      await refreshModels();
    } catch (err) {
      toast.error(err.message || "Could not rename model");
    } finally {
      setBusyModelId(null);
    }
  }

  const progress = Math.max(
    0,
    Math.min(100, Number(training?.progress ?? 0))
  );
  const trainStatus = String(training?.status || "").toLowerCase();
  const isTrainActive =
    Boolean(jobId) &&
    (trainStatus === "queued" ||
      trainStatus === "running" ||
      trainStatus === "training" ||
      polling);

  const fieldClass =
    "mt-1.5 w-full rounded-xl border border-line bg-elevated px-3 py-2.5 text-sm font-medium text-ink outline-none transition-colors placeholder:text-dim focus:border-accent focus:bg-panel";

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-accent"
            style={{ background: "var(--theme-brand-soft)" }}
          >
            <ModelIcon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="m-0 text-[1.75rem] leading-tight font-bold tracking-tight text-ink">
              Models
            </h1>
            <p className="m-0 mt-1 text-sm text-muted">
              Upload dataset · Train YOLO · Activate detection model
            </p>
          </div>
        </div>
        <p className="m-0 text-xs font-medium text-muted">
          <Link to="/" className="hover:text-ink">
            Home
          </Link>
          <span className="mx-1.5 text-dim">›</span>
          <span className="text-ink">Models</span>
        </p>
      </div>

      {/* Active model */}
      <section className="rounded-[18px] border border-[#B9D9FF] bg-gradient-to-r from-[#F7FBFF] via-[#EFF7FF] to-[#E5F2FF] p-5 shadow-[0_4px_14px_rgba(35,103,166,0.08)] dark:border-line dark:from-panel dark:via-panel dark:to-elevated">
        <p className="m-0 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted">
          Active model
        </p>
        {active ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-lg font-bold text-ink">{active.name}</h2>
              <p className="m-0 mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                <StatusPill status="active" />
                <span>ID {active.id}</span>
                {active.status ? (
                  <StatusPill status={active.status} />
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={refreshModels}
              className="rounded-xl border border-line bg-panel px-3 py-2 text-xs font-semibold text-ink hover:bg-panel-hover"
            >
              Refresh
            </button>
          </div>
        ) : (
          <p className="m-0 mt-2 text-sm text-muted">
            No active model yet. Train a dataset, then activate a model below.
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        {/* Dataset upload + train */}
        <div className="flex flex-col gap-5">
          <section className="rounded-[18px] border border-line bg-panel p-5 shadow-[0_8px_24px_rgba(15,42,74,0.06)] sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-white">
                <UploadIcon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="m-0 text-lg font-bold text-ink">Upload dataset</h3>
                <p className="m-0 mt-0.5 text-sm text-muted">
                  YOLO ZIP with train / val / test images, labels, and classes
                </p>
              </div>
            </div>

            <label className="mt-5 flex flex-col text-xs font-semibold text-muted">
              Dataset name
              <span className="font-normal text-dim">
                {" "}
                (required by API as query param <code>name</code>)
              </span>
              <input
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                placeholder="Construction Site"
                className={fieldClass}
              />
            </label>

            <div className="mt-4 rounded-2xl border border-dashed border-line bg-elevated/50 px-4 py-8 text-center">
              <input
                ref={fileRef}
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const inferred =
                    datasetName.trim() || nameFromZip(file.name);
                  if (!datasetName.trim()) setDatasetName(inferred);
                  handleUpload(file, inferred);
                }}
              />
              <p className="m-0 text-sm font-semibold text-ink">
                Drop a dataset ZIP or browse
              </p>
              <p className="m-0 mt-1 text-xs text-muted">
                Example: Construction Site.v1i.yolo26.zip
              </p>
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
              >
                {uploading ? "Uploading…" : "Choose ZIP file"}
              </button>
            </div>

            {datasets.length > 0 ? (
              <div className="mt-5">
                <p className="m-0 mb-2 text-xs font-semibold text-muted">
                  Recent datasets (this browser)
                </p>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {datasets.map((d) => {
                    const isSelected = d.dataset_id === selectedId;
                    return (
                      <li key={d.dataset_id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(d.dataset_id)}
                          className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                            isSelected
                              ? "border-accent bg-accent-soft"
                              : "border-line bg-elevated hover:bg-panel-hover"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="m-0 truncate text-sm font-semibold text-ink">
                              {d.name}
                            </p>
                            <p className="m-0 mt-0.5 truncate font-mono text-[0.7rem] text-muted">
                              {d.dataset_id}
                            </p>
                          </div>
                          <StatusPill status={d.status} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="rounded-[18px] border border-line bg-panel p-5 shadow-[0_8px_24px_rgba(15,42,74,0.06)] sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-white">
                <TrainIcon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="m-0 text-lg font-bold text-ink">Train model</h3>
                <p className="m-0 mt-0.5 text-sm text-muted">
                  {selected
                    ? `Dataset ${selected.dataset_id}`
                    : "Select a validated dataset to enable training"}
                </p>
              </div>
            </div>

            <form onSubmit={handleTrain} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col text-xs font-semibold text-muted sm:col-span-2">
                Model name
                <input
                  required
                  value={trainForm.model_name}
                  onChange={(e) =>
                    setTrainForm((f) => ({ ...f, model_name: e.target.value }))
                  }
                  placeholder="Construction Safety Model V2"
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col text-xs font-semibold text-muted">
                Epochs
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={trainForm.epochs}
                  onChange={(e) =>
                    setTrainForm((f) => ({ ...f, epochs: e.target.value }))
                  }
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col text-xs font-semibold text-muted">
                Image size
                <input
                  type="number"
                  min="64"
                  step="32"
                  value={trainForm.imgsz}
                  onChange={(e) =>
                    setTrainForm((f) => ({ ...f, imgsz: e.target.value }))
                  }
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col text-xs font-semibold text-muted">
                Batch
                <input
                  type="number"
                  min="1"
                  max="64"
                  value={trainForm.batch}
                  onChange={(e) =>
                    setTrainForm((f) => ({ ...f, batch: e.target.value }))
                  }
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col text-xs font-semibold text-muted">
                Device
                <select
                  value={trainForm.device}
                  onChange={(e) =>
                    setTrainForm((f) => ({ ...f, device: e.target.value }))
                  }
                  className={fieldClass}
                >
                  <option value="cpu">CPU</option>
                  <option value="cuda">CUDA (GPU)</option>
                  <option value="0">GPU 0</option>
                </select>
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={!canTrain || isTrainActive}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <TrainIcon className="h-4 w-4" />
                  {startingTrain
                    ? "Starting…"
                    : isTrainActive
                      ? "Training in progress…"
                      : "Train model"}
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Training progress + models list */}
        <div className="flex flex-col gap-5">
          <section className="rounded-[18px] border border-line bg-panel p-5 shadow-[0_8px_24px_rgba(15,42,74,0.06)] sm:p-6">
            <h3 className="m-0 text-lg font-bold text-ink">Training progress</h3>
            <p className="m-0 mt-0.5 text-sm text-muted">
              Polls <code className="text-xs">GET /training/&#123;job_id&#125;</code>
            </p>

            {training || jobId ? (
              <div className="mt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusPill status={training?.status || "queued"} />
                  <p className="m-0 font-mono text-[0.7rem] text-muted">
                    {training?.job_id || jobId}
                  </p>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-elevated">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="m-0 mt-2 text-sm font-semibold text-ink">
                  {progress}%
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Metric
                    label="Epoch"
                    value={`${training?.epoch ?? "—"} / ${training?.total_epochs ?? "—"}`}
                  />
                  <Metric
                    label="Status"
                    value={
                      trainStatus === "running" || trainStatus === "training"
                        ? "Training…"
                        : training?.status || "—"
                    }
                  />
                  <Metric
                    label="Job"
                    value={jobId ? "Tracking" : "Idle"}
                  />
                </div>
              </div>
            ) : (
              <p className="m-0 mt-5 rounded-xl border border-line bg-elevated/50 px-4 py-6 text-center text-sm text-muted">
                Start training to see live progress here.
              </p>
            )}
          </section>

          <section className="rounded-[18px] border border-line bg-panel p-5 shadow-[0_8px_24px_rgba(15,42,74,0.06)] sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="m-0 text-lg font-bold text-ink">Trained models</h3>
                <p className="m-0 mt-0.5 text-sm text-muted">
                  Rename or activate for detection
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModelsLoading(true);
                  refreshModels();
                }}
                className="rounded-xl border border-line bg-elevated px-3 py-2 text-xs font-semibold text-ink hover:bg-panel-hover"
              >
                Refresh list
              </button>
            </div>

            {modelsLoading ? (
              <p className="m-0 mt-5 text-sm text-muted">Loading models…</p>
            ) : modelsError ? (
              <p className="m-0 mt-5 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
                {modelsError}
              </p>
            ) : models.length === 0 ? (
              <p className="m-0 mt-5 rounded-xl border border-line bg-elevated/50 px-4 py-6 text-center text-sm text-muted">
                No trained models yet.
              </p>
            ) : (
              <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
                {models.map((model) => {
                  const isActive = Boolean(model.active);
                  const isEditing = editingId === model.id;
                  return (
                    <li
                      key={model.id}
                      className="rounded-xl border border-line bg-elevated/40 p-3 sm:p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <div className="flex flex-wrap gap-2">
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="min-w-[12rem] flex-1 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent"
                              />
                              <button
                                type="button"
                                disabled={busyModelId === model.id}
                                onClick={() => handleRename(model)}
                                className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs font-semibold text-muted"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <p className="m-0 text-sm font-bold text-ink">
                              {model.name}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <StatusPill status={model.status} />
                            {isActive ? (
                              <StatusPill status="active" />
                            ) : (
                              <span className="text-[0.7rem] font-semibold text-muted">
                                Inactive
                              </span>
                            )}
                            <span className="text-[0.7rem] text-muted">
                              ID {model.id}
                            </span>
                          </div>
                          {(model.precision != null ||
                            model.map50 != null ||
                            model.mAP50 != null) && (
                            <p className="m-0 mt-2 text-[0.7rem] text-muted">
                              {model.precision != null
                                ? `P ${(Number(model.precision) * (Number(model.precision) <= 1 ? 100 : 1)).toFixed(1)}%`
                                : null}
                              {model.recall != null
                                ? ` · R ${(Number(model.recall) * (Number(model.recall) <= 1 ? 100 : 1)).toFixed(1)}%`
                                : null}
                              {(model.map50 ?? model.mAP50) != null
                                ? ` · mAP50 ${(Number(model.map50 ?? model.mAP50) * (Number(model.map50 ?? model.mAP50) <= 1 ? 100 : 1)).toFixed(1)}%`
                                : null}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {!isEditing ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(model.id);
                                setEditName(model.name || "");
                              }}
                              className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-panel-hover"
                            >
                              Rename
                            </button>
                          ) : null}
                          {!isActive ? (
                            <button
                              type="button"
                              disabled={busyModelId === model.id}
                              onClick={() => handleActivate(model)}
                              className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
                            >
                              {busyModelId === model.id
                                ? "Activating…"
                                : "Activate"}
                            </button>
                          ) : (
                            <span className="rounded-lg bg-ok-soft px-2.5 py-1.5 text-xs font-semibold text-ok">
                              In use
                            </span>
                          )}
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
    </div>
  );
}

function ModelIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" strokeLinejoin="round" />
      <path d="M12 12 4 7M12 12l8-5M12 12v10" strokeLinecap="round" />
    </svg>
  );
}

function UploadIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 16V5M8 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" strokeLinecap="round" />
    </svg>
  );
}

function TrainIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" strokeLinecap="round" />
    </svg>
  );
}
