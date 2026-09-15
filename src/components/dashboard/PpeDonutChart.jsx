import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTheme } from "../../theme/ThemeContext";

const LIGHT = ["#3b82f6", "#22c55e", "#0ea5e9", "#f59e0b", "#a855f7"];
const DARK = ["#60a5fa", "#34d399", "#38bdf8", "#fbbf24", "#c084fc"];

function readCssVar(name, fallback) {
  if (typeof window === "undefined") return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}

export function PpeDonutChart({ distribution }) {
  const { theme } = useTheme();
  const colors = theme === "dark" ? DARK : LIGHT;
  const data = Object.entries(distribution || {}).map(([name, value]) => ({
    name,
    value: Number(value) || 0,
  }));

  const tipBg = readCssVar("--theme-chart-tooltip-bg", "#ffffff");
  const tipBorder = readCssVar("--theme-chart-tooltip-border", "#d5dee9");
  const tipText = readCssVar("--theme-chart-tooltip-text", "#122033");

  return (
    <section className="flex h-full flex-col rounded-2xl border border-line bg-panel p-4 shadow-sm sm:p-5">
      <h3 className="m-0 mb-1 text-sm font-semibold text-ink">PPE Distribution</h3>
      <p className="m-0 mb-3 text-xs text-muted">Compliance by equipment class</p>

      {data.length === 0 ? (
        <p className="m-0 text-sm text-muted">No PPE distribution data.</p>
      ) : (
        <div className="flex flex-1 flex-col items-center gap-4 sm:flex-row">
          <div className="h-[150px] w-[150px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={42}
                  outerRadius={68}
                  paddingAngle={3}
                  stroke="none"
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={colors[index % colors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: tipBg,
                    border: `1px solid ${tipBorder}`,
                    borderRadius: 8,
                    color: tipText,
                  }}
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, "Rate"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="m-0 flex w-full list-none flex-col gap-2.5 p-0">
            {data.map((item, index) => (
              <li
                key={item.name}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="inline-flex items-center gap-2 text-ink">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: colors[index % colors.length] }}
                  />
                  {item.name}
                </span>
                <span className="font-semibold tabular-nums text-muted">
                  {Number(item.value).toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
