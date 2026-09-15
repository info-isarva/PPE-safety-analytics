export function CircularProgress({ value, size = 64, stroke = 6 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-line"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-ok transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
    </div>
  );
}

export function SummaryMetricCard({ label, value, tone = "default", icon, progress }) {
  const valueClass =
    tone === "ok"
      ? "text-ok"
      : tone === "danger"
        ? "text-danger"
        : tone === "info"
          ? "text-sky-600 dark:text-sky-400"
          : "text-ink";

  return (
    <article className="flex items-center gap-4 rounded-2xl border border-line bg-panel p-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-5">
      <div className="shrink-0">
        {typeof progress === "number" ? (
          <CircularProgress value={progress} />
        ) : (
          <div
            className={`grid h-14 w-14 place-items-center rounded-2xl ${
              tone === "danger"
                ? "bg-danger-soft text-danger"
                : tone === "info"
                  ? "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400"
                  : "bg-accent-soft text-accent"
            }`}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="m-0 text-sm font-medium text-muted">{label}</p>
        <p className={`mt-1 m-0 text-3xl font-bold tracking-tight tabular-nums ${valueClass}`}>
          {value}
        </p>
      </div>
    </article>
  );
}
