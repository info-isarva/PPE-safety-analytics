import {
  BrowserRouter,
  HashRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import Overview from "./pages/Overview";
import Incidents from "./pages/Incidents";
import EventDetail from "./pages/EventDetail";
import LiveMonitor from "./pages/LiveMonitor";
import Reports from "./pages/Reports";

const isDesktop =
  typeof window !== "undefined" && Boolean(window.desktopApp?.isDesktop);

const Router = isDesktop ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Overview />} />
          <Route path="incidents" element={<Incidents />} />
          <Route path="incidents/:id" element={<EventDetail />} />
          <Route path="live" element={<LiveMonitor />} />
          <Route path="reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}
