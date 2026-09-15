import { Link, useNavigate } from "react-router-dom";
import { StatusBadge } from "../common/StatusBadge";

function formatTimestamp(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function EventTable({ events, emptyMessage = "No incidents found." }) {
  const navigate = useNavigate();

  if (!events?.length) {
    return (
      <p className="animate-fade-in px-2 py-8 text-center text-sm text-muted">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-elevated">
            {["ID", "Type", "Person", "Violation", "Time", "Action"].map(
              (heading) => (
                <th
                  key={heading}
                  className={`whitespace-nowrap border-b border-line px-3 py-3 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted ${
                    heading === "Action" ? "text-right" : "text-left"
                  }`}
                >
                  {heading}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const detailPath = `/incidents/${event.id}`;
            return (
              <tr
                key={event.id}
                role="link"
                tabIndex={0}
                aria-label={`View incident #${event.id}`}
                onClick={() => navigate(detailPath)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(detailPath);
                  }
                }}
                className="cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-accent-soft/60 focus-visible:bg-accent-soft/60 focus-visible:outline-none"
              >
                <td className="whitespace-nowrap px-3 py-3 font-mono font-semibold text-accent">
                  #{event.id}
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  <StatusBadge type={event.event_type} />
                </td>
                <td
                  className="whitespace-nowrap px-3 py-3 font-mono text-[0.9em]"
                  style={{ color: "var(--theme-ink)" }}
                >
                  {event.person_id ?? "—"}
                </td>
                <td
                  className="whitespace-nowrap px-3 py-3 font-medium"
                  style={{ color: "var(--theme-ink)" }}
                >
                  {event.violation || "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-muted">
                  {formatTimestamp(event.timestamp)}
                </td>
                <td
                  className="whitespace-nowrap px-3 py-3 text-right"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <Link
                    to={detailPath}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-semibold transition-colors hover:border-accent hover:bg-accent-soft"
                    style={{ color: "var(--theme-ink)" }}
                  >
                    <EyeIcon className="h-3.5 w-3.5 text-accent" />
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EyeIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
