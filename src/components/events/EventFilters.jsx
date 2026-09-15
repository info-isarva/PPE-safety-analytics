import { useState } from "react";
import { FilterSelect } from "../common/FilterSelect";
import { DatePickerField } from "../common/DatePickerField";

const TYPE_FILTERS = [
  { id: "all", label: "All types" },
  { id: "PPE_VIOLATION", label: "PPE Violations" },
  { id: "RESTRICTED_ZONE", label: "Zone Violations" },
];

const DATE_FILTERS = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 days" },
  { id: "14d", label: "Last 14 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "this_week", label: "This week" },
  { id: "last_week", label: "Last week" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "custom", label: "Custom range" },
];

const SORT_OPTIONS = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "person", label: "Person ID" },
  { id: "violation", label: "Violation A–Z" },
];

export function EventFilters({
  typeFilter,
  onTypeChange,
  dateFilter,
  onDateChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  violationFilter,
  onViolationChange,
  violationOptions,
  sortBy,
  onSortChange,
  search,
  onSearchChange,
  onClear,
  hasActiveFilters,
  action = null,
}) {
  const [openMenu, setOpenMenu] = useState(null);

  function handleDateChange(next) {
    setOpenMenu(null);
    onDateChange(next);
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 overflow-visible rounded-2xl border border-line bg-panel p-3 shadow-sm sm:p-4">
      <div className="relative grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FilterSelect
          label="Type"
          value={typeFilter}
          onChange={onTypeChange}
          options={TYPE_FILTERS}
          open={openMenu === "type"}
          onOpenChange={(isOpen) => setOpenMenu(isOpen ? "type" : null)}
        />
        <FilterSelect
          label="Date"
          value={dateFilter}
          onChange={handleDateChange}
          options={DATE_FILTERS}
          open={openMenu === "date"}
          onOpenChange={(isOpen) => setOpenMenu(isOpen ? "date" : null)}
        />
        <FilterSelect
          label="Violation"
          value={violationFilter}
          onChange={onViolationChange}
          options={[
            { id: "all", label: "All violations" },
            ...violationOptions,
          ]}
          open={openMenu === "violation"}
          onOpenChange={(isOpen) => setOpenMenu(isOpen ? "violation" : null)}
        />
        <FilterSelect
          label="Sort"
          value={sortBy}
          onChange={onSortChange}
          options={SORT_OPTIONS}
          open={openMenu === "sort"}
          onOpenChange={(isOpen) => setOpenMenu(isOpen ? "sort" : null)}
        />
      </div>

      {dateFilter === "custom" ? (
        <div className="relative isolate grid grid-cols-1 gap-2.5 rounded-xl border border-accent/30 bg-panel p-3 shadow-sm sm:grid-cols-2">
          <DatePickerField
            label="From"
            value={customFrom}
            onChange={onCustomFromChange}
            maxDate={customTo || undefined}
            placeholder="Start date"
          />
          <DatePickerField
            label="To"
            value={customTo}
            onChange={onCustomToChange}
            minDate={customFrom || undefined}
            placeholder="End date"
          />
          {!customFrom && !customTo ? (
            <p className="m-0 text-xs text-muted sm:col-span-2">
              Pick a from and/or to date to filter incidents.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="relative flex w-full flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 w-full flex-1">
          <span className="sr-only">Search incidents</span>
          <input
            type="search"
            placeholder="Search ID, person, violation…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-xl border border-line bg-elevated px-3 py-2.5 text-sm outline-none placeholder:text-dim transition-shadow focus:border-accent focus:bg-panel focus:ring-2 focus:ring-accent/20"
            style={{ color: "var(--theme-ink)" }}
          />
        </label>
        <div className="flex gap-2">
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-xl border border-line px-3 py-2.5 text-sm font-semibold text-muted transition-colors hover:border-line-strong hover:bg-elevated sm:flex-none"
            >
              Clear
            </button>
          ) : null}
          {action}
        </div>
      </div>
    </div>
  );
}
