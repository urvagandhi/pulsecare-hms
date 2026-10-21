export const fmt = (n: number): string => `₹${n.toFixed(2)}`;

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTH_NAMES_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Safely parses an ISO date string, date-only string, or Date object without
 * timezone-shift issues for calendar-only dates (e.g. 2026-10-05T00:00:00.000Z).
 */
export function parseDateSafe(input?: string | Date | null): Date | null {
  if (!input) return null;
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  if (typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // Handles 'YYYY-MM-DD' and 'YYYY-MM-DDT00:00:00...' without timezone day-shift
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z?)?$/.exec(trimmed);
  if (dateOnlyMatch) {
    const year = parseInt(dateOnlyMatch[1], 10);
    const monthIndex = parseInt(dateOnlyMatch[2], 10) - 1;
    const day = parseInt(dateOnlyMatch[3], 10);
    return new Date(year, monthIndex, day, 12, 0, 0);
  }

  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formats a date into a clean, human-readable format: e.g. "05 Oct 2026"
 */
export function formatDate(
  input?: string | Date | null,
  options?: { withDayOfWeek?: boolean; fullMonth?: boolean }
): string {
  const d = parseDateSafe(input);
  if (!d) return '—';

  const day = String(d.getDate()).padStart(2, '0');
  const month = options?.fullMonth ? MONTH_NAMES_LONG[d.getMonth()] : MONTH_NAMES_SHORT[d.getMonth()];
  const year = d.getFullYear();

  if (options?.withDayOfWeek) {
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    return `${weekday}, ${day} ${month} ${year}`;
  }

  return `${day} ${month} ${year}`;
}

/**
 * Formats a short month/day: e.g. "05 Oct"
 */
export function formatDateShort(input?: string | Date | null): string {
  const d = parseDateSafe(input);
  if (!d) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_NAMES_SHORT[d.getMonth()];
  return `${day} ${month}`;
}

/**
 * Formats a date with time: e.g. "05 Oct 2026, 10:30 AM"
 */
export function formatDateTime(input?: string | Date | null): string {
  const d = parseDateSafe(input);
  if (!d) return '—';

  const datePart = formatDate(d);
  const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${datePart}, ${timePart}`;
}

/**
 * Formats a period string from analytics (e.g. "2026-10" -> "October 2026", "2026-10-05" -> "05 Oct 2026")
 */
export function formatPeriodLabel(periodStr?: string, options?: { fullMonth?: boolean }): string {
  if (!periodStr) return '—';
  // Year-Month: 2026-10
  if (/^\d{4}-\d{2}$/.test(periodStr)) {
    const [y, m] = periodStr.split('-');
    const mIdx = parseInt(m, 10) - 1;
    const month = options?.fullMonth ? MONTH_NAMES_LONG[mIdx] : MONTH_NAMES_SHORT[mIdx];
    return `${month ?? m} ${y}`;
  }
  // Full Date: 2026-10-05
  if (/^\d{4}-\d{2}-\d{2}/.test(periodStr)) {
    return formatDate(periodStr);
  }
  // Week format: 2026-41
  if (/^\d{4}-\d{1,2}$/.test(periodStr)) {
    const [y, w] = periodStr.split('-');
    return `Wk ${w}, ${y}`;
  }
  return periodStr;
}

/**
 * Safely converts a date to YYYY-MM-DD for HTML5 <input type="date" /> in local time.
 */
export function formatDateForInput(input?: string | Date | null): string {
  const d = parseDateSafe(input) ?? new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

