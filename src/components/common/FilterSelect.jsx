import { useEffect, useId, useRef, useState } from "react";

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select…",
  placement = "bottom",
  open: openProp,
  onOpenChange,
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;
  const setOpen = (next) => {
    const valueNext = typeof next === "function" ? next(open) : next;
    if (!isControlled) setUncontrolledOpen(valueNext);
    onOpenChange?.(valueNext);
  };

  const rootRef = useRef(null);
  const listId = useId();
  const labelId = useId();

  const selected = options.find((opt) => opt.id === value);
  const display = selected?.label ?? placeholder;
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current === value) return;
    prevValueRef.current = value;
    if (!isControlled) setUncontrolledOpen(false);
    onOpenChange?.(false);
  }, [value, isControlled, onOpenChange]);

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        if (!isControlled) setUncontrolledOpen(false);
        onOpenChange?.(false);
      }
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        if (!isControlled) setUncontrolledOpen(false);
        onOpenChange?.(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, isControlled, onOpenChange]);

  const menuPosition =
    placement === "top"
      ? "bottom-[calc(100%+6px)]"
      : "top-[calc(100%+6px)]";

  return (
    <div
      ref={rootRef}
      className={`relative flex min-w-0 flex-1 flex-col gap-1.5 ${
        open ? "z-50" : "z-0"
      }`}
    >
      <span
        id={labelId}
        className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted"
      >
        {label}
      </span>

      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        onClick={() => setOpen(!open)}
        className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border bg-elevated px-3 py-2.5 text-left text-sm font-semibold shadow-sm transition-all ${
          open
            ? "border-accent bg-panel ring-2 ring-accent/25"
            : "border-line hover:border-line-strong hover:bg-panel"
        }`}
        style={{ color: "var(--theme-ink)" }}
      >
        <span className="min-w-0 truncate">{display}</span>
        <ChevronIcon
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${
            open ? "rotate-180 text-accent" : ""
          }`}
        />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          className={`absolute left-0 right-0 ${menuPosition} z-50 m-0 max-h-56 list-none overflow-y-auto rounded-xl border border-line bg-panel p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.16)] animate-fade-in`}
        >
          {options.map((opt) => {
            const isSelected = opt.id === value;
            return (
              <li key={opt.id} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    isSelected
                      ? "bg-accent text-white shadow-sm"
                      : "hover:bg-elevated"
                  }`}
                  style={isSelected ? undefined : { color: "var(--theme-ink)" }}
                >
                  <span className="min-w-0 truncate">{opt.label}</span>
                  {isSelected ? <CheckIcon className="h-4 w-4 shrink-0" /> : null}
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
