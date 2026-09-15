export default function LiveMonitor() {
  return (
    <div className="flex w-full flex-col gap-3">
      <section className="rounded-xl border border-dashed border-accent/30 bg-panel p-5">
        <p className="m-0 mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-accent">
          Phase 11
        </p>
        <h3 className="mb-1 m-0 text-lg font-semibold">Coming soon</h3>
        <p className="m-0 max-w-xl text-sm text-muted">
          Live monitoring over WebSocket will stream detections and camera feeds
          here. Overview currently uses REST polling until this phase is ready.
        </p>
      </section>
    </div>
  );
}
