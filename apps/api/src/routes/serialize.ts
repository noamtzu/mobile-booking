import type { Booking, Service, Slot } from '@booking/shared';
import type { bookings, services, slots } from '../db/schema';

type ServiceRow = typeof services.$inferSelect;
type SlotRow = typeof slots.$inferSelect;
type BookingRow = typeof bookings.$inferSelect;

export const toService = (s: ServiceRow): Service => ({
  id: s.id,
  name: s.name,
  description: s.description,
  durationMinutes: s.durationMinutes,
  priceCents: s.priceCents,
  active: s.active,
});

export const toSlot = (s: SlotRow, available: boolean): Slot => ({
  id: s.id,
  serviceId: s.serviceId,
  startsAt: s.startsAt.toISOString(),
  endsAt: s.endsAt.toISOString(),
  available,
});

export const toBooking = (b: BookingRow, slot: SlotRow, service: ServiceRow): Booking => ({
  id: b.id,
  status: b.status,
  createdAt: b.createdAt.toISOString(),
  slot: { id: slot.id, serviceId: slot.serviceId, startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString() },
  service: { id: service.id, name: service.name, durationMinutes: service.durationMinutes, priceCents: service.priceCents },
});
