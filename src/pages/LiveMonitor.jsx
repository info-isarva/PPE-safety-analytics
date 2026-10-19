import { LiveFeedCard } from "../components/dashboard/LiveFeedCard";

export default function LiveMonitor() {
  return (
    <div className="flex w-full flex-col gap-4">
      <div>
        <h2 className="m-0 text-lg font-semibold text-ink">Live Monitor</h2>
        <p className="m-0 mt-1 text-sm text-muted">
          Upload an .mp4, start the server webcam, or start an enabled backend
          camera and watch the AI-processed stream via its stream_url. Draw
          restricted zones on the live feed.
        </p>
      </div>
      <LiveFeedCard compact />
    </div>
  );
}
