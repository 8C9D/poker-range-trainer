import { formatDateLine, formatDayDistance, greetingFor, safeRangeFileName } from '../lib/format';

describe('formatDayDistance', () => {
  const now = '2026-07-11T12:00:00.000Z';

  // Local-time constructors keep these assertions true in any time zone. The
  // distance is counted in LOCAL calendar days, so UTC literals describe a
  // different pair of days once the zone is far enough from UTC.
  const localIso = (year: number, month: number, day: number, hour: number, minute: number) =>
    new Date(year, month, day, hour, minute).toISOString();

  it('returns today for same-day and future timestamps', () => {
    const noon = localIso(2026, 6, 11, 12, 0);
    expect(formatDayDistance(localIso(2026, 6, 11, 9, 0), noon)).toBe('today');
    expect(formatDayDistance(localIso(2026, 6, 12, 9, 0), noon)).toBe('today');
  });

  it('returns yesterday and Nd ago for past days', () => {
    const noon = localIso(2026, 6, 11, 12, 0);
    expect(formatDayDistance(localIso(2026, 6, 10, 9, 0), noon)).toBe('yesterday');
    expect(formatDayDistance(localIso(2026, 6, 5, 9, 0), noon)).toBe('6d ago');
  });

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

describe('safeRangeFileName', () => {
  it('collapses punctuation and spaces into single hyphens', () => {
    expect(safeRangeFileName('UTG open — 100bb (v2)')).toBe('UTG-open-100bb-v2');
  });

  it('falls back to "range" when nothing usable remains', () => {
    expect(safeRangeFileName('   ')).toBe('range');
    expect(safeRangeFileName('***')).toBe('range');
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
