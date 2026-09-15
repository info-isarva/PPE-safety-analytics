export function ErrorState({ title = "Something went wrong", message, onRetry }) {
  return (
    <div
      className="flex min-h-[180px] flex-col items-center justify-center gap-3 p-8 text-center text-muted"
      role="alert"
    >
      <h3 className="m-0 text-danger">{title}</h3>
      {message ? <p className="m-0 max-w-sm">{message}</p> : null}
      {onRetry ? (
        <button
          type="button"
          className="cursor-pointer rounded-md border border-line bg-panel px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-line-strong hover:bg-panel-hover"
          onClick={onRetry}
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
