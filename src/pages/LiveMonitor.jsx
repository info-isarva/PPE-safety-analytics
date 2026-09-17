import { LiveFeedCard } from "../components/dashboard/LiveFeedCard";

export default function LiveMonitor() {
  return (
    <div className="flex w-full flex-col gap-4">
      <div>
        <p className="m-0 text-sm text-muted">
          Upload a site video, watch the AI-annotated stream, and draw restricted
          zones on the Live Feed. Incident screenshots remain evidence only.
        </p>
      </div>
      <LiveFeedCard compact />
    </div>
  );
}
