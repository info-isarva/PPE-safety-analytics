import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useMemo } from "react";
import { useTheme } from "../../theme/ThemeContext";

function readCssVar(name, fallback) {
  if (typeof window === "undefined") return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}

/** Build daily event counts from real /events timestamps. */
function buildDailySeries(events) {
  const map = new Map();

  for (const event of events || []) {
    if (!event?.timestamp) continue;
    const d = new Date(event.timestamp);
    if (Number.isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + 1);
  }

  const days = [...map.keys()].sort();
  if (days.length === 0) return [];

  return days.map((day) => ({
    day: new Date(day).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    count: map.get(day),
  }));
}

export function EventsTrendChart({ events }) {
  const { theme } = useTheme();
  const data = useMemo(() => buildDailySeries(events), [events]);

  const grid = readCssVar("--theme-chart-grid", "#d5dee9");
  const tick = readCssVar("--theme-chart-tick", "#5b6f86");
  const tipBg = readCssVar("--theme-chart-tooltip-bg", "#ffffff");
  const tipBorder = readCssVar("--theme-chart-tooltip-border", "#d5dee9");
  const tipText = readCssVar("--theme-chart-tooltip-text", "#122033");
  const stroke = theme === "dark" ? "#f5b800" : "#d97706";

  return (
    <section className="flex h-full flex-col rounded-2xl border border-line bg-panel p-4 shadow-sm sm:p-5">
      <h3 className="m-0 mb-1 text-sm font-semibold text-ink">Events by Day</h3>
      <p className="m-0 mb-3 text-xs text-muted">Daily incident volume</p>
      <div className="min-h-[160px] flex-1">
        {data.length === 0 ? (
          <p className="m-0 text-sm text-muted">No event timestamps available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: tick, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: tick, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip
                contentStyle={{
                  background: tipBg,
                  border: `1px solid ${tipBorder}`,
                  borderRadius: 8,
                  color: tipText,
                }}
                formatter={(value) => [value, "Events"]}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke={stroke}
                fill={stroke}
                fillOpacity={0.18}
                strokeWidth={2.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
