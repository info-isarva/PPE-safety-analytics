export function EmptyState({ title = "No data", message }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 p-8 text-center text-muted">
      <h3 className="m-0 text-ink">{title}</h3>
      {message ? <p className="m-0 max-w-sm">{message}</p> : null}
    </div>
  );
}
