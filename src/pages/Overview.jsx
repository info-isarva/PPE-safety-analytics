import { useCallback, useEffect, useState } from "react";
import { getDashboardStats, getEvents } from "../api/endpoints";
import { SummaryMetricCard } from "../components/kpi/SummaryMetricCard";
import { LiveFeedCard } from "../components/dashboard/LiveFeedCard";
import { RecentIncidentsList } from "../components/dashboard/RecentIncidentsList";
import { EventsTrendChart } from "../components/dashboard/EventsTrendChart";
import { PpeDonutChart } from "../components/dashboard/PpeDonutChart";
import { EventTypeBreakdown } from "../components/dashboard/EventTypeBreakdown";
import { LoadingState } from "../components/common/LoadingState";
import { ErrorState } from "../components/common/ErrorState";

const REFRESH_MS = 30000;

function AlertIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3 2 20h20L12 3Z" strokeLinejoin="round" />
      <path d="M12 9v5" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WorkersIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M2 19c0-3 3-5 7-5s7 2 7 5" strokeLinecap="round" />
      <path d="M14.5 19c.4-1.8 1.8-3 4-3 2 0 3.5 1 4 3" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Overview() {
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const [dashboard, allEvents] = await Promise.all([
        getDashboardStats(),
        getEvents(),
      ]);
      setStats(dashboard);
      const list = Array.isArray(allEvents) ? allEvents : [];
      const sorted = [...list].sort(
        (a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
      );
      setEvents(sorted);
    } catch (err) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    const id = setInterval(() => load(false), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  if (loading && !stats) {
    return <LoadingState label="Loading dashboard…" />;
  }

  if (error && !stats) {
    return (
      <ErrorState
        title="Could not load dashboard"
        message={error}
        onRetry={() => {
          setLoading(true);
          load(false);
        }}
      />
    );
  }

  const compliance = Number(stats?.compliance_rate ?? 0);
  const latestEvent = events[0] || null;
  const distribution = stats?.ppe_distribution || {};

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm text-muted">
          Live workplace safety overview
        </p>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-panel-hover disabled:cursor-wait disabled:opacity-70"
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
      </div>

      {error ? (
        <p className="m-0 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          Last refresh failed: {error}
        </p>
      ) : null}

      {/* All fields from GET /stats/dashboard */}
      <section className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetricCard
          label="Compliance Rate"
          value={`${compliance.toFixed(2)}%`}
          tone="ok"
          progress={compliance}
        />
        <SummaryMetricCard
          label="Compliant Workers"
          value={stats?.compliant_workers ?? "—"}
          tone="ok"
          icon={<CheckIcon className="h-7 w-7" />}
        />
        <SummaryMetricCard
          label="Total Workers"
          value={stats?.total_workers ?? "—"}
          tone="info"
          icon={<WorkersIcon className="h-7 w-7" />}
        />
        <SummaryMetricCard
          label="Total Violations"
          value={stats?.total_violations ?? "—"}
          tone="danger"
          icon={<AlertIcon className="h-7 w-7" />}
        />
      </section>

      {/* PPE class cards from ppe_distribution */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Object.entries(distribution).map(([name, value]) => (
          <article
            key={name}
            className="rounded-2xl border border-line bg-panel px-4 py-3 shadow-sm"
          >
            <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted">
              {name}
            </p>
            <p className="mt-1 m-0 text-2xl font-bold tabular-nums text-ink">
              {Number(value).toFixed(2)}%
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{ width: `${Math.min(100, Number(value) || 0)}%` }}
              />
            </div>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
        <LiveFeedCard latestEvent={latestEvent} />
        <RecentIncidentsList events={events} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <EventsTrendChart events={events} />
        <PpeDonutChart distribution={distribution} />
        <EventTypeBreakdown events={events} />
      </section>
    </div>
  );
}
