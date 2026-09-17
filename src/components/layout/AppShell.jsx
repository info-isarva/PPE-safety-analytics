import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { getHealth } from "../../api/endpoints";
import { ThemeToggle } from "../common/ThemeToggle";

const NAV = [
  { to: "/", label: "Overview", end: true, icon: OverviewIcon },
  { to: "/incidents", label: "Incidents", icon: IncidentsIcon },
  { to: "/live", label: "Live", icon: LiveIcon },
  { to: "/reports", label: "Reports", icon: ReportsIcon },
];

const PAGE_META = {
  "/": { title: "Overview", subtitle: "Compliance snapshot" },
  "/incidents": { title: "Incidents", subtitle: "Safety event feed" },
  "/live": { title: "Live Monitor", subtitle: "Upload · stream · zones" },
  "/reports": { title: "Reports", subtitle: "Coming in Phase 14" },
};

const SIDEBAR_KEY = "ppe-sidebar-collapsed";

function OverviewIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IncidentsIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 3 19h18L12 3Z" strokeLinejoin="round" />
      <path d="M12 9v5" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LiveIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M5.5 8a9 9 0 0 0 0 8M18.5 8a9 9 0 0 1 0 8" strokeLinecap="round" />
    </svg>
  );
}

function ReportsIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 19V5M4 19h16" strokeLinecap="round" />
      <path d="M8 15v-4M12 15V8M16 15v-6" strokeLinecap="round" />
    </svg>
  );
}

function PanelLeftIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [apiOk, setApiOk] = useState(null);
  const location = useLocation();

  const page = useMemo(() => {
    if (location.pathname.startsWith("/incidents/")) {
      return { title: "Event detail", subtitle: "Incident evidence" };
    }
    return PAGE_META[location.pathname] || { title: "Dashboard", subtitle: "" };
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        await getHealth();
        if (!cancelled) setApiOk(true);
      } catch {
        if (!cancelled) setApiOk(false);
      }
    }

    check();
    const id = setInterval(check, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  function handleSidebarToggle() {
    // Mobile drawer
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setMobileOpen((open) => !open);
      return;
    }
    // Desktop collapse
    setCollapsed((value) => !value);
  }

  const sidebarWidth = collapsed ? "lg:w-16" : "lg:w-56";
  const mainOffset = collapsed ? "lg:ml-16" : "lg:ml-56";

  return (
    <div className="relative min-h-dvh bg-base">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh flex-col overflow-visible border-r border-sidebar/20 bg-sidebar text-sidebar-ink transition-all duration-300 ease-out w-56 ${sidebarWidth} ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        aria-label="Main navigation"
      >
        <div
          className={`flex h-14 items-center border-b border-white/10 ${
            collapsed ? "justify-center px-2" : "gap-2.5 px-3"
          }`}
        >
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-[0.7rem] font-black text-white"
            aria-hidden="true"
          >
            PPE
          </span>
          {!collapsed ? (
            <div className="min-w-0 leading-tight">
              <p className="m-0 truncate text-sm font-bold text-white">PPE Safety</p>
              <p className="m-0 text-[0.65rem] uppercase tracking-[0.12em] text-sidebar-muted">
                Analytics
              </p>
            </div>
          ) : null}
        </div>

        <nav className={`flex flex-1 flex-col gap-0.5 p-2 ${collapsed ? "items-center" : ""}`}>
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                aria-label={item.label}
                className={({ isActive }) =>
                  `group relative flex items-center rounded-lg text-sm font-medium transition-colors duration-150 ${
                    collapsed
                      ? "h-10 w-10 justify-center"
                      : "gap-2.5 px-2.5 py-2"
                  } ${
                    isActive
                      ? "bg-accent text-white"
                      : "text-sidebar-muted hover:bg-white/8 hover:text-white"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed ? (
                      <>
                        <span>{item.label}</span>
                        {isActive ? (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />
                        ) : null}
                      </>
                    ) : (
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs font-semibold text-ink opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                      >
                        {item.label}
                        <span
                          className="absolute top-1/2 -left-1 h-2 w-2 -translate-y-1/2 rotate-45 border-b border-l border-line bg-panel"
                          aria-hidden="true"
                        />
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className={`border-t border-white/10 p-2 ${collapsed ? "flex justify-center" : ""}`}>
          <div
            className={`group relative flex items-center gap-2 rounded-lg text-xs font-medium ${
              collapsed ? "h-10 w-10 justify-center" : "px-2.5 py-2"
            } ${
              apiOk === true
                ? "bg-ok/20 text-ok"
                : apiOk === false
                  ? "bg-danger/20 text-danger"
                  : "bg-white/8 text-sidebar-muted"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                apiOk === true
                  ? "animate-pulse-dot bg-ok"
                  : apiOk === false
                    ? "bg-danger"
                    : "bg-sidebar-muted"
              }`}
              aria-hidden="true"
            />
            {!collapsed ? (
              <span
                className={
                  apiOk === true
                    ? "text-[#86efac]"
                    : apiOk === false
                      ? "text-[#fca5a5]"
                      : ""
                }
              >
                {apiOk === null ? "Checking…" : apiOk ? "API online" : "API offline"}
              </span>
            ) : (
              <span
                role="tooltip"
                className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs font-semibold text-ink opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
              >
                {apiOk === null ? "Checking API" : apiOk ? "API online" : "API offline"}
                <span
                  className="absolute top-1/2 -left-1 h-2 w-2 -translate-y-1/2 rotate-45 border-b border-l border-line bg-panel"
                  aria-hidden="true"
                />
              </span>
            )}
          </div>
        </div>
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 border-0 bg-ink/40 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className={`flex min-h-dvh min-w-0 flex-col transition-[margin] duration-300 ${mainOffset}`}>
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-panel/90 px-3 shadow-sm backdrop-blur-md sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-elevated text-ink transition-colors hover:bg-panel-hover"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={handleSidebarToggle}
            >
              <PanelLeftIcon className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p
                className="m-0 truncate text-base font-bold sm:text-lg"
                style={{ color: "var(--theme-ink, #0f172a)" }}
              >
                {page.title}
              </p>
              {page.subtitle ? (
                <p
                  className="m-0 truncate text-xs"
                  style={{ color: "var(--theme-muted, #5b6f86)" }}
                >
                  {page.subtitle}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <span
              className={`hidden items-center gap-1.5 rounded-md px-2 py-1 text-[0.7rem] font-semibold sm:inline-flex ${
                apiOk
                  ? "bg-ok-soft text-ok"
                  : apiOk === false
                    ? "bg-danger-soft text-danger"
                    : "bg-elevated text-muted"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  apiOk ? "bg-ok" : apiOk === false ? "bg-danger" : "bg-dim"
                }`}
              />
              {apiOk ? "Live" : apiOk === false ? "Offline" : "…"}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-3 sm:p-4">
          <div key={location.pathname} className="animate-fade-up h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
