import DatePicker from "react-datepicker";
import { format, parse } from "date-fns";
import "react-datepicker/dist/react-datepicker.css";

function toDate(value) {
  if (!value) return null;
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toValue(date) {
  if (!date) return "";
  return format(date, "yyyy-MM-dd");
}

export function DatePickerField({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = "Select date",
}) {
  const selected = toDate(value);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted">
        {label}
      </span>
      <div className="ppe-datepicker">
        <span className="ppe-datepicker-icon" aria-hidden="true">
          <CalendarIcon />
        </span>
        <DatePicker
          selected={selected}
          onChange={(date) => onChange(toValue(date))}
          minDate={toDate(minDate) || undefined}
          maxDate={toDate(maxDate) || undefined}
          dateFormat="dd MMM yyyy"
          placeholderText={placeholder}
          isClearable
          showPopperArrow={false}
          calendarStartDay={1}
          popperPlacement="bottom-start"
          popperClassName="ppe-datepicker-popper"
          className="ppe-datepicker-input"
          calendarClassName="ppe-datepicker-calendar"
          wrapperClassName="ppe-datepicker-wrapper"
        />
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" strokeLinecap="round" />
    </svg>
  );
}
