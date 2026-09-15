import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getEvent, getScreenshotUrl } from "../api/endpoints";
import { StatusBadge } from "../components/common/StatusBadge";
import { ScreenshotViewer } from "../components/events/ScreenshotViewer";
import { LoadingState } from "../components/common/LoadingState";
import { ErrorState } from "../components/common/ErrorState";

function formatTimestamp(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
    });
  } catch {
    return value;
  }
}

function isZoneType(type) {
  return type === "ZONE_VIOLATION" || type === "RESTRICTED_ZONE";
}

function isPpeType(type) {
  return type === "PPE_VIOLATION";
}

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getEvent(id);
        if (!cancelled) setEvent(data);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Event not found");
          setEvent(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return <LoadingState label="Loading event…" />;
  }

  if (error || !event) {
    return (
      <div className="flex w-full flex-col gap-3">
        <BackLink />
        <ErrorState
          title="Event not found"
          message={error || `No event with ID ${id}`}
        />
      </div>
    );
  }

  const screenshotSrc = getScreenshotUrl(event.screenshot_url);
  const zone = isZoneType(event.event_type);
  const ppe = isPpeType(event.event_type);
  const tone = ppe ? "danger" : zone ? "warn" : "accent";

  const details = [
    {
      label: "Event type",
      value: event.event_type || "—",
      mono: true,
      icon: <TypeIcon />,
      tone: ppe ? "danger" : zone ? "warn" : "muted",
    },
    {
      label: "Person ID",
      value: event.person_id ?? "—",
      mono: true,
      icon: <PersonIcon />,
      tone: "accent",
    },
    {
      label: "Violation",
      value: event.violation || "—",
      icon: <AlertIcon />,
      tone: "danger",
      emphasize: true,
    },
    {
      label: "Timestamp",
      value: formatTimestamp(event.timestamp),
      icon: <ClockIcon />,
      tone: "muted",
    },
    {
      label: "Screenshot path",
      value: event.screenshot_url || "—",
      mono: true,
      muted: true,
      icon: <ImageIcon />,
      tone: "muted",
    },
  ];

  return (
    <div className="flex w-full flex-col gap-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink />
        <div className="flex items-center gap-2">
          <span
            className="rounded-lg border border-line bg-panel px-2.5 py-1 font-mono text-xs font-semibold"
            style={{ color: "var(--theme-muted)" }}
          >
            #{event.id}
          </span>
          <StatusBadge type={event.event_type} />
        </div>
      </div>

      <section
        className={`relative overflow-hidden rounded-2xl border bg-panel p-4 shadow-sm sm:p-5 ${
          tone === "danger"
            ? "border-danger/25"
            : tone === "warn"
              ? "border-warn/25"
              : "border-line"
        }`}
      >
        <div
          className={`pointer-events-none absolute inset-y-0 left-0 w-1.5 ${
            tone === "danger"
              ? "bg-danger"
              : tone === "warn"
                ? "bg-warn"
                : "bg-accent"
          }`}
          aria-hidden="true"
        />
        <div className="flex flex-col gap-3 pl-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="m-0 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted">
              Incident summary
            </p>
            <h2
              className="m-0 mt-1 truncate text-xl font-bold tracking-tight sm:text-2xl"
              style={{ color: "var(--theme-ink)" }}
            >
              {event.violation || "Safety incident"}
            </h2>
            <p className="m-0 mt-1 text-sm text-muted">
              Person{" "}
              <span className="font-mono font-semibold text-accent">
                #{event.person_id ?? "—"}
              </span>
              <span className="mx-2 text-dim">·</span>
              {formatTimestamp(event.timestamp)}
            </p>
          </div>
          <div
            className={`inline-flex items-center gap-2 self-start rounded-xl px-3 py-2 text-sm font-semibold sm:self-center ${
              tone === "danger"
                ? "bg-danger-soft text-danger"
                : tone === "warn"
                  ? "bg-warn-soft text-warn"
                  : "bg-accent-soft text-accent"
            }`}
          >
            <AlertIcon className="h-4 w-4" />
            {ppe ? "PPE issue" : zone ? "Zone breach" : "Incident"}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-line bg-panel p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-elevated text-accent">
              <InfoIcon className="h-4 w-4" />
            </span>
            <h3
              className="m-0 text-sm font-bold"
              style={{ color: "var(--theme-ink)" }}
            >
              Details
            </h3>
          </div>

          <dl className="m-0 flex flex-col gap-2.5">
            {details.map((item) => (
              <div
                key={item.label}
                className="flex gap-3 rounded-xl border border-line bg-elevated/70 px-3 py-3"
              >
                <span
                  className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                    item.tone === "danger"
                      ? "bg-danger-soft text-danger"
                      : item.tone === "warn"
                        ? "bg-warn-soft text-warn"
                        : item.tone === "accent"
                          ? "bg-accent-soft text-accent"
                          : "bg-panel text-muted"
                  }`}
                >
                  {item.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted">
                    {item.label}
                  </dt>
                  <dd
                    className={`m-0 mt-0.5 break-words text-sm ${
                      item.mono ? "font-mono" : "font-semibold"
                    } ${item.muted ? "text-muted" : ""} ${
                      item.emphasize ? "text-danger" : ""
                    }`}
                    style={
                      item.emphasize || item.muted
                        ? undefined
                        : { color: "var(--theme-ink)" }
                    }
                  >
                    {item.value}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-2xl border border-line bg-panel p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-elevated text-accent">
                <ImageIcon className="h-4 w-4" />
              </span>
              <div>
                <h3
                  className="m-0 text-sm font-bold"
                  style={{ color: "var(--theme-ink)" }}
                >
                  Evidence screenshot
                </h3>
                <p className="m-0 text-xs text-muted">
                  Annotated frame captured at detection time
                </p>
              </div>
            </div>
            {screenshotSrc ? (
              <a
                href={screenshotSrc}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-elevated px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-accent"
              >
                <ExternalIcon className="h-3.5 w-3.5" />
                Open
              </a>
            ) : null}
          </div>

          <ScreenshotViewer
            src={screenshotSrc}
            alt={`Screenshot for event ${event.id}`}
          />
        </section>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/incidents"
      className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-sm font-semibold transition-colors hover:border-accent/40 hover:bg-accent-soft"
      style={{ color: "var(--theme-ink)" }}
    >
      <ArrowLeftIcon className="h-4 w-4 text-accent" />
      Back to Incidents
    </Link>
  );
}

function iconProps(className = "h-4 w-4") {
  return {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    "aria-hidden": true,
  };
}

function ArrowLeftIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M19 12H5" strokeLinecap="round" />
      <path d="m12 19-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" strokeLinecap="round" />
      <circle cx="12" cy="8" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TypeIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path d="M4 7h16M4 12h10M4 17h14" strokeLinecap="round" />
    </svg>
  );
}

function PersonIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <circle cx="12" cy="8" r="3.5" />
      <path
        d="M5 19.5c1.5-3.2 4-4.8 7-4.8s5.5 1.6 7 4.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AlertIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path
        d="M12 3.5 21 19H3L12 3.5Z"
        strokeLinejoin="round"
      />
      <path d="M12 10v4" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ClockIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ImageIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m21 16-4.5-4.5L8 20" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExternalIcon({ className }) {
  return (
    <svg {...iconProps(className)}>
      <path
        d="M14 5h5v5M19 5 10 14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5"
        strokeLinecap="round"
      />
    </svg>
  );
}
