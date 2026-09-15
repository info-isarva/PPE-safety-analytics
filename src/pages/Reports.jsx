export default function Reports() {
  return (
    <div className="flex w-full flex-col gap-3">
      <section className="rounded-xl border border-dashed border-accent/30 bg-panel p-5">
        <p className="m-0 mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-accent">
          Phase 14
        </p>
        <h3 className="mb-1 m-0 text-lg font-semibold">Coming soon</h3>
        <p className="m-0 max-w-xl text-sm text-muted">
          Scheduled analytics, exportable reports, and historical trend views
          will land here after authentication and live monitoring.
        </p>
      </section>
    </div>
  );
}
