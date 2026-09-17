import { LiveFeedCard } from "../components/dashboard/LiveFeedCard";

export default function LiveMonitor() {
  return (
    <div className="flex w-full flex-col gap-4">
      <div>
        <h2 className="m-0 text-lg font-semibold text-ink">Live Monitor</h2>
        <p className="m-0 mt-1 text-sm text-muted">
          Drag-and-drop an .mp4, watch the AI stream, stop jobs, and draw
          restricted zones. Recent uploads appear in the job history.
        </p>
      </div>
      <LiveFeedCard compact />
    </div>
  );
}
