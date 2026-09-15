import { useTheme } from "../../theme/ThemeContext";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="inline-flex items-center rounded-lg border border-line bg-elevated p-0.5"
      role="group"
      aria-label="Color theme"
    >
      <button
        type="button"
        aria-pressed={theme === "light"}
        title="Light theme"
        onClick={() => setTheme("light")}
        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
          theme === "light"
            ? "bg-panel text-ink shadow-sm"
            : "text-muted hover:text-ink"
        }`}
      >
        <SunIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Light</span>
      </button>
      <button
        type="button"
        aria-pressed={theme === "dark"}
        title="Dark theme"
        onClick={() => setTheme("dark")}
        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
          theme === "dark"
            ? "bg-panel text-ink shadow-sm"
            : "text-muted hover:text-ink"
        }`}
      >
        <MoonIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Dark</span>
      </button>
    </div>
  );
}

function SunIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}
