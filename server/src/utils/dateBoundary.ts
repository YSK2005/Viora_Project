/**
 * Shared Date Boundary & Business Timezone Utility
 * 
 * Canonical Timezone: Asia/Kolkata (IST, UTC+05:30 = +330 minutes)
 * Provides consistent date boundary calculations for start-of-day (00:00:00.000)
 * and end-of-day (23:59:59.999) across dashboards, invoices, payments, and reports.
 */

export const IST_OFFSET_MINUTES = 330; // +5 hours 30 minutes

/**
 * Converts a YYYY-MM-DD date string to a UTC Date object representing
 * either the very beginning (00:00:00.000) or very end (23:59:59.999) of that day
 * in the business's local timezone (Asia/Kolkata by default).
 */
export function toTimezoneBoundary(
  dateStr: string,
  isEnd: boolean = false,
  offsetMinutes: number = IST_OFFSET_MINUTES
): Date {
  const parts = dateStr.trim().split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);

  if (isEnd) {
    // 23:59:59.999 local -> UTC
    const localMillis = Date.UTC(y, m, d, 23, 59, 59, 999);
    return new Date(localMillis - offsetMinutes * 60 * 1000);
  } else {
    // 00:00:00.000 local -> UTC
    const localMillis = Date.UTC(y, m, d, 0, 0, 0, 0);
    return new Date(localMillis - offsetMinutes * 60 * 1000);
  }
}

/**
 * Formats a Date object as a local calendar date string (YYYY-MM-DD)
 * in the specified business timezone.
 */
export function formatDateInTimezone(
  date: Date,
  offsetMinutes: number = IST_OFFSET_MINUTES
): string {
  const localTime = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  const y = localTime.getUTCFullYear();
  const m = String(localTime.getUTCMonth() + 1).padStart(2, '0');
  const d = String(localTime.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns exact start and end Date boundaries for a month or year transition
 */
export function getMonthBoundaries(
  year: number,
  month: number, // 1 to 12
  offsetMinutes: number = IST_OFFSET_MINUTES
): { startDate: Date; endDate: Date } {
  const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  return {
    startDate: toTimezoneBoundary(startStr, false, offsetMinutes),
    endDate: toTimezoneBoundary(endStr, true, offsetMinutes),
  };
}
