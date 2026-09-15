export function StatusBadge({ type }) {
  const isPpe = type === "PPE_VIOLATION";
  const isZone = type === "ZONE_VIOLATION" || type === "RESTRICTED_ZONE";

  let label = type || "UNKNOWN";
  let classes =
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold tracking-wide ";

  if (isPpe) {
    label = "PPE Violation";
    classes += "bg-danger-soft text-danger ring-1 ring-danger/25";
  } else if (isZone) {
    label = "Zone Violation";
    classes += "bg-warn-soft text-warn ring-1 ring-warn/25";
  } else {
    classes += "bg-muted/10 text-muted ring-1 ring-muted/20";
  }

  return (
    <span className={classes}>
      {isPpe ? (
        <ShieldIcon className="h-3.5 w-3.5" />
      ) : isZone ? (
        <MapPinIcon className="h-3.5 w-3.5" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-muted" aria-hidden="true" />
      )}
      {label}
    </span>
  );
}

function ShieldIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden="true"
    >
      <path
        d="M12 3 5 6v5c0 4.5 2.8 7.4 7 9 4.2-1.6 7-4.5 7-9V6l-7-3Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MapPinIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden="true"
    >
      <path
        d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  );
}
