const toneBar = {
  default: "before:bg-accent",
  ok: "before:bg-ok",
  danger: "before:bg-danger",
  warn: "before:bg-warn",
};

export function KpiCard({ label, value, hint, tone = "default" }) {
  return (
    <article
      className={`group relative overflow-hidden rounded-xl border border-line bg-panel px-3.5 py-3 transition-colors duration-200 hover:border-line-strong hover:bg-panel-hover before:absolute before:inset-y-0 before:left-0 before:w-1 ${toneBar[tone] || toneBar.default}`}
    >
      <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.07em] text-muted">
        {label}
      </p>
      <p className="mt-1 m-0 text-2xl font-bold tabular-nums tracking-tight sm:text-[1.75rem]">
        {value}
      </p>
      {hint ? <p className="mt-1 m-0 text-[0.7rem] text-dim">{hint}</p> : null}
    </article>
  );
}
