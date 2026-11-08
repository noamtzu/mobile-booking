import { type Slot, formatLocalDate, localDayKey } from '@booking/shared';

export interface SlotDay {
  key: string;
  label: string;
  slots: Slot[];
}

/** Group UTC slots into local calendar days for the given zone, keeping order. */
export function groupSlotsByDay(slots: Slot[], timeZone: string, locale?: string): SlotDay[] {
  const days = new Map<string, SlotDay>();
  for (const slot of slots) {
    const key = localDayKey(slot.startsAt, timeZone);
    let day = days.get(key);
    if (!day) {
      day = { key, label: formatLocalDate(slot.startsAt, timeZone, locale), slots: [] };
      days.set(key, day);
    }
    day.slots.push(slot);
  }
  return [...days.values()];
}
