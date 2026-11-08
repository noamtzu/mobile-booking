import { describe, expect, it } from 'vitest';
import {
  NonexistentLocalTimeError,
  formatLocalTime,
  localDayKey,
  localToUtc,
  zoneOffsetMinutes,
} from '../src/time';

describe('localToUtc', () => {
  it('converts a normal winter time in New York (UTC-5)', () => {
    expect(localToUtc('2026-01-15', '09:00', 'America/New_York').toISOString()).toBe(
      '2026-01-15T14:00:00.000Z',
    );
  });

  it('converts a summer time in New York (UTC-4)', () => {
    expect(localToUtc('2026-07-15', '09:00', 'America/New_York').toISOString()).toBe(
      '2026-07-15T13:00:00.000Z',
    );
  });

  it('handles zones east of UTC across the date line', () => {
    // 08:00 in Tokyo is 23:00 UTC the previous day.
    expect(localToUtc('2026-03-10', '08:00', 'Asia/Tokyo').toISOString()).toBe(
      '2026-03-09T23:00:00.000Z',
    );
  });

  it('handles half-hour offsets', () => {
    expect(localToUtc('2026-06-01', '10:00', 'Asia/Kolkata').toISOString()).toBe(
      '2026-06-01T04:30:00.000Z',
    );
  });

  it('rejects a time inside the spring-forward gap', () => {
    // New York skips 02:00-02:59 on 2026-03-08.
    expect(() => localToUtc('2026-03-08', '02:30', 'America/New_York')).toThrow(
      NonexistentLocalTimeError,
    );
    // London skips 01:00-01:59 on 2026-03-29.
    expect(() => localToUtc('2026-03-29', '01:30', 'Europe/London')).toThrow(
      NonexistentLocalTimeError,
    );
  });

  it('resolves the repeated fall-back hour to the earlier instant (west of UTC)', () => {
    // 01:30 happens twice in New York on 2026-11-01: EDT (05:30Z) then EST (06:30Z).
    expect(localToUtc('2026-11-01', '01:30', 'America/New_York').toISOString()).toBe(
      '2026-11-01T05:30:00.000Z',
    );
  });

  it('resolves the repeated fall-back hour to the earlier instant (east of UTC)', () => {
    // 02:30 happens twice in Berlin on 2026-10-25: CEST (00:30Z) then CET (01:30Z).
    expect(localToUtc('2026-10-25', '02:30', 'Europe/Berlin').toISOString()).toBe(
      '2026-10-25T00:30:00.000Z',
    );
  });

  it('keeps the same wall time on both sides of a DST change', () => {
    const before = localToUtc('2026-03-07', '09:00', 'America/New_York');
    const after = localToUtc('2026-03-09', '09:00', 'America/New_York');
    // Two calendar days apart, but only 47 hours elapsed.
    expect((after.getTime() - before.getTime()) / 3_600_000).toBe(47);
  });
});

describe('zoneOffsetMinutes', () => {
  it('reports standard and daylight offsets', () => {
    expect(zoneOffsetMinutes(new Date('2026-01-01T12:00:00Z'), 'Europe/London')).toBe(0);
    expect(zoneOffsetMinutes(new Date('2026-07-01T12:00:00Z'), 'Europe/London')).toBe(60);
    expect(zoneOffsetMinutes(new Date('2026-01-01T12:00:00Z'), 'America/Los_Angeles')).toBe(-480);
  });
});

describe('display helpers', () => {
  it('groups one UTC instant into different local days by zone', () => {
    const iso = '2026-11-09T23:30:00.000Z';
    expect(localDayKey(iso, 'America/New_York')).toBe('2026-11-09');
    expect(localDayKey(iso, 'Asia/Tokyo')).toBe('2026-11-10');
  });

  it('formats the same instant as local time per zone', () => {
    const iso = '2026-11-09T14:00:00.000Z';
    expect(formatLocalTime(iso, 'America/New_York', 'en-US')).toBe('9:00 AM');
    expect(formatLocalTime(iso, 'Europe/London', 'en-GB')).toBe('14:00');
  });
});
