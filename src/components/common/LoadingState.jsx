export function LoadingState({ label = "Loading…" }) {
  return (
    <div
      className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-8 text-center text-muted animate-fade-in"
      role="status"
    >
      <div
        className="h-9 w-9 animate-spin rounded-full border-[3px] border-line border-t-accent"
        aria-hidden="true"
      />
      <p className="m-0 text-sm">{label}</p>
    </div>
  );
}
