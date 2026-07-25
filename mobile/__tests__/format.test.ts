import { formatDateLine, formatDayDistance, greetingFor } from '../lib/format';

describe('formatDayDistance', () => {
  const now = '2026-07-11T12:00:00.000Z';

  it('returns today for same-day and future timestamps', () => {
    expect(formatDayDistance('2026-07-11T09:00:00.000Z', now)).toBe('today');
    expect(formatDayDistance('2026-07-12T09:00:00.000Z', now)).toBe('today');
  });

  it('returns yesterday and Nd ago for past days', () => {
    expect(formatDayDistance('2026-07-10T09:00:00.000Z', now)).toBe('yesterday');
    expect(formatDayDistance('2026-07-05T09:00:00.000Z', now)).toBe('6d ago');
  });

  // Local-time constructors keep these assertions true in any time zone.
  const localIso = (year: number, month: number, day: number, hour: number, minute: number) =>
    new Date(year, month, day, hour, minute).toISOString();

  it('counts calendar days, so last night is yesterday even a few hours later', () => {
    expect(formatDayDistance(localIso(2026, 6, 10, 23, 0), localIso(2026, 6, 11, 8, 0))).toBe(
      'yesterday',
    );
  });

  it('counts calendar days for older timestamps too', () => {
    expect(formatDayDistance(localIso(2026, 6, 6, 23, 0), localIso(2026, 6, 11, 8, 0))).toBe(
      '5d ago',
    );
  });

  it('keeps a long same-day gap as today', () => {
    expect(formatDayDistance(localIso(2026, 6, 11, 0, 30), localIso(2026, 6, 11, 23, 0))).toBe(
      'today',
    );
  });

  it('returns empty string for missing or invalid input', () => {
    expect(formatDayDistance('', now)).toBe('');
    expect(formatDayDistance('not-a-date', now)).toBe('');
  });
});

describe('formatDateLine', () => {
  it('formats a weekday, month, and day', () => {
    // Constructed in local time so getDay()/getMonth() are timezone-stable.
    expect(formatDateLine(new Date(2026, 6, 11))).toMatch(
      /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), July 11$/,
    );
  });
});

describe('greetingFor', () => {
  it('picks the greeting from the local hour', () => {
    expect(greetingFor(new Date(2026, 6, 11, 9))).toBe('Good morning');
    expect(greetingFor(new Date(2026, 6, 11, 14))).toBe('Good afternoon');
    expect(greetingFor(new Date(2026, 6, 11, 20))).toBe('Good evening');
  });
});
