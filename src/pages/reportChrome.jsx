import { useMemo, useState } from "react";

const RANGES = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom range" },
];

const METRIC_ORDER = [
  "total workers",
  "compliant workers",
  "total violations",
  "hardhat",
  "mask",
  "safety vest",
  "compliance rate",
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
  export: "Download filtered events as a CSV file.",
};

export function formatCell(value, column) {
  if ((value == null || value === "") && column === "camera_id") return "Unassigned";
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toLocaleString() : String(value);
  }
  if (Array.isArray(value)) return value.map((item) => formatCell(item)).join(", ");
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `${prettyKey(key)}: ${formatCell(item)}`)
      .join(", ");
  }
  return String(value);
}

export function downloadCsv(filename, headers, rows) {
  const lines = [headers, ...rows].map((cols) =>
    cols
      .map((value) => {
        const text = value == null ? "" : String(value);
        return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
      })
      .join(",")
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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

function metricTone(label) {
  const key = String(label || "").toLowerCase();
  if (key.includes("compliant")) return { bg: "#e8f1ff", fg: "#1677e8", icon: "check" };
  if (key.includes("violation")) return { bg: "#fdecec", fg: "#dc2626", icon: "alert" };
  if (key.includes("hardhat") || key.includes("hard hat")) {
    return { bg: "#f3e8ff", fg: "#7c3aed", icon: "hat" };
  }
  if (key.includes("mask")) return { bg: "#e8f1ff", fg: "#1677e8", icon: "mask" };
  if (key.includes("vest")) return { bg: "#fff4e5", fg: "#d97706", icon: "vest" };
  if (key.includes("compliance") || key.includes("rate")) {
    return { bg: "#e9f9ef", fg: "#16a34a", icon: "shield" };
  }
  if (key.includes("worker")) return { bg: "#e9f9ef", fg: "#16a34a", icon: "people" };
  return { bg: "#eaf4ff", fg: "#1677e8", icon: "dot" };
}

function isAdverse(label) {
  return /violation|hardhat|hard hat|mask|vest/i.test(String(label || ""));
}

function describeChange(row, previousMap) {
  if (!row?.key || !previousMap?.has(row.key)) return null;
  const previous = previousMap.get(row.key);
  const current = row.raw;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (row.points) {
    const diff = current - previous;
    const shown = Number.isInteger(diff) ? String(diff) : diff.toFixed(2);
    return {
      text: `${diff > 0 ? "+" : ""}${shown} pp`,
      direction: Math.sign(diff),
    };
  }
  if (previous === 0) {
    return { text: current === 0 ? "0.00%" : "—", direction: 0 };
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const direction = Math.abs(pct) < 0.005 ? 0 : Math.sign(pct);
  return { text: `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`, direction };
}

function changeClass(label, direction) {
  if (!direction) return "text-muted";
  const good = isAdverse(label) ? direction < 0 : direction > 0;
  return good ? "text-[#16a34a]" : "text-[#dc2626]";
}

export function ReportPageHeader({ report, favorited, onFavorite, onExport, exporting }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <ChartIcon />
        </span>
        <div className="min-w-0">
          <h1 className="m-0 text-xl font-bold text-ink">Reports</h1>
          <p className="m-0 mt-0.5 truncate text-sm text-muted">
            Overview
            <span className="px-1.5 text-dim">›</span>
            Reports
            {report ? (
              <>
                <span className="px-1.5 text-dim">›</span>
                <span className="text-ink">{report.name}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!report}
          onClick={() => report && onFavorite(report.id)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-accent bg-panel px-3 text-sm font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <StarIcon filled={favorited} className="text-accent" />
          Add to Favorites
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-panel px-3 text-sm font-semibold text-ink disabled:opacity-60"
        >
          <DownloadIcon />
          {exporting ? "Exporting…" : "Export"}
        </button>
      </div>
    </header>
  );
}

export function ReportSidebar({
  view,
  openId,
  selectedCategories,
  reportCount,
  favoritesCount,
  categories,
  categoryCounts,
  onAll,
  onFavorites,
  onToggleCategory,
}) {
  const allActive = view === "all" && !selectedCategories.length && !openId;
  const favoritesActive = view === "favorites" && !openId;
  return (
    <aside className="border-b border-line bg-panel lg:border-r lg:border-b-0">
      <p className="m-0 px-4 pt-4 pb-2 text-[0.65rem] font-bold tracking-[0.14em] text-dim uppercase">
        General
      </p>
      <button
        type="button"
        onClick={onAll}
        className={`mx-3 flex h-10 w-[calc(100%-1.5rem)] items-center justify-between rounded-lg px-3 text-left text-sm font-semibold ${
          allActive ? "bg-accent-soft text-accent" : "text-ink hover:bg-elevated"
        }`}
      >
        <span>All Reports</span>
        <CountBadge active={allActive}>{reportCount}</CountBadge>
      </button>
      <button
        type="button"
        onClick={onFavorites}
        className={`mx-3 mt-1 mb-3 flex h-10 w-[calc(100%-1.5rem)] items-center justify-between rounded-lg px-3 text-left text-sm font-semibold ${
          favoritesActive ? "bg-accent-soft text-accent" : "text-ink hover:bg-elevated"
        }`}
      >
        <span className="inline-flex items-center gap-2">
          <StarIcon filled={favoritesActive} />
          Favorites
        </span>
        <CountBadge active={favoritesActive}>{favoritesCount}</CountBadge>
      </button>
      <p className="m-0 px-4 pt-1 pb-2 text-[0.65rem] font-bold tracking-[0.14em] text-dim uppercase">
        Report category
      </p>
      <ul className="m-0 list-none px-3 pb-4">
        {categories.map((item) => {
          const checked = selectedCategories.includes(item.id);
          return (
            <li key={item.id}>
              <label
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm ${
                  checked ? "font-semibold text-accent" : "text-ink hover:bg-elevated"
                }`}
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleCategory(item.id)}
                    className="h-4 w-4 rounded accent-[var(--theme-accent)]"
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="text-xs font-semibold text-muted">{categoryCounts[item.id]}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export function ReportCatalog({
  heading,
  reports,
  query,
  onQuery,
  favorites,
  visits,
  categoryLabel,
  formatVisit,
  onToggleFavorite,
  onOpen,
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="m-0 text-lg font-bold text-ink">{heading}</h2>
          <p className="m-0 mt-1 text-sm text-muted">
            Choose a report. Star a row to keep it in Favorites.
          </p>
        </div>
        <label className="relative w-full sm:w-64">
          <SearchIcon />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search reports..."
            className="h-9 w-full rounded-lg border border-line bg-panel pr-3 pl-8 text-sm text-ink outline-none focus:border-accent"
          />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#0f2a4a] text-left text-[0.68rem] font-semibold tracking-wide text-white uppercase">
              <th className="px-5 py-3 font-semibold">Report name</th>
              <th className="px-3 py-3 font-semibold">Report category</th>
              <th className="px-3 py-3 font-semibold">Created by</th>
              <th className="px-5 py-3 font-semibold">Last visited</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => {
              const starred = favorites.includes(report.id);
              return (
                <tr key={report.id} className="hover:bg-elevated/70">
                  <td className="border-b border-line px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={
                          starred
                            ? `Remove ${report.name} from favorites`
                            : `Add ${report.name} to favorites`
                        }
                        onClick={() => onToggleFavorite(report.id)}
                        className="grid h-7 w-7 place-items-center rounded-md hover:bg-accent-soft"
                      >
                        <StarIcon filled={starred} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpen(report)}
                        className="text-left text-sm font-semibold text-accent hover:underline"
                      >
                        {report.name}
                      </button>
                    </div>
                  </td>
                  <td className="border-b border-line px-3 py-3 text-muted">
                    {categoryLabel(report.category)}
                  </td>
                  <td className="border-b border-line px-3 py-3 text-muted">System Generated</td>
                  <td className="border-b border-line px-5 py-3 text-muted">
                    {formatVisit(visits[report.id])}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!reports.length ? (
          <p className="m-0 px-6 py-12 text-center text-sm text-muted">No reports in this view.</p>
        ) : null}
      </div>
    </div>
  );
}

export function ReportDetail({
  report,
  category,
  range,
  onRange,
  appliedStart,
  appliedEnd,
  draftStart,
  draftEnd,
  onDraftStart,
  onDraftEnd,
  onApply,
  onReset,
  cameras,
  draftCamera,
  onDraftCamera,
  tableQuery,
  onTableQuery,
  draftEventType,
  draftViolation,
  onDraftEventType,
  onDraftViolation,
  table,
  previousTable,
  loading,
  error,
  onRetry,
  onExport,
  exporting,
  page,
  pageSize,
  onPage,
  onPageSize,
}) {
  const [sort, setSort] = useState({ key: "", dir: "asc" });
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [showChange, setShowChange] = useState(true);
  const [showTrend, setShowTrend] = useState(true);

  const summary = table.columns.includes("metric") && table.rows.some((row) => row.key);
  const previousMap = useMemo(() => {
    const map = new Map();
    for (const row of previousTable?.rows || []) {
      if (row.key) map.set(row.key, row.raw);
    }
    return map;
  }, [previousTable]);

  const filtered = useMemo(() => {
    const query = tableQuery.trim().toLowerCase();
    const rows = table.rows.filter((row) => {
      if (!query) return true;
      return table.columns.some((column) =>
        formatCell(row[column], column).toLowerCase().includes(query)
      );
    });
    const copy = [...rows];
    if (!sort.key && summary) {
      copy.sort((a, b) => rank(a.metric) - rank(b.metric));
      return copy;
    }
    if (!sort.key) return copy;
    copy.sort((a, b) => compareRows(a, b, sort, previousMap));
    return copy;
  }, [table, tableQuery, sort, summary, previousMap]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  const startIndex = (safePage - 1) * pageSize;
  const visible = filtered.slice(startIndex, startIndex + pageSize);
  const from = total ? startIndex + 1 : 0;
  const to = Math.min(total, startIndex + pageSize);
  const dataColumns = table.columns.filter((column) => !["key", "raw", "points"].includes(column));

  function toggleSort(key) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
    onPage(1);
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="m-0 text-xl font-bold text-ink">{report.name}</h2>
            <span className="inline-flex h-6 items-center rounded-md bg-accent-soft px-2 text-[0.65rem] font-bold tracking-wide text-accent uppercase">
              {category}
            </span>
          </div>
          <p className="m-0 mt-1 text-sm text-muted">
            {BLURBS[report.id] || "Report for the selected dates."}
          </p>
        </div>
        <p className="m-0 text-sm font-medium text-ink">
          {report.filters?.includes("days")
            ? range === "90d"
              ? "Last 90 days"
              : range === "30d"
                ? "Last 30 days"
                : "Last 7 days"
            : `${formatDay(appliedStart)} – ${formatDay(appliedEnd)}`}
        </p>
      </div>

      {summary && !loading && !error ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
          {[...table.rows]
            .sort((a, b) => rank(a.metric) - rank(b.metric))
            .slice(0, 7)
            .map((row) => (
              <MetricCard key={row.key || row.metric} label={row.metric} value={row.value} />
            ))}
        </div>
      ) : null}

      <section className="rounded-xl border border-line bg-panel">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <FilterIcon />
          <h3 className="m-0 text-sm font-bold text-ink">Filters</h3>
        </div>
        <div className="flex flex-wrap items-end gap-3 px-4 py-3">
          {report.filters?.includes("start_date") ? (
            <label className="w-full max-w-[22rem] text-xs font-semibold text-muted">
              Date range
              <span className="mt-1 flex h-10 items-center gap-2 rounded-lg border border-line bg-panel px-2.5">
                <CalendarIcon />
                <input
                  type="date"
                  aria-label="From"
                  value={draftStart}
                  onChange={(event) => onDraftStart(event.target.value)}
                  className="h-full w-[9.2rem] border-0 bg-transparent text-sm font-medium text-ink outline-none"
                />
                <span className="text-dim">–</span>
                <input
                  type="date"
                  aria-label="To"
                  value={draftEnd}
                  onChange={(event) => onDraftEnd(event.target.value)}
                  className="h-full w-[9.2rem] border-0 bg-transparent text-sm font-medium text-ink outline-none"
                />
              </span>
            </label>
          ) : null}
          {report.filters?.includes("camera_id") ? (
            <label className="min-w-[12rem] text-xs font-semibold text-muted">
              Camera
              <span className="mt-1 flex h-10 items-center gap-2 rounded-lg border border-line px-2">
                <CameraIcon />
                <select
                  aria-label="Camera"
                  value={draftCamera}
                  onChange={(event) => onDraftCamera(event.target.value)}
                  className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-ink outline-none"
                >
                  <option value="">All cameras</option>
                  {cameras.map((camera) => (
                    <option key={camera.id} value={camera.id}>
                      {camera.name}
                    </option>
                  ))}
                </select>
              </span>
            </label>
          ) : null}
          {report.filters?.includes("event_type") ? (
            <>
              <label className="text-xs font-semibold text-muted">
                Event type
                <input
                  value={draftEventType}
                  onChange={(event) => onDraftEventType(event.target.value)}
                  placeholder="PPE_VIOLATION"
                  className="mt-1 h-10 w-40 rounded-lg border border-line px-2 text-sm font-medium text-ink outline-none"
                />
              </label>
              <label className="text-xs font-semibold text-muted">
                Violation type
                <input
                  value={draftViolation}
                  onChange={(event) => onDraftViolation(event.target.value)}
                  placeholder="NO-Hardhat"
                  className="mt-1 h-10 w-40 rounded-lg border border-line px-2 text-sm font-medium text-ink outline-none"
                />
              </label>
            </>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onApply}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-3 text-sm font-semibold text-white"
            >
              <SearchGlyph />
              Apply filters
            </button>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-10 items-center gap-1.5 px-2 text-sm font-semibold text-muted hover:text-ink"
            >
              <ResetIcon />
              Reset
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 px-4 pb-4">
          {(report.filters?.includes("days")
            ? RANGES.filter((item) => ["7d", "30d", "90d"].includes(item.id))
            : RANGES
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onRange(item.id)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${
                range === item.id
                  ? "bg-accent text-white"
                  : "text-muted hover:bg-elevated hover:text-ink"
              }`}
            >
              {item.id === "custom" ? <CalendarIcon /> : null}
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <ChartIcon className="h-4 w-4 text-accent" />
            <h3 className="m-0 text-sm font-bold text-ink">
              {summary || report.kind === "dashboard" ? "Metrics summary" : "Report data"}
            </h3>
          </div>
          {report.kind === "export" ? null : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onExport}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-semibold text-ink"
              >
                <DownloadIcon />
                Export
              </button>
              {summary ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setColumnsOpen((open) => !open)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-semibold text-ink"
                  >
                    <ColumnsIcon />
                    Columns
                  </button>
                  {columnsOpen ? (
                    <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-line bg-panel p-2 shadow-lg">
                      <label className="flex items-center gap-2 px-2 py-1.5 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={showChange}
                          onChange={() => setShowChange((value) => !value)}
                        />
                        Change
                      </label>
                      <label className="flex items-center gap-2 px-2 py-1.5 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={showTrend}
                          onChange={() => setShowTrend((value) => !value)}
                        />
                        Trend
                      </label>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {report.kind === "export" ? (
          <p className="m-0 px-4 py-6 text-sm text-muted">
            Set this report’s filters, then use Export. The file uses this report’s
            date range, camera, event type, and violation.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <label className="flex items-center gap-2 text-sm text-muted">
                Show
                <select
                  value={pageSize}
                  onChange={(event) => {
                    onPageSize(Number(event.target.value));
                    onPage(1);
                  }}
                  className="h-8 rounded-lg border border-line bg-panel px-2 text-sm text-ink"
                >
                  {[10, 25, 50].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                entries
              </label>
              <label className="flex items-center gap-2 text-sm text-muted">
                Search:
                <span className="relative inline-flex w-44">
                  <input
                    value={tableQuery}
                    onChange={(event) => {
                      onTableQuery(event.target.value);
                      onPage(1);
                    }}
                    placeholder={summary ? "Search metrics..." : "Search rows..."}
                    className="h-8 w-full rounded-lg border border-line bg-panel px-2 text-sm text-ink outline-none focus:border-accent"
                  />
                </span>
              </label>
            </div>

            {loading ? (
              <p className="m-0 px-4 py-10 text-center text-sm text-muted">Loading report…</p>
            ) : error ? (
              <p className="m-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}{" "}
                <button type="button" onClick={onRetry} className="font-semibold underline">
                  Retry
                </button>
              </p>
            ) : (
              <ReportTable
                summary={summary}
                columns={dataColumns}
                rows={visible}
                startIndex={startIndex}
                sort={sort}
                onSort={toggleSort}
                showChange={showChange}
                showTrend={showTrend}
                previousMap={previousMap}
              />
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted">
              <span>
                Showing {from} to {to} of {total} entries
              </span>
              <Pager page={safePage} pages={pages} onPage={onPage} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function rank(metric) {
  const index = METRIC_ORDER.indexOf(String(metric || "").toLowerCase());
  return index === -1 ? 99 : index;
}

function compareRows(a, b, sort, previousMap) {
  const dir = sort.dir === "asc" ? 1 : -1;
  if (sort.key === "change") {
    const left = describeChange(a, previousMap)?.direction || 0;
    const right = describeChange(b, previousMap)?.direction || 0;
    return (left - right) * dir;
  }
  if (sort.key === "value" && Number.isFinite(a.raw) && Number.isFinite(b.raw)) {
    return (a.raw - b.raw) * dir;
  }
  const left = a[sort.key];
  const right = b[sort.key];
  if (typeof left === "number" && typeof right === "number") return (left - right) * dir;
  return formatCell(left).localeCompare(formatCell(right)) * dir;
}

function ReportTable({
  summary,
  columns,
  rows,
  startIndex,
  sort,
  onSort,
  showChange,
  showTrend,
  previousMap,
}) {
  if (!rows.length) {
    return <p className="m-0 px-4 py-10 text-center text-sm text-muted">No rows for these filters.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="bg-[#0f2a4a] text-left text-[0.68rem] font-semibold tracking-wide text-white uppercase">
            <th className="w-14 px-4 py-3 font-semibold">#</th>
            {columns.map((column) => (
              <SortHeader
                key={column}
                label={prettyKey(column)}
                active={sort.key === column}
                dir={sort.dir}
                onClick={() => onSort(column)}
              />
            ))}
            {summary && showChange ? (
              <SortHeader
                label="Change (vs. previous period)"
                active={sort.key === "change"}
                dir={sort.dir}
                onClick={() => onSort("change")}
              />
            ) : null}
            {summary && showTrend ? <th className="px-4 py-3 font-semibold">Trend</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const change = summary ? describeChange(row, previousMap) : null;
            const tone = metricTone(row.metric);
            return (
              <tr key={row.key || row.id || row.person_id || index} className="hover:bg-elevated/60">
                <td className="border-b border-line px-4 py-3 text-muted">{startIndex + index + 1}</td>
                {columns.map((column) => (
                  <td key={column} className="border-b border-line px-4 py-3 text-ink">
                    {column === "metric" ? (
                      <span className="inline-flex items-center gap-2 font-medium">
                        <MetricIcon name={tone.icon} color={tone.fg} />
                        {formatCell(row[column], column)}
                      </span>
                    ) : (
                      <span className={column === "value" || typeof row[column] === "number" ? "font-semibold tabular-nums" : ""}>
                        {formatCell(row[column], column)}
                      </span>
                    )}
                  </td>
                ))}
                {summary && showChange ? (
                  <td className={`border-b border-line px-4 py-3 text-sm font-semibold ${changeClass(row.metric, change?.direction || 0)}`}>
                    {change ? (
                      <span className="inline-flex items-center gap-1">
                        <ChangeArrow direction={change.direction} />
                        {change.text}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                ) : null}
                {summary && showTrend ? (
                  <td className="border-b border-line px-4 py-3">
                    <Sparkline
                      previous={previousMap.get(row.key)}
                      current={row.raw}
                      color={sparkColor(row.metric, change?.direction || 0)}
                    />
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader({ label, active, dir, onClick }) {
  return (
    <th className="px-4 py-3 font-semibold">
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-white">
        {label}
        <span className="text-[0.55rem] leading-none opacity-80" aria-hidden="true">
          <span className={active && dir === "asc" ? "text-white" : "text-white/50"}>▲</span>
          <span className={active && dir === "desc" ? "text-white" : "text-white/50"}>▼</span>
        </span>
      </button>
    </th>
  );
}

function Pager({ page, pages, onPage }) {
  return (
    <div className="flex items-center gap-1">
      <PagerButton label="«" disabled={page <= 1} onClick={() => onPage(1)} />
      <PagerButton label="‹" disabled={page <= 1} onClick={() => onPage(page - 1)} />
      <button
        type="button"
        className="grid h-8 min-w-8 place-items-center rounded-lg bg-accent px-2 text-sm font-semibold text-white"
      >
        {page}
      </button>
      <PagerButton label="›" disabled={page >= pages} onClick={() => onPage(page + 1)} />
    </div>
  );
}

function PagerButton({ label, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg border border-line text-sm text-muted disabled:opacity-40"
    >
      {label}
    </button>
  );
}

function MetricCard({ label, value }) {
  const tone = metricTone(label);
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-panel px-3 py-3">
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
        style={{ background: tone.bg, color: tone.fg }}
      >
        <MetricIcon name={tone.icon} />
      </span>
      <div className="min-w-0">
        <p className="m-0 text-lg leading-none font-bold text-ink">{value}</p>
        <p className="m-0 mt-1 truncate text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

function Sparkline({ previous, current, color }) {
  const start = Number.isFinite(previous) ? previous : Number(current) || 0;
  const end = Number(current) || 0;
  const min = Math.min(start, end);
  const max = Math.max(start, end);
  const y = (value) => (max === min ? 10 : 16 - ((value - min) / (max - min)) * 12);
  return (
    <svg width="88" height="20" viewBox="0 0 88 20" aria-hidden="true">
      <polyline
        points={`4,${y(start)} 84,${y(end)}`}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function sparkColor(label, direction) {
  if (!direction) return "#94a3b8";
  const good = isAdverse(label) ? direction < 0 : direction > 0;
  return good ? "#16a34a" : "#dc2626";
}

function ChangeArrow({ direction }) {
  if (!direction) return <span aria-hidden="true">–</span>;
  return <span aria-hidden="true">{direction > 0 ? "▲" : "▼"}</span>;
}

function CountBadge({ children, active }) {
  return (
    <span
      className={`grid h-6 min-w-6 place-items-center rounded-md border px-1.5 text-xs font-bold ${
        active ? "border-accent/30 bg-panel text-accent" : "border-line bg-panel text-muted"
      }`}
    >
      {children}
    </span>
  );
}

function StarIcon({ filled, className = "" }) {
  return (
    <svg
      className={`h-4 w-4 ${className} ${filled ? "text-accent" : "text-dim"}`}
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

function MetricIcon({ name, color = "currentColor" }) {
  const common = {
    className: "h-5 w-5",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 1.7,
    "aria-hidden": true,
  };
  if (name === "people") {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="2.2" />
        <path d="M4.8 17.5c.6-2.2 2.2-3.3 4.2-3.3s3.6 1.1 4.2 3.3" strokeLinecap="round" />
        <circle cx="16" cy="9" r="1.7" />
        <path d="M15 14.2c1.6.2 2.8 1.1 3.4 2.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "check") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="7" />
        <path d="m8.8 12.2 2.2 2.2 4.2-4.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "alert") {
    return (
      <svg {...common}>
        <path d="M12 4.5 20 18.5H4L12 4.5Z" strokeLinejoin="round" />
        <path d="M12 10v3.2" strokeLinecap="round" />
        <circle cx="12" cy="15.6" r="0.6" fill={color} stroke="none" />
      </svg>
    );
  }
  if (name === "hat") {
    return (
      <svg {...common}>
        <path d="M4 14.5h16" strokeLinecap="round" />
        <path d="M7 14.5v-1.2c0-2.6 2.2-4.3 5-4.3s5 1.7 5 4.3v1.2" />
        <path d="M9.2 9.2 8 5.8h8l-1.2 3.4" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "mask") {
    return (
      <svg {...common}>
        <path d="M5 10.5c2.2-1.6 4.4-2.2 7-2.2s4.8.6 7 2.2v2.2c0 2.8-3 5-7 5s-7-2.2-7-5v-2.2Z" />
        <path d="M9 12.2h.1M15 12.2h.1" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "vest") {
    return (
      <svg {...common}>
        <path d="M9 4.5 12 7l3-2.5 3 2v11.2a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 17.7V6.5l3-2Z" strokeLinejoin="round" />
        <path d="M12 7v12" />
      </svg>
    );
  }
  if (name === "shield") {
    return (
      <svg {...common}>
        <path d="M12 3.8 18.5 6.2v5.2c0 3.6-2.6 6.4-6.5 7.8-3.9-1.4-6.5-4.2-6.5-7.8V6.2L12 3.8Z" strokeLinejoin="round" />
        <path d="m9.2 11.6 1.8 1.8 3.8-3.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ChartIcon({ className = "h-5 w-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M4 19h16" strokeLinecap="round" />
      <path d="M7 16v-4M12 16V8M17 16v-6" strokeLinecap="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg className="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M4 6h16l-6 7v5l-4 2v-7L4 6Z" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M12 4v10" strokeLinecap="round" />
      <path d="m8 11 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19h14" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" strokeLinecap="round" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M4 8.5h3l1.5-2h7L17 8.5h3v9H4v-9Z" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="2.4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-dim" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" strokeLinecap="round" />
    </svg>
  );
}

function SearchGlyph() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" strokeLinecap="round" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M19 12a7 7 0 1 1-2-4.9" strokeLinecap="round" />
      <path d="M19 5v4h-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ColumnsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M10 5v14M4 10h16" />
    </svg>
  );
}
