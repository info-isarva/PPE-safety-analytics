import { Link } from "react-router-dom";

function formatTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function titleFor(event) {
  if (!event?.violation) {
    return event?.event_type === "ZONE_VIOLATION" ||
      event?.event_type === "RESTRICTED_ZONE"
      ? "Restricted Zone Entry"
      : "Safety violation";
  }
  return String(event.violation)
    .replace(/^NO-/i, "Missing ")
    .replace(/-/g, " ");
}

export function RecentIncidentsList({ events }) {
  const list = (events || []).slice(0, 5);

  return (
    <section className="flex h-full flex-col rounded-2xl border border-line bg-panel p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="m-0 text-sm font-semibold text-ink">Recent Incidents</h3>
        <Link
          to="/incidents"
          className="text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400"
        >
          View all
        </Link>
      </div>

      {list.length === 0 ? (
        <p className="m-0 text-sm text-muted">No incidents recorded yet.</p>
      ) : (
        <ul className="m-0 flex flex-1 list-none flex-col gap-3 p-0">
          {list.map((event, index) => (
            <li key={event.id}>
              <Link
                to={`/incidents/${event.id}`}
                className="flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-elevated"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger">
                  <AlertIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {titleFor(event)}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Person {event.person_id ?? "—"} · {formatTime(event.timestamp)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AlertIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3 2 20h20L12 3Z" strokeLinejoin="round" />
      <path d="M12 9v5" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}
