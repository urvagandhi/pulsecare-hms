export const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type DayOfWeek = (typeof DAY_NAMES)[number];

/**
 * Normalizes any date string (YYYY-MM-DD or ISO) or Date object to a UTC midnight Date.
 */
export function parseUtcMidnight(dateInput: string | Date): Date {
  if (dateInput instanceof Date) {
    const d = new Date(dateInput);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  const str = dateInput.includes('T') ? dateInput.split('T')[0] : dateInput;
  return new Date(`${str}T00:00:00.000Z`);
}

/**
 * Returns the lowercase day of the week ('sunday' ... 'saturday') in UTC.
 * Consistent across all server and client timezones.
 */
export function getUtcDayOfWeek(dateInput: string | Date): DayOfWeek {
  const d = parseUtcMidnight(dateInput);
  return DAY_NAMES[d.getUTCDay()];
}
