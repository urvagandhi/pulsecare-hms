import { describe, it, expect } from 'vitest';
import { fmt, parseDateSafe, formatDate, formatDateShort, formatDateTime, formatPeriodLabel, formatDateForInput } from '../lib/format';

describe('Frontend Format Utilities', () => {
  it('formats currency with rupee symbol', () => {
    expect(fmt(500)).toBe('₹500.00');
    expect(fmt(1234.5)).toBe('₹1234.50');
    expect(fmt(0)).toBe('₹0.00');
  });

  it('safely parses ISO and date-only strings without timezone shifts', () => {
    const d = parseDateSafe('2026-10-20');
    expect(d).not.toBeNull();
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(9); // 0-indexed October
    expect(d?.getDate()).toBe(20);

    expect(parseDateSafe(null)).toBeNull();
    expect(parseDateSafe(undefined)).toBeNull();
    expect(parseDateSafe('')).toBeNull();
    expect(parseDateSafe('invalid-date')).toBeNull();
  });

  it('formats date to standard clinic display format', () => {
    const formatted = formatDate('2026-10-20');
    expect(formatted).toBe('20 Oct 2026');

    const formattedLong = formatDate('2026-10-20', { fullMonth: true });
    expect(formattedLong).toBe('20 October 2026');

    const withDay = formatDate('2026-10-20', { withDayOfWeek: true });
    expect(withDay).toContain('2026');
  });

  it('formats short date properly', () => {
    expect(formatDateShort('2026-10-20')).toBe('20 Oct');
    expect(formatDateShort(null)).toBe('—');
  });

  it('formats date and time properly', () => {
    const dt = formatDateTime(new Date(2026, 9, 20, 14, 30));
    expect(dt).toContain('2026');
    expect(dt).toMatch(/PM|AM/);
    expect(formatDateTime(null)).toBe('—');
  });

  it('formats analytics period labels', () => {
    expect(formatPeriodLabel('2026-10')).toBe('Oct 2026');
    expect(formatPeriodLabel('2026-10-20')).toBe('20 Oct 2026');
    expect(formatPeriodLabel('2026-4')).toBe('Wk 4, 2026');
    expect(formatPeriodLabel('custom-label')).toBe('custom-label');
    expect(formatPeriodLabel('')).toBe('—');
  });

  it('formats dates for HTML5 input fields', () => {
    expect(formatDateForInput('2026-10-20')).toBe('2026-10-20');
    expect(formatDateForInput(null)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
