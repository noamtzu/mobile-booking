/**
 * Time-zone helpers with no dependencies beyond Intl.
 *
 * Rule for the whole system: the database and the wire carry UTC instants.
 * Conversion to and from local wall-clock time happens at the edges, with an
 * explicit IANA zone, using the functions below.
 */

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    partsFormatters.set(timeZone, f);
  }
  return f;
}

/** Wall-clock reading of a UTC instant in a zone. */
export function wallClockAt(instant: Date, timeZone: string): WallClock {
  const parts: Record<string, number> = {};
  for (const p of partsFormatter(timeZone).formatToParts(instant)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    hour: (parts.hour ?? 0) % 24,
    minute: parts.minute ?? 0,
  };
}

/** Offset of `timeZone` from UTC at `instant`, in minutes (e.g. -300 for New York in winter). */
export function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const w = wallClockAt(instant, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  const truncated = Math.floor(instant.getTime() / 60_000) * 60_000;
  return Math.round((asUtc - truncated) / 60_000);
}

export class NonexistentLocalTimeError extends RangeError {
  constructor(date: string, time: string, timeZone: string) {
    super(`${date} ${time} does not exist in ${timeZone} (daylight-saving gap)`);
    this.name = 'NonexistentLocalTimeError';
  }
}

/**
 * Convert a local date + wall-clock time in `timeZone` to a UTC Date.
 *
 * - Ambiguous times (the repeated hour when clocks go back) resolve to the
 *   earlier instant, consistently for zones east and west of UTC.
 * - Times that never happen (the skipped hour when clocks go forward) throw
 *   NonexistentLocalTimeError instead of silently shifting.
 */
export function localToUtc(date: string, time: string, timeZone: string): Date {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const [h, mi] = time.split(':').map(Number) as [number, number];
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const day = 24 * 60 * 60_000;

  // The offset that applies is one of the offsets in force around that day.
  const offsets = new Set([
    zoneOffsetMinutes(new Date(naive - day), timeZone),
    zoneOffsetMinutes(new Date(naive), timeZone),
    zoneOffsetMinutes(new Date(naive + day), timeZone),
  ]);

  const matches: number[] = [];
  for (const off of offsets) {
    const candidate = naive - off * 60_000;
    const w = wallClockAt(new Date(candidate), timeZone);
    if (w.year === y && w.month === mo && w.day === d && w.hour === h && w.minute === mi) {
      matches.push(candidate);
    }
  }
  if (matches.length === 0) throw new NonexistentLocalTimeError(date, time, timeZone);
  return new Date(Math.min(...matches));
}

/** Local calendar day (YYYY-MM-DD) of a UTC instant in a zone. Used to group slots by day. */
export function localDayKey(isoUtc: string, timeZone: string): string {
  const w = wallClockAt(new Date(isoUtc), timeZone);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

/** "9:30 AM" (or "09:30" in 24h locales) in the given zone. */
export function formatLocalTime(isoUtc: string, timeZone: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone, hour: 'numeric', minute: '2-digit' }).format(
    new Date(isoUtc),
  );
}

/** "Mon, Nov 9" in the given zone. */
export function formatLocalDate(isoUtc: string, timeZone: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(isoUtc));
}

/** The device's zone, falling back to UTC when Intl cannot tell. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
