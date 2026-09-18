import { Link } from "react-router-dom";

function isToday(timestamp) {
  if (!timestamp) return false;
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isPpe(type) {
  return type === "PPE_VIOLATION";
}

function isZone(type) {
  return type === "RESTRICTED_ZONE" || type === "ZONE_VIOLATION";
}

function isActiveJob(status) {
  return status === "processing" || status === "queued";
}

/** Today’s violations · PPE vs Zone · Active video jobs */
export function TodayOpsCards({ events = [], jobs = [], jobsLoading = false }) {
  const todayEvents = events.filter((e) => isToday(e.timestamp));
  const todayCount = todayEvents.length;
  const ppeToday = todayEvents.filter((e) => isPpe(e.event_type)).length;
  const zoneToday = todayEvents.filter((e) => isZone(e.event_type)).length;
  const splitTotal = ppeToday + zoneToday;
  const ppePct = splitTotal ? Math.round((ppeToday / splitTotal) * 100) : 0;
  const zonePct = splitTotal ? 100 - ppePct : 0;

  const activeJobs = jobs.filter((j) => isActiveJob(j.status));
  const activeCount = activeJobs.length;
  const topJob = activeJobs[0];

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <article className="rounded-2xl border border-line bg-panel p-4 shadow-sm sm:p-5">
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted">
          Today’s violations
        </p>
        <p className="mt-2 m-0 text-3xl font-bold tabular-nums text-danger">
          {todayCount}
        </p>
        <p className="mt-1 m-0 text-xs text-muted">
          Since midnight · all-time list still on KPIs above
        </p>
      </article>

      <article className="rounded-2xl border border-line bg-panel p-4 shadow-sm sm:p-5">
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted">
          PPE vs Zone today
        </p>
        <div className="mt-3 flex items-end gap-4">
          <div>
            <p className="m-0 text-2xl font-bold tabular-nums text-danger">{ppeToday}</p>
            <p className="m-0 text-xs font-medium text-muted">PPE</p>
          </div>
          <div>
            <p className="m-0 text-2xl font-bold tabular-nums text-warn">{zoneToday}</p>
            <p className="m-0 text-xs font-medium text-muted">Zone</p>
          </div>
        </div>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-line">
          {splitTotal === 0 ? (
            <div className="h-full w-full bg-line" />
          ) : (
            <>
              <div
                className="h-full bg-danger transition-all duration-500"
                style={{ width: `${ppePct}%` }}
                title={`PPE ${ppePct}%`}
              />
              <div
                className="h-full bg-warn transition-all duration-500"
                style={{ width: `${zonePct}%` }}
                title={`Zone ${zonePct}%`}
              />
            </>
          )}
        </div>
      </article>

      <article className="rounded-2xl border border-line bg-panel p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted">
            Active video jobs
          </p>
          <Link
            to="/live"
            className="shrink-0 text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400"
          >
            Open Live
          </Link>
        </div>
        <p
          className={`mt-2 m-0 text-3xl font-bold tabular-nums ${
            activeCount > 0 ? "text-accent" : "text-ink"
          }`}
        >
          {jobsLoading && jobs.length === 0 ? "…" : activeCount}
        </p>
        {topJob ? (
          <p className="mt-1 m-0 truncate text-xs text-muted">
            {topJob.filename} · {topJob.status}
            {topJob.status === "processing"
              ? ` · ${Math.round(Number(topJob.progress) || 0)}%`
              : ""}
          </p>
        ) : (
          <p className="mt-1 m-0 text-xs text-muted">
            {jobsLoading ? "Checking jobs…" : "No queued or processing uploads"}
          </p>
        )}
      </article>
    </section>
  );
}
