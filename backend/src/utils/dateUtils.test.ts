import { parseUtcMidnight, getUtcDayOfWeek } from './dateUtils';

describe('Timezone-Safe Date Utilities (Task 1.4)', () => {
  it('normalizes YYYY-MM-DD string to UTC midnight', () => {
    const d = parseUtcMidnight('2026-10-08');
    expect(d.toISOString()).toBe('2026-10-08T00:00:00.000Z');
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
  });

  it('normalizes ISO string with time to UTC midnight of that date', () => {
    const d = parseUtcMidnight('2026-10-08T18:30:00.000Z');
    expect(d.toISOString()).toBe('2026-10-08T00:00:00.000Z');
  });

  it('evaluates day-of-week correctly in UTC for all 7 days', () => {
    // 2026-10-04 is Sunday, 2026-10-10 is Saturday
    expect(getUtcDayOfWeek('2026-10-04')).toBe('sunday');
    expect(getUtcDayOfWeek('2026-10-05')).toBe('monday');
    expect(getUtcDayOfWeek('2026-10-06')).toBe('tuesday');
    expect(getUtcDayOfWeek('2026-10-07')).toBe('wednesday');
    expect(getUtcDayOfWeek('2026-10-08')).toBe('thursday');
    expect(getUtcDayOfWeek('2026-10-09')).toBe('friday');
    expect(getUtcDayOfWeek('2026-10-10')).toBe('saturday');
  });

  it('maintains consistent UTC day evaluation across day boundaries', () => {
    // Exactly at midnight boundary
    expect(getUtcDayOfWeek('2026-10-08T00:00:00.000Z')).toBe('thursday');
    // Later in the UTC day
    expect(getUtcDayOfWeek('2026-10-08T23:59:59.999Z')).toBe('thursday');
  });

  it('matches doctor availability correctly for specific weekdays without timezone shift', () => {
    const doctorAvailability = [
      { day: 'monday', startTime: '09:00', endTime: '13:00' },
      { day: 'wednesday', startTime: '14:00', endTime: '18:00' },
      { day: 'friday', startTime: '09:00', endTime: '17:00' },
    ];

    const checkDoctorAvailable = (dateStr: string) => {
      const day = getUtcDayOfWeek(dateStr);
      return doctorAvailability.some(a => a.day === day);
    };

    // Monday (2026-10-05) -> Available
    expect(checkDoctorAvailable('2026-10-05')).toBe(true);
    // Tuesday (2026-10-06) -> Not Available
    expect(checkDoctorAvailable('2026-10-06')).toBe(false);
    // Wednesday (2026-10-07) -> Available
    expect(checkDoctorAvailable('2026-10-07')).toBe(true);
    // Thursday (2026-10-08) -> Not Available
    expect(checkDoctorAvailable('2026-10-08')).toBe(false);
    // Friday (2026-10-09) -> Available
    expect(checkDoctorAvailable('2026-10-09')).toBe(true);
  });
});
