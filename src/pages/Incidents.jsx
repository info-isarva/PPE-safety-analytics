import { useCallback, useEffect, useMemo, useState } from "react";
import { getEvents } from "../api/endpoints";
import { EventFilters } from "../components/events/EventFilters";
import { EventTable } from "../components/events/EventTable";
import { Pagination } from "../components/common/Pagination";
import { LoadingState } from "../components/common/LoadingState";
import { ErrorState } from "../components/common/ErrorState";
import { EmptyState } from "../components/common/EmptyState";

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeek(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday start
  d.setDate(d.getDate() - diff);
  return d;
}

function parseDateInput(value, end = false) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return end ? endOfDay(d) : startOfDay(d);
}

function matchesDateFilter(timestamp, dateFilter, customFrom, customTo) {
  if (dateFilter === "all") return true;
  if (!timestamp) return false;

  const eventDate = new Date(timestamp);
  if (Number.isNaN(eventDate.getTime())) return false;

  const now = new Date();
  const todayStart = startOfDay(now);

  if (dateFilter === "custom") {
    const from = parseDateInput(customFrom, false);
    const to = parseDateInput(customTo, true);
    if (from && eventDate < from) return false;
    if (to && eventDate > to) return false;
    return true;
  }

  if (dateFilter === "today") {
    return eventDate >= todayStart && eventDate <= endOfDay(now);
  }

  if (dateFilter === "yesterday") {
    const yStart = new Date(todayStart);
    yStart.setDate(yStart.getDate() - 1);
    return eventDate >= yStart && eventDate < todayStart;
  }

  if (dateFilter === "this_week") {
    return eventDate >= startOfWeek(now);
  }

  if (dateFilter === "last_week") {
    const thisWeekStart = startOfWeek(now);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    return eventDate >= lastWeekStart && eventDate < thisWeekStart;
  }

  if (dateFilter === "this_month") {
    return eventDate >= new Date(now.getFullYear(), now.getMonth(), 1);
  }

  if (dateFilter === "last_month") {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return eventDate >= lastMonthStart && eventDate < monthStart;
  }

  const dayMap = { "7d": 7, "14d": 14, "30d": 30, "90d": 90 };
  const days = dayMap[dateFilter];
  if (!days) return true;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  return eventDate >= cutoff;
}

export default function Incidents() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [violationFilter, setViolationFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [search, setSearch] = useState("");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await getEvents();
      const list = Array.isArray(data) ? data : [];
      setEvents(list);
    } catch (err) {
      setError(err.message || "Failed to load incidents");
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [
    typeFilter,
    dateFilter,
    customFrom,
    customTo,
    violationFilter,
    sortBy,
    search,
    pageSize,
  ]);

  const violationOptions = useMemo(() => {
    const set = new Set();
    for (const event of events) {
      if (!event?.violation) continue;
      // Support comma-separated multi-violations
      String(event.violation)
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => set.add(part));
    }
    return [...set]
      .sort((a, b) => a.localeCompare(b))
      .map((id) => ({ id, label: id }));
  }, [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = events.filter((event) => {
      if (typeFilter !== "all" && event.event_type !== typeFilter) return false;
      if (
        !matchesDateFilter(
          event.timestamp,
          dateFilter,
          customFrom,
          customTo
        )
      ) {
        return false;
      }
      if (
        violationFilter !== "all" &&
        !String(event.violation || "")
          .toLowerCase()
          .includes(violationFilter.toLowerCase())
      ) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        String(event.id ?? ""),
        String(event.person_id ?? ""),
        event.violation ?? "",
        event.event_type ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    list = [...list];
    list.sort((a, b) => {
      if (sortBy === "oldest") {
        return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
      }
      if (sortBy === "person") {
        return Number(a.person_id || 0) - Number(b.person_id || 0);
      }
      if (sortBy === "violation") {
        return String(a.violation || "").localeCompare(String(b.violation || ""));
      }
      // newest
      return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
    });

    return list;
  }, [
    events,
    typeFilter,
    dateFilter,
    customFrom,
    customTo,
    violationFilter,
    sortBy,
    search,
  ]);

  const hasActiveFilters =
    typeFilter !== "all" ||
    dateFilter !== "all" ||
    customFrom !== "" ||
    customTo !== "" ||
    violationFilter !== "all" ||
    sortBy !== "newest" ||
    search.trim() !== "";

  function clearFilters() {
    setTypeFilter("all");
    setDateFilter("all");
    setCustomFrom("");
    setCustomTo("");
    setViolationFilter("all");
    setSortBy("newest");
    setSearch("");
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  return (
    <div className="flex w-full flex-col gap-3">
      <EventFilters
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        dateFilter={dateFilter}
        onDateChange={setDateFilter}
        customFrom={customFrom}
        customTo={customTo}
        onCustomFromChange={setCustomFrom}
        onCustomToChange={setCustomTo}
        violationFilter={violationFilter}
        onViolationChange={setViolationFilter}
        violationOptions={violationOptions}
        sortBy={sortBy}
        onSortChange={setSortBy}
        search={search}
        onSearchChange={setSearch}
        onClear={clearFilters}
        hasActiveFilters={hasActiveFilters}
        action={
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-elevated px-3 py-2.5 text-sm font-semibold transition-colors hover:border-accent/40 hover:bg-panel-hover disabled:cursor-wait disabled:opacity-70 sm:w-auto sm:shrink-0"
            style={{ color: "var(--theme-ink)" }}
          >
            <svg
              className={`h-4 w-4 ${refreshing ? "animate-spin text-accent" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-2.6-6.3" strokeLinecap="round" />
              <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Refresh
          </button>
        }
      />

      <section className="rounded-xl border border-line bg-panel shadow-sm">
        <div className="relative z-10 border-b border-line px-3 py-3 sm:px-4">
          {!loading && !error && filtered.length > 0 ? (
            <Pagination
              page={safePage}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              menuPlacement="bottom"
            />
          ) : (
            <p className="m-0 text-xs font-medium text-muted">
              {loading
                ? "Loading…"
                : `${filtered.length} event${filtered.length === 1 ? "" : "s"}`}
            </p>
          )}
        </div>

        {loading ? <LoadingState label="Loading incidents…" /> : null}
        {!loading && error ? (
          <ErrorState
            title="Could not load incidents"
            message={error}
            onRetry={() => load(false)}
          />
        ) : null}
        {!loading && !error && filtered.length === 0 ? (
          <EmptyState
            title="No matching incidents"
            message="Try clearing filters or adjusting your search."
          />
        ) : null}
        {!loading && !error && filtered.length > 0 ? (
          <div className="animate-fade-in overflow-x-auto">
            <EventTable events={pageItems} />
          </div>
        ) : null}

        {!loading && !error && filtered.length > 0 ? (
          <div className="relative z-10 border-t border-line px-3 py-3 sm:px-4">
            <Pagination
              page={safePage}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              menuPlacement="top"
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
