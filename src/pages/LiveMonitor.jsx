import { LiveFeedCard } from "../components/dashboard/LiveFeedCard";
import { MultiCameraLivePanel } from "../components/dashboard/MultiCameraLivePanel";

export default function LiveMonitor() {
  return (
    <div className="flex w-full flex-col gap-4">
      <div>
        <h2 className="m-0 text-lg font-semibold text-ink">Live Monitor</h2>
        <p className="m-0 mt-1 text-sm text-muted">
          Start all cameras and watch each AI feed via its returned stream_url,
          or use a single source (upload / webcam / one saved camera) below.
        </p>
      </div>

      <MultiCameraLivePanel />

      <div>
        <h3 className="m-0 text-sm font-semibold text-ink">
          Single source · zones
        </h3>
        <p className="m-0 mt-1 text-xs text-muted">
          Upload, webcam, or one saved camera with restricted-zone drawing.
        </p>
      </div>
      <LiveFeedCard compact />
    </div>
  );
}
