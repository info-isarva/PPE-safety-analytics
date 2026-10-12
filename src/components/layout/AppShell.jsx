import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { getHealth } from "../../api/endpoints";
import { useBrandLogos } from "../../settings/BrandLogoContext";
import { ViolationAlertListener } from "../alerts/ViolationAlertListener";
import { ThemeToggle } from "../common/ThemeToggle";

const NAV = [
  { to: "/", label: "Overview", end: true, icon: OverviewIcon },
  { to: "/incidents", label: "Incidents", icon: IncidentsIcon },
  { to: "/live", label: "Live View", icon: LiveIcon },
  { to: "/cameras", label: "Cameras", icon: CamerasIcon },
  { to: "/models", label: "Models", icon: ModelsIcon },
  { to: "/reports", label: "Reports", icon: ReportsIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const SOON_NAV = [{ label: "Analytics", icon: AnalyticsIcon }];

const SYSTEM_NAV = [
  { label: "Users", icon: UsersIcon },
  { label: "Locations", icon: LocationsIcon },
  { label: "Integrations", icon: IntegrationsIcon },
  { label: "API Access", icon: ApiIcon },
];

const PAGE_META = {
  "/": { title: "Overview", subtitle: "Compliance snapshot" },
  "/incidents": { title: "Incidents", subtitle: "Safety event feed" },
  "/live": { title: "Live View", subtitle: "Upload · stream · zones" },
  "/cameras": { title: "Cameras", subtitle: "RTSP · Webcam · HTTP sources" },
  "/models": {
    title: "Models",
    subtitle: "Dataset upload · train · activate",
  },
  "/reports": { title: "Reports", subtitle: "Coming in Phase 14" },
  "/settings": { title: "Settings", subtitle: "Brand · preferences" },
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

function CamerasIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 8h4l2-2h6l2 2h4v11H3V8Z" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function ModelsIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" strokeLinejoin="round" />
      <path d="M12 12 4 7M12 12l8-5M12 12v10" strokeLinecap="round" />
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

function AnalyticsIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 19V5M4 19h16" strokeLinecap="round" />
      <path d="m7 14 3-4 3 2 4-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SettingsIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M4.9 6.5l1.6 1.6M17.5 15.9l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.5l1.6-1.6M17.5 8.1l1.6-1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UsersIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M2 19c0-3 3-5 7-5s7 2 7 5M14.5 19c.4-1.8 1.8-3 4-3 2 0 3.5 1 4 3" strokeLinecap="round" />
    </svg>
  );
}

function LocationsIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function IntegrationsIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 5" strokeLinecap="round" />
      <path d="M14 11a5 5 0 0 0-7.07 0L4.8 13.12a5 5 0 0 0 7.07 7.07L13 19" strokeLinecap="round" />
    </svg>
  );
}

function ApiIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13 5l-2 14" strokeLinecap="round" strokeLinejoin="round" />
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

function SearchIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 9a6 6 0 0 1 12 0c0 7 2 7 2 7H4s2 0 2-7" strokeLinejoin="round" />
      <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AppShell() {
  const { fullLogoSrc, markLogoSrc } = useBrandLogos();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [apiOk, setApiOk] = useState(null);
  const [headerSearch, setHeaderSearch] = useState("");
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

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("nethra-header-search")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleSidebarToggle() {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setMobileOpen((open) => !open);
      return;
    }
    setCollapsed((value) => !value);
  }

  const sidebarWidth = collapsed ? "lg:w-20" : "lg:w-[270px]";
  const mainOffset = collapsed ? "lg:ml-20" : "lg:ml-[270px]";

  return (
    <div className="relative min-h-dvh bg-base">
      <ViolationAlertListener />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-[270px] flex-col overflow-hidden border-r border-white/5 bg-sidebar text-sidebar-ink transition-all duration-300 ease-out ${sidebarWidth} ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        aria-label="Main navigation"
      >
        <div
          className={`nethra-logo-rail flex shrink-0 items-center border-b border-white/10 ${
            collapsed ? "h-[68px] justify-center px-2" : "h-[68px] justify-center px-4"
          }`}
        >
          {collapsed ? (
            <img src={markLogoSrc} alt="Isarva Nethra" className="h-10 w-10 object-contain" />
          ) : (
            <img
              src={fullLogoSrc}
              alt="Isarva Nethra"
              className="h-11 w-auto max-w-[180px] object-contain"
            />
          )}
        </div>

        <nav className={`flex flex-1 flex-col gap-1 overflow-y-auto p-3 ${collapsed ? "items-center" : ""}`}>
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                aria-label={item.label}
                className={({ isActive }) =>
                  `group relative flex items-center rounded-xl text-sm font-medium transition-colors duration-150 ${
                    collapsed ? "h-11 w-11 justify-center" : "gap-2.5 px-3 py-2.5"
                  } ${
                    isActive
                      ? "bg-[linear-gradient(135deg,var(--theme-nav-active),var(--theme-nav-active-end))] text-white shadow-sm"
                      : "text-sidebar-muted hover:bg-white/8 hover:text-white"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed ? (
                      <>
                        <span className="truncate">{item.label}</span>
                        {isActive ? (
                          <span className="ml-auto h-2 w-2 rounded-full bg-white" />
                        ) : null}
                      </>
                    ) : (
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-line bg-panel px-2.5 py-1.5 text-xs font-semibold text-ink opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                      >
                        {item.label}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}

          {SOON_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                title="Coming soon"
                className={`group relative flex cursor-default items-center rounded-xl text-sm font-medium text-sidebar-muted/70 ${
                  collapsed ? "h-11 w-11 justify-center" : "gap-2.5 px-3 py-2.5"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed ? <span>{item.label}</span> : null}
              </button>
            );
          })}

          {!collapsed ? (
            <p className="m-0 mt-4 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-sidebar-muted/80">
              System
            </p>
          ) : (
            <div className="my-2 h-px w-8 bg-white/10" />
          )}

          {SYSTEM_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                title="Coming soon"
                className={`group relative flex cursor-default items-center rounded-xl text-sm font-medium text-sidebar-muted/70 ${
                  collapsed ? "h-11 w-11 justify-center" : "gap-2.5 px-3 py-2.5"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed ? <span>{item.label}</span> : null}
              </button>
            );
          })}
        </nav>

        <div className={`border-t border-white/10 p-3 ${collapsed ? "flex justify-center" : ""}`}>
          <div
            className={`flex w-full items-center gap-2 rounded-xl border border-white/10 bg-[#123B66] ${
              collapsed ? "h-11 w-11 justify-center" : "px-3 py-2.5"
            }`}
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                apiOk === true
                  ? "animate-pulse-dot bg-[#22C55E]"
                  : apiOk === false
                    ? "bg-danger"
                    : "bg-sidebar-muted"
              }`}
            />
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <p className="m-0 text-xs font-semibold text-white">
                  {apiOk === null ? "Checking…" : apiOk ? "API Online" : "API Offline"}
                </p>
                <p className="m-0 truncate text-[0.65rem] text-sidebar-muted">
                  {apiOk ? "All systems operational" : "Check backend / ngrok"}
                </p>
              </div>
            ) : null}
            {!collapsed ? <ChevronIcon className="h-3.5 w-3.5 text-sidebar-muted" /> : null}
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
        <header className="nethra-header sticky top-0 z-20 flex h-[68px] items-center gap-3 px-3 sm:gap-4 sm:px-5">
          <button
            type="button"
            className="nethra-header-btn grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-ink transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={handleSidebarToggle}
          >
            <PanelLeftIcon className="h-4 w-4" />
          </button>

          <label className="relative hidden min-w-0 flex-1 md:block">
            <span className="relative block w-full max-w-[560px]">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[color:var(--nethra-lime)]" />
              <input
                id="nethra-header-search"
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                placeholder="Search cameras, locations, or settings..."
                className="nethra-header-search h-11 w-full rounded-xl border pr-16 pl-10 text-sm outline-none transition-shadow"
              />
              <span className="nethra-header-kbd pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-md border px-1.5 py-0.5 text-[0.65rem] font-semibold">
                Ctrl + K
              </span>
            </span>
          </label>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="nethra-header-theme">
              <ThemeToggle />
            </div>
            <span
              className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold sm:inline-flex ${
                apiOk ? "nethra-header-live" : "bg-white/10 text-[#9bb0c9]"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  apiOk
                    ? "nethra-header-live-dot"
                    : apiOk === false
                      ? "bg-danger"
                      : "bg-dim"
                }`}
              />
              Live
            </span>
            <button
              type="button"
              className="nethra-header-btn relative grid h-10 w-10 place-items-center rounded-xl border transition-colors"
              aria-label="Notifications"
            >
              <BellIcon className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.6rem] font-bold text-white">
                3
              </span>
            </button>
            <button
              type="button"
              className="nethra-header-admin hidden items-center gap-2 rounded-xl border py-1.5 pr-2.5 pl-1.5 sm:inline-flex"
            >
              <span className="nethra-header-admin-avatar grid h-8 w-8 place-items-center rounded-full text-xs font-bold">
                A
              </span>
              <span className="text-sm font-semibold text-[#eaf4ff]">Admin</span>
              <svg className="h-3.5 w-3.5 text-[#9bb0c9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-7">
          <div key={location.pathname} className="animate-fade-up h-full">
            {location.pathname === "/cameras" ||
            location.pathname === "/models" ? null : (
              <div className="mb-4 hidden sm:block">
                <p className="m-0 text-xl font-bold text-ink">{page.title}</p>
                {page.subtitle ? (
                  <p className="m-0 mt-0.5 text-sm text-muted">{page.subtitle}</p>
                ) : null}
              </div>
            )}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
