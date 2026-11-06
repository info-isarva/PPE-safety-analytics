import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchEventsCsv,
  getCameras,
  getReportStats,
} from "../api/endpoints";
import { useToast } from "../components/common/ToastContext";
import {
  buildReportSheet,
  downloadCsv,
  fileSlug,
  ReportCatalog,
  ReportDetail,
  ReportPageHeader,
  ReportSidebar,
} from "./reportChrome";
import { downloadExcelReport, downloadPdfReport, sheetFromCsv } from "./reportExport";

const FAVORITES_KEY = "ppe-report-favorites";
const VISITS_KEY = "ppe-report-visits";

const RANGES = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom range" },
];

const CATEGORIES = [
  { id: "overview", label: "Overview" },
  { id: "ppe", label: "PPE Violations" },
  { id: "workers", label: "Worker Reports" },
  { id: "zone", label: "Restricted Zone" },
  { id: "exports", label: "Export" },
];

const BLURBS = {
  dashboard: "A consolidated view of workers, compliance and safety violations.",
  "by-type": "Event totals grouped by type for the selected dates.",
  daily: "Event counts for each day in the selected range.",
  trend: "Event trend across the selected window.",
  hourly: "Events grouped by hour of day.",
  "by-class": "PPE violations grouped by class.",
  "by-camera": "PPE violations grouped by camera.",
  "ppe-dist": "Share of each PPE class in the selected dates.",
  compliance: "Compliance rate for the selected dates.",
  "compliance-history": "Worker compliance records in this range.",
  repeat: "People seen more than once in this range.",
  workers: "Workers counted in the selected dates.",
  violations: "Violations counted in the selected dates.",
  "zone-camera": "Restricted-zone events grouped by camera.",
  "zone-ppe": "Restricted-zone events grouped by PPE class.",
  "zone-daily": "Restricted-zone events for each day.",
  export: "Download the filtered events as Excel, PDF, or CSV.",
};

const METRIC_ORDER = [
  "total workers",
  "compliant workers",
  "total violations",
  "hardhat",
  "mask",
  "safety vest",
  "compliance rate",
];

const REPORTS = [
  {
    id: "dashboard",
    name: "Dashboard Summary",
    category: "overview",
    path: "/stats/dashboard",
    kind: "dashboard",
    filters: ["start_date", "end_date"],
  },
  {
    id: "by-type",
    name: "Events by type",
    category: "overview",
    path: "/stats/events/by-type",
    kind: "bars",
    camera: true,
    filters: ["start_date", "end_date", "camera_id"],
  },
  {
    id: "daily",
    name: "Daily event counts",
    category: "overview",
    path: "/stats/events/daily",
    kind: "bars",
    camera: true,
    filters: ["start_date", "end_date", "camera_id"],
  },
  {
    id: "trend",
    name: "Event trend",
    category: "overview",
    path: "/stats/events/trend",
    kind: "bars",
    camera: true,
    trend: true,
    filters: ["days", "camera_id"],
  },
  {
    id: "hourly",
    name: "Hourly events",
    category: "overview",
    path: "/stats/events/hourly",
    kind: "bars",
    camera: true,
    filters: ["start_date", "end_date", "camera_id"],
  },
  {
    id: "by-class",
    name: "Violations by class",
    category: "ppe",
    path: "/stats/violations/by-class",
    kind: "bars",
    camera: true,
    filters: ["start_date", "end_date", "camera_id"],
  },
  {
    id: "by-camera",
    name: "Violations by camera",
    category: "ppe",
    path: "/stats/violations/by-camera",
    kind: "bars",
    filters: ["start_date", "end_date"],
  },
  {
    id: "ppe-dist",
    name: "PPE distribution",
    category: "ppe",
    path: "/stats/ppe-distribution",
    kind: "bars",
    filters: ["start_date", "end_date"],
  },
  {
    id: "compliance",
    name: "Compliance summary",
    category: "workers",
    path: "/stats/compliance",
    kind: "dashboard",
    filters: ["start_date", "end_date"],
  },
  {
    id: "compliance-history",
    name: "Compliance history",
    category: "workers",
    path: "/stats/workers/compliance",
    kind: "records",
    camera: true,
    filters: ["start_date", "end_date", "camera_id"],
  },
  {
    id: "repeat",
    name: "Repeat persons",
    category: "workers",
    path: "/stats/workers/repeat-persons",
    kind: "repeat",
    camera: true,
    filters: ["start_date", "end_date", "camera_id"],
  },
  {
    id: "workers",
    name: "Total workers",
    category: "workers",
    path: "/stats/workers",
    kind: "dashboard",
    filters: ["start_date", "end_date"],
  },
  {
    id: "violations",
    name: "Total violations",
    category: "ppe",
    path: "/stats/violations",
    kind: "dashboard",
    filters: ["start_date", "end_date"],
  },
  {
    id: "zone-camera",
    name: "Restricted zone by camera",
    category: "zone",
    path: "/stats/violations/restricted-zone/by-camera",
    kind: "bars",
    filters: ["start_date", "end_date"],
  },
  {
    id: "zone-ppe",
    name: "Restricted zone by PPE",
    category: "zone",
    path: "/stats/violations/restricted-zone/by-ppe",
    kind: "bars",
    filters: ["start_date", "end_date"],
  },
  {
    id: "zone-daily",
    name: "Restricted zone daily",
    category: "zone",
    path: "/stats/events/restricted-zone/daily",
    kind: "bars",
    camera: true,
    filters: ["start_date", "end_date", "camera_id"],
  },
  {
    id: "export",
    name: "Event CSV export",
    category: "exports",
    kind: "export",
    camera: true,
    filters: ["start_date", "end_date", "camera_id", "event_type", "violation"],
  },
];

const LABEL_KEYS = [
  "label",
  "name",
  "violation",
  "violation_class",
  "class",
  "event_type",
  "camera_name",
  "camera",
  "camera_id",
  "hour",
  "date",
  "day",
  "ppe",
  "classification",
];
const COUNT_KEYS = ["count", "total", "value", "events", "event_count"];
const LIST_KEYS = [
  "items",
  "data",
  "results",
  "counts",
  "rows",
  "days",
  "hours",
  "records",
  "history",
  "compliance",
  "repeat_persons",
  "by_class",
  "by_camera",
  "by_type",
  "by_ppe",
];

function categoryLabel(id) {
  return CATEGORIES.find((item) => item.id === id)?.label || id;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function presetForDates(start, end) {
  for (const item of RANGES) {
    if (item.id === "custom") continue;
    const params = rangeParams(item.id);
    if (params.start_date === start && params.end_date === end) return item.id;
  }
  return "custom";
}

function parseIso(iso) {
  const [year, month, day] = String(iso || "").split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function daySpan(startIso, endIso) {
  const span = Math.round((parseIso(endIso) - parseIso(startIso)) / 86400000) + 1;
  return Math.max(1, span);
}

function previousWindow(startIso, endIso) {
  const span = daySpan(startIso, endIso);
  const end = parseIso(startIso);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - (span - 1));
  return { start_date: isoDate(start), end_date: isoDate(end) };
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rangeParams(rangeId) {
  const end = new Date();
  const start = new Date();
  if (rangeId === "month") {
    start.setDate(1);
    return { start_date: isoDate(start), end_date: isoDate(end), days: 30 };
  }
  const range = RANGES.find((item) => item.id === rangeId) || RANGES[1];
  const days = range.id === "today" || !range.days ? 1 : range.days;
  start.setDate(end.getDate() - (days - 1));
  return {
    start_date: isoDate(start),
    end_date: isoDate(end),
    days: range.id === "today" || !range.days ? 7 : range.days,
  };
}

function buildReportBody(report, { start, end, camera, eventType, violation, rangeId }) {
  const fields = report?.filters || [];
  const body = {};
  if (fields.includes("days")) {
    body.days = rangeId === "90d" ? 90 : rangeId === "30d" ? 30 : 7;
  }
  if (fields.includes("start_date")) body.start_date = start;
  if (fields.includes("end_date")) body.end_date = end;
  if (fields.includes("camera_id") && camera) body.camera_id = camera;
  if (fields.includes("event_type") && String(eventType || "").trim()) {
    body.event_type = eventType.trim();
  }
  if (fields.includes("violation") && String(violation || "").trim()) {
    body.violation = violation.trim();
  }
  return body;
}

function prettyKey(key) {
  return String(key || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDay(iso) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMetricValue(key, value, percent = false) {
  if (typeof value !== "number") return value;
  const shown = Number.isInteger(value) ? value.toLocaleString() : String(value);
  if (percent || /rate/i.test(String(key))) return `${shown}%`;
  return shown;
}

function rowFrom(item) {
  if (!item || typeof item !== "object") return null;
  const label = LABEL_KEYS.map((key) => item[key]).find(
    (value) => value != null && value !== ""
  );
  const countKey = COUNT_KEYS.find((key) => item[key] != null);
  if (label == null || !countKey) return null;
  const count = Number(item[countKey]);
  return {
    label: prettyKey(label),
    count: Number.isFinite(count) ? count : 0,
  };
}

function mapRows(object) {
  return Object.entries(object)
    .filter(([, value]) => ["number", "string"].includes(typeof value))
    .map(([label, value]) => ({
      label: prettyKey(label),
      count: Number(value) || 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function asRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.map(rowFrom).filter(Boolean);
  if (typeof payload !== "object") return [];
  if (payload.ppe_distribution && typeof payload.ppe_distribution === "object") {
    return mapRows(payload.ppe_distribution);
  }
  for (const key of LIST_KEYS) {
    if (Array.isArray(payload[key])) {
      const rows = payload[key].map(rowFrom).filter(Boolean);
      if (rows.length) return rows;
    }
    if (payload[key] && typeof payload[key] === "object") {
      const rows = mapRows(payload[key]);
      if (rows.length) return rows;
    }
  }
  const direct = payload.map ? null : mapRows(payload);
  return direct || [];
}

function firstObjectList(payload) {
  if (Array.isArray(payload)) {
    return payload.filter((item) => item && typeof item === "object");
  }
  if (!payload || typeof payload !== "object") return [];
  for (const value of Object.values(payload)) {
    if (
      Array.isArray(value) &&
      value.some((item) => item && typeof item === "object")
    ) {
      return value.filter((item) => item && typeof item === "object");
    }
  }
  return [];
}

function toTable(payload) {
  const list = firstObjectList(payload);
  if (list.length) {
    const columns = [];
    for (const row of list) {
      for (const key of Object.keys(row)) {
        if (!columns.includes(key)) columns.push(key);
      }
    }
    return { columns, rows: list };
  }
  const metrics = [];
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    for (const [key, value] of Object.entries(payload)) {
      if (["number", "string"].includes(typeof value)) {
        metrics.push({
          key,
          metric: prettyKey(key),
          value: formatMetricValue(key, value),
          raw: typeof value === "number" ? value : Number(value),
          points: /rate/i.test(key),
        });
      } else if (value && typeof value === "object" && !Array.isArray(value)) {
        const percent = key === "ppe_distribution";
        for (const [child, childValue] of Object.entries(value)) {
          if (["number", "string"].includes(typeof childValue)) {
            metrics.push({
              key: child,
              metric: prettyKey(child),
              value: formatMetricValue(child, childValue, percent),
              raw: typeof childValue === "number" ? childValue : Number(childValue),
              points: percent || /rate/i.test(child),
            });
          }
        }
      }
    }
  }
  return { columns: ["metric", "value"], rows: metrics };
}

function kpiEntries(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  return Object.entries(payload)
    .filter(([, value]) => ["number", "string"].includes(typeof value))
    .map(([key, value]) => ({
      label: prettyKey(key),
      value: typeof value === "number" && key.includes("rate") ? `${value}%` : value,
    }));
}

function formatVisit(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StarIcon({ filled }) {
  return (
    <svg
      className={`h-4 w-4 ${filled ? "text-accent" : "text-dim"}`}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path
        strokeLinejoin="round"
        d="m12 3.6 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16l-4.8 2.5.9-5.4L4.2 9.3l5.4-.8L12 3.6Z"
      />
    </svg>
  );
}

function BarList({ rows, empty }) {
  if (!rows.length) {
    return <p className="m-0 text-sm text-muted">{empty}</p>;
  }
  const max = Math.max(1, ...rows.map((row) => row.count));
  const ordered = [...rows].sort((a, b) => {
    const hourA = a.label.match(/^(\d{1,2})/);
    const hourB = b.label.match(/^(\d{1,2})/);
    if (hourA && hourB && a.label.includes(":") === false && b.label.length < 4) {
      return Number(hourA[1]) - Number(hourB[1]);
    }
    return 0;
  });
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {ordered.slice(0, 16).map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="truncate font-semibold text-ink">{row.label}</span>
            <span className="font-bold text-muted">{row.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.max(6, (row.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Reports() {
  const toast = useToast();
  const [view, setView] = useState("all");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [favorites, setFavorites] = useState(() => readJson(FAVORITES_KEY, []));
  const [visits, setVisits] = useState(() => readJson(VISITS_KEY, {}));
  const [openId, setOpenId] = useState(null);
  const [range, setRange] = useState("7d");
  const initialRange = rangeParams("7d");
  const [startDate, setStartDate] = useState(initialRange.start_date);
  const [endDate, setEndDate] = useState(initialRange.end_date);
  const [draftStart, setDraftStart] = useState(initialRange.start_date);
  const [draftEnd, setDraftEnd] = useState(initialRange.end_date);
  const [listQuery, setListQuery] = useState("");
  const [tableQuery, setTableQuery] = useState("");
  const [eventType, setEventType] = useState("");
  const [violation, setViolation] = useState("");
  const [draftEventType, setDraftEventType] = useState("");
  const [draftViolation, setDraftViolation] = useState("");
  const [cameraId, setCameraId] = useState("");
  const [draftCamera, setDraftCamera] = useState("");
  const [cameras, setCameras] = useState([]);
  const [payload, setPayload] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    getCameras()
      .then((list) => setCameras(Array.isArray(list) ? list : []))
      .catch(() => setCameras([]));
  }, []);

  const openReport = REPORTS.find((report) => report.id === openId) || null;
  const filters = { ...rangeParams(range), start_date: startDate, end_date: endDate };

  const loadReport = useCallback(async () => {
    if (!openReport?.path) {
      setPayload(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setPrevious(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    const body = buildReportBody(openReport, {
      start: filters.start_date,
      end: filters.end_date,
      camera: cameraId,
      rangeId: range,
    });
    const prevWindow = previousWindow(filters.start_date, filters.end_date);
    const prevBody = openReport.filters?.includes("start_date")
      ? { ...body, start_date: prevWindow.start_date, end_date: prevWindow.end_date }
      : null;
    try {
      const [data, prevData] = await Promise.all([
        getReportStats(openReport.path, body, { signal: controller.signal }),
        prevBody
          ? getReportStats(openReport.path, prevBody, { signal: controller.signal }).catch(
              () => null
            )
          : Promise.resolve(null),
      ]);
      setPayload(data);
      setPrevious(prevData);
    } catch (err) {
      setPayload(null);
      setPrevious(null);
      setError(
        err?.name === "AbortError"
          ? "Report request timed out"
          : err.message || "Could not load this report"
      );
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [openReport, filters.start_date, filters.end_date, cameraId, range]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(CATEGORIES.map((item) => [item.id, 0]));
    for (const report of REPORTS) counts[report.category] += 1;
    return counts;
  }, []);

  const visibleReports = useMemo(() => {
    return REPORTS.filter((report) => {
      if (view === "favorites" && !favorites.includes(report.id)) return false;
      if (
        selectedCategories.length &&
        !selectedCategories.includes(report.category)
      ) {
        return false;
      }
      if (listQuery.trim()) {
        const query = listQuery.trim().toLowerCase();
        const blob = `${report.name} ${categoryLabel(report.category)}`.toLowerCase();
        if (!blob.includes(query)) return false;
      }
      return true;
    });
  }, [view, favorites, selectedCategories, listQuery]);

  const heading =
    view === "favorites"
      ? "Favorites"
      : selectedCategories.length === 1
        ? categoryLabel(selectedCategories[0])
        : "All Reports";

  function toggleFavorite(id) {
    setFavorites((prev) => {
      const next = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  }

  function toggleCategory(id) {
    setView("all");
    setOpenId(null);
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function openReportView(report) {
    const stamp = new Date().toISOString();
    setVisits((prev) => {
      const next = { ...prev, [report.id]: stamp };
      localStorage.setItem(VISITS_KEY, JSON.stringify(next));
      return next;
    });
    setTableQuery("");
    setPage(1);
    if (report.filters?.includes("days") && !["7d", "30d", "90d"].includes(range)) {
      const next = rangeParams("7d");
      setRange("7d");
      setStartDate(next.start_date);
      setEndDate(next.end_date);
      setDraftStart(next.start_date);
      setDraftEnd(next.end_date);
    }
    setOpenId(report.id);
  }

  function selectRange(id) {
    if (id === "custom") {
      setRange("custom");
      return;
    }
    const next = rangeParams(id);
    setRange(id);
    setStartDate(next.start_date);
    setEndDate(next.end_date);
    setDraftStart(next.start_date);
    setDraftEnd(next.end_date);
    setPage(1);
  }

  function applyFilters() {
    setStartDate(draftStart);
    setEndDate(draftEnd);
    setCameraId(draftCamera);
    setEventType(draftEventType);
    setViolation(draftViolation);
    setRange(presetForDates(draftStart, draftEnd));
    setPage(1);
  }

  function resetFilters() {
    const next = rangeParams("7d");
    setRange("7d");
    setStartDate(next.start_date);
    setEndDate(next.end_date);
    setDraftStart(next.start_date);
    setDraftEnd(next.end_date);
    setCameraId("");
    setDraftCamera("");
    setEventType("");
    setViolation("");
    setDraftEventType("");
    setDraftViolation("");
    setTableQuery("");
    setPage(1);
  }

  function exportSubtitle() {
    if (!openReport) return heading;
    const parts = [];
    if (openReport.filters?.includes("days")) {
      parts.push(range === "90d" ? "Last 90 days" : range === "30d" ? "Last 30 days" : "Last 7 days");
    } else if (openReport.filters?.includes("start_date")) {
      parts.push(`${formatDay(startDate)} – ${formatDay(endDate)}`);
    }
    if (openReport.filters?.includes("camera_id")) {
      const camera = cameras.find((item) => item.id === cameraId);
      parts.push(cameraId ? camera?.name || `Camera ${cameraId}` : "All cameras");
    }
    if (eventType) parts.push(`Event type: ${eventType}`);
    if (violation) parts.push(`Violation: ${violation}`);
    if (tableQuery.trim()) parts.push(`Search: ${tableQuery.trim()}`);
    parts.push(`Generated ${new Date().toLocaleString()}`);
    return parts.join(" · ");
  }

  async function sheetForExport() {
    if (!openReport) {
      return {
        filename: fileSlug(heading),
        title: heading,
        subtitle: `Isarva Nethra · ${visibleReports.length} reports`,
        headers: ["Report name", "Report category", "Created by", "Last visited"],
        rows: visibleReports.map((item) => [
          item.name,
          categoryLabel(item.category),
          "System Generated",
          formatVisit(visits[item.id]),
        ]),
      };
    }
    if (openReport.kind === "export") {
      const csv = await fetchEventsCsv(
        buildReportBody(openReport, {
          start: startDate,
          end: endDate,
          camera: cameraId,
          eventType,
          violation,
          rangeId: range,
        })
      );
      return sheetFromCsv({
        filename: "incident_report",
        title: openReport.name,
        subtitle: `${categoryLabel(openReport.category)} · ${exportSubtitle()}`,
        csv,
      });
    }
    return buildReportSheet({
      report: openReport,
      category: categoryLabel(openReport.category),
      table,
      previousTable,
      tableQuery,
      subtitle: exportSubtitle(),
    });
  }

  async function exportAs(format) {
    setExporting(format);
    try {
      const sheet = await sheetForExport();
      if (format === "excel") await downloadExcelReport(sheet);
      else if (format === "pdf") await downloadPdfReport(sheet);
      else downloadCsv(`${sheet.filename}.csv`, sheet.headers, sheet.rows);
      toast.success(format === "excel" ? "Excel file downloaded" : format === "pdf" ? "PDF downloaded" : "CSV downloaded");
    } catch (err) {
      toast.error(err.message || "Could not export this report");
    } finally {
      setExporting(false);
    }
  }

  const table = useMemo(
    () => (openReport?.kind === "export" ? { columns: [], rows: [] } : toTable(payload)),
    [openReport, payload]
  );
  const previousTable = useMemo(() => toTable(previous), [previous]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ReportPageHeader
        report={openReport}
        favorited={Boolean(openReport && favorites.includes(openReport.id))}
        onFavorite={toggleFavorite}
        onExport={exportAs}
        exporting={exporting}
        exportDisabled={Boolean(openReport?.path && (loading || error))}
      />
      <section className="grid min-h-[32rem] flex-1 grid-cols-1 overflow-hidden rounded-[18px] border border-line bg-panel shadow-[0_8px_24px_rgba(15,42,74,0.06)] lg:grid-cols-[240px_minmax(0,1fr)]">
        <ReportSidebar
          view={view}
          openId={openId}
          selectedCategories={selectedCategories}
          reportCount={REPORTS.length}
          favoritesCount={favorites.length}
          categories={CATEGORIES}
          categoryCounts={categoryCounts}
          onAll={() => {
            setView("all");
            setSelectedCategories([]);
            setOpenId(null);
          }}
          onFavorites={() => {
            setView("favorites");
            setSelectedCategories([]);
            setOpenId(null);
          }}
          onToggleCategory={toggleCategory}
        />
        <div className="min-w-0 overflow-auto">
          {openReport ? (
            <ReportDetail
              report={openReport}
              category={categoryLabel(openReport.category)}
              range={range}
              onRange={selectRange}
              appliedStart={startDate}
              appliedEnd={endDate}
              draftStart={draftStart}
              draftEnd={draftEnd}
              onDraftStart={setDraftStart}
              onDraftEnd={setDraftEnd}
              onApply={applyFilters}
              onReset={resetFilters}
              cameras={cameras}
              draftCamera={draftCamera}
              onDraftCamera={setDraftCamera}
              tableQuery={tableQuery}
              onTableQuery={setTableQuery}
              draftEventType={draftEventType}
              draftViolation={draftViolation}
              onDraftEventType={setDraftEventType}
              onDraftViolation={setDraftViolation}
              table={table}
              previousTable={previousTable}
              loading={loading}
              error={error}
              onRetry={loadReport}
              onExport={exportAs}
              exporting={exporting}
              exportDisabled={Boolean(loading || error)}
              page={page}
              pageSize={pageSize}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          ) : (
            <ReportCatalog
              heading={heading}
              reports={visibleReports}
              query={listQuery}
              onQuery={setListQuery}
              favorites={favorites}
              visits={visits}
              categoryLabel={categoryLabel}
              formatVisit={formatVisit}
              onToggleFavorite={toggleFavorite}
              onOpen={openReportView}
            />
          )}
        </div>
      </section>
    </div>
  );
}

