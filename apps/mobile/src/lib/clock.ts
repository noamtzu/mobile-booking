import { deviceTimeZone } from '@booking/shared';
import { useEffect, useState } from 'react';

/** The device's IANA zone, read once per mount. */
export function useTimeZone(): string {
  const [zone] = useState(deviceTimeZone);
  return zone;
}

/** Current time in ms, refreshed every minute so "upcoming" lists stay correct. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
