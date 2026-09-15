import { useEffect, useId, useRef, useState } from "react";

const SIZES = [10, 25, 50, 100];

export function PageSizeSelect({
  value,
  onChange,
  label = "Rows per page",
  placement = "bottom",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex items-center gap-2">
      <span className="hidden text-xs text-muted sm:inline">{label}</span>

      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex min-w-[4.5rem] cursor-pointer items-center justify-between gap-2 rounded-lg border bg-panel px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-all ${
          open
            ? "border-accent ring-2 ring-accent/20"
            : "border-line hover:border-line-strong hover:bg-panel-hover"
        }`}
        style={{ color: "var(--theme-ink)" }}
      >
        <span>{value}</span>
        <ChevronIcon
          className={`h-3.5 w-3.5 text-muted transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className={`absolute right-0 z-50 m-0 min-w-[5.5rem] list-none overflow-hidden rounded-xl border border-line bg-panel p-1 shadow-[0_12px_32px_rgba(15,23,42,0.14)] ${
            placement === "top"
              ? "bottom-[calc(100%+6px)]"
              : "top-[calc(100%+6px)]"
          }`}
        >
          {SIZES.map((size) => {
            const selected = size === value;
            return (
              <li key={size} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(size);
                    setOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${
                    selected
                      ? "bg-accent text-white"
                      : "hover:bg-elevated"
                  }`}
                  style={selected ? undefined : { color: "var(--theme-ink)" }}
                >
                  <span>{size}</span>
                  {selected ? <CheckIcon className="h-3.5 w-3.5" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function ChevronIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden="true"
    >
      <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
