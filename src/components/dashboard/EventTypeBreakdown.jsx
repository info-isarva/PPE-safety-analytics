import { useMemo } from "react";
import { isPpeEvent, isZoneEvent } from "../../api/endpoints";

export function EventTypeBreakdown({ events }) {
  const { ppe, zone, total } = useMemo(() => {
    const list = events || [];
    let ppeCount = 0;
    let zoneCount = 0;
    for (const e of list) {
      if (isPpeEvent(e.event_type)) ppeCount += 1;
      else if (isZoneEvent(e.event_type)) zoneCount += 1;
    }
    return { ppe: ppeCount, zone: zoneCount, total: list.length };
  }, [events]);

  const ppePct = total ? Math.round((ppe / total) * 100) : 0;
  const zonePct = total ? Math.round((zone / total) * 100) : 0;

  return (
    <section className="flex h-full flex-col rounded-2xl border border-line bg-panel p-4 shadow-sm sm:p-5">
      <h3 className="m-0 mb-1 text-sm font-semibold text-ink">Event Types</h3>
      <p className="m-0 mb-4 text-xs text-muted">PPE vs zone violations</p>

      <div className="flex flex-1 flex-col justify-center gap-4">
        <BreakdownRow
          label="PPE Violations"
          count={ppe}
          pct={ppePct}
          barClass="bg-danger"
        />
        <BreakdownRow
          label="Zone Violations"
          count={zone}
          pct={zonePct}
          barClass="bg-warn"
        />
        <div className="rounded-xl bg-elevated px-3 py-2 text-sm">
          <span className="text-muted">Total events</span>
          <span className="ml-2 font-bold tabular-nums text-ink">{total}</span>
        </div>
      </div>
    </section>
  );
}

function BreakdownRow({ label, count, pct, barClass }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="tabular-nums text-muted">
          {count} · {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
