import { PageSizeSelect } from "./PageSizeSelect";

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  menuPlacement = "bottom",
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);

  const canPrev = current > 1;
  const canNext = current < totalPages;

  function goTo(next) {
    const clamped = Math.min(Math.max(1, next), totalPages);
    if (clamped !== current) onPageChange(clamped);
  }

  const pageNumbers = buildPageWindow(current, totalPages);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-xs text-muted sm:text-sm">
          Showing{" "}
          <strong style={{ color: "var(--theme-ink)" }}>
            {start}–{end}
          </strong>{" "}
          of{" "}
          <strong style={{ color: "var(--theme-ink)" }}>{total}</strong>
        </p>

        {onPageSizeChange ? (
          <PageSizeSelect
            value={pageSize}
            onChange={onPageSizeChange}
            placement={menuPlacement}
          />
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 sm:hidden">
        <PageButton
          disabled={!canPrev}
          onClick={() => goTo(current - 1)}
          label="Previous page"
          className="flex-1"
        >
          ‹ Prev
        </PageButton>
        <span
          className="shrink-0 rounded-md border border-line bg-elevated px-3 py-1.5 text-xs font-semibold"
          style={{ color: "var(--theme-ink)" }}
        >
          {current} / {totalPages}
        </span>
        <PageButton
          disabled={!canNext}
          onClick={() => goTo(current + 1)}
          label="Next page"
          className="flex-1"
        >
          Next ›
        </PageButton>
      </div>

      <div className="hidden flex-wrap items-center justify-end gap-1 sm:flex">
        <PageButton disabled={!canPrev} onClick={() => goTo(1)} label="First page">
          «
        </PageButton>
        <PageButton
          disabled={!canPrev}
          onClick={() => goTo(current - 1)}
          label="Previous page"
        >
          ‹
        </PageButton>

        {pageNumbers.map((item, index) =>
          item === "…" ? (
            <span key={`e-${index}`} className="px-1.5 text-sm text-muted">
              …
            </span>
          ) : (
            <PageButton
              key={item}
              active={item === current}
              onClick={() => goTo(item)}
              label={`Page ${item}`}
            >
              {item}
            </PageButton>
          )
        )}

        <PageButton
          disabled={!canNext}
          onClick={() => goTo(current + 1)}
          label="Next page"
        >
          ›
        </PageButton>
        <PageButton
          disabled={!canNext}
          onClick={() => goTo(totalPages)}
          label="Last page"
        >
          »
        </PageButton>
      </div>
    </div>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
  active,
  label,
  className = "",
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`min-w-9 cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-accent bg-accent text-white"
          : "border-line bg-panel hover:bg-panel-hover"
      } ${className}`}
      style={active ? undefined : { color: "var(--theme-ink)" }}
    >
      {children}
    </button>
  );
}

function buildPageWindow(current, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set([1, totalPages, current, current - 1, current + 1]);
  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (current >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("…");
    result.push(sorted[i]);
  }
  return result;
}
