import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { useTheme } from "../../theme/ThemeContext";

const BAR_COLORS = ["#d97706", "#15803d", "#0369a1"];
const BAR_COLORS_DARK = ["#f5b800", "#2ecc71", "#5dade2"];

function readCssVar(name, fallback) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

export function PpeDistributionChart({ distribution }) {
  const { theme } = useTheme();
  const data = Object.entries(distribution || {}).map(([name, value]) => ({
    name,
    value: Number(value) || 0,
  }));

  const grid = readCssVar("--theme-chart-grid", "#d5dee9");
  const tick = readCssVar("--theme-chart-tick", "#5b6f86");
  const tipBg = readCssVar("--theme-chart-tooltip-bg", "#ffffff");
  const tipBorder = readCssVar("--theme-chart-tooltip-border", "#d5dee9");
  const tipText = readCssVar("--theme-chart-tooltip-text", "#122033");
  const bars = theme === "dark" ? BAR_COLORS_DARK : BAR_COLORS;

  if (data.length === 0) {
    return <p className="m-0 text-sm text-muted">No PPE distribution data available.</p>;
  }

  return (
    <div className="min-h-[260px] w-full">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: tick, fontSize: 12 }}
            axisLine={{ stroke: grid }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: tick, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            cursor={{ fill: "rgba(217, 119, 6, 0.08)" }}
            contentStyle={{
              background: tipBg,
              border: `1px solid ${tipBorder}`,
              borderRadius: 8,
              color: tipText,
              boxShadow: "0 8px 24px rgba(18, 32, 51, 0.08)",
            }}
            formatter={(value) => [`${Number(value).toFixed(1)}%`, "Compliance"]}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
            {data.map((_, index) => (
              <Cell key={data[index].name} fill={bars[index % bars.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
