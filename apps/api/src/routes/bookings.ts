import { createBookingSchema, idSchema } from '@booking/shared';
import { and, asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { PG_UNIQUE_VIOLATION, pgErrorCode } from '../db/client';
import { bookings, services, slots } from '../db/schema';
import { HttpError, notFound, parseOr400, readJson } from '../errors';
import type { AppEnv, Deps } from '../types';
import { toBooking } from './serialize';

const slotTaken = () => new HttpError(409, 'SLOT_TAKEN', 'Someone just booked this slot. Pick another time.');

export function bookingRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();

  async function loadBooking(id: string) {
    const [row] = await deps.db
      .select({ booking: bookings, slot: slots, service: services })
      .from(bookings)
      .innerJoin(slots, eq(slots.id, bookings.slotId))
      .innerJoin(services, eq(services.id, slots.serviceId))
      .where(eq(bookings.id, id));
    return row;
  }

  r.get('/', async (c) => {
    const user = c.get('user');
    const rows = await deps.db
      .select({ booking: bookings, slot: slots, service: services })
      .from(bookings)
      .innerJoin(slots, eq(slots.id, bookings.slotId))
      .innerJoin(services, eq(services.id, slots.serviceId))
      .where(eq(bookings.userId, user.id))
      .orderBy(asc(slots.startsAt));
    return c.json({ bookings: rows.map((x) => toBooking(x.booking, x.slot, x.service)) });
  });

  r.get('/:id', async (c) => {
    const user = c.get('user');
    const row = await loadBooking(parseOr400(idSchema, c.req.param('id')));
    if (!row || (row.booking.userId !== user.id && user.role !== 'admin')) throw notFound('Booking');
    return c.json({ booking: toBooking(row.booking, row.slot, row.service) });
  });

  /**
   * Book a slot. Two layers stop double booking:
   *  1. SELECT ... FOR UPDATE on the slot row serialises concurrent attempts,
   *     so the second request waits, then sees the first booking and gets 409.
   *  2. The partial unique index bookings_one_confirmed_per_slot is the hard
   *     guarantee: even code that skips step 1 cannot commit a second booking.
   */
  r.post('/', async (c) => {
    const user = c.get('user');
    const { slotId } = await readJson(c, createBookingSchema);
    const now = deps.now();

    let bookingId: string;
    try {
      bookingId = await deps.db.transaction(async (tx) => {
        const [slot] = await tx.select().from(slots).where(eq(slots.id, slotId)).for('update');
        if (!slot) throw notFound('Slot');
        if (slot.startsAt <= now) throw new HttpError(422, 'SLOT_IN_PAST', 'That time has already passed');

        const [service] = await tx.select().from(services).where(eq(services.id, slot.serviceId));
        if (!service?.active) throw notFound('Service');

        const [existing] = await tx
          .select({ id: bookings.id })
          .from(bookings)
          .where(and(eq(bookings.slotId, slotId), eq(bookings.status, 'confirmed')));
        if (existing) throw slotTaken();

        const [created] = await tx.insert(bookings).values({ slotId, userId: user.id }).returning({ id: bookings.id });
        if (!created) throw new Error('booking insert returned no row');
        return created.id;
      });
    } catch (err) {
      if (pgErrorCode(err) === PG_UNIQUE_VIOLATION) throw slotTaken();
      throw err;
    }

    const row = await loadBooking(bookingId);
    if (!row) throw notFound('Booking');
    return c.json({ booking: toBooking(row.booking, row.slot, row.service) }, 201);
  });

  r.post('/:id/cancel', async (c) => {
    const user = c.get('user');
    const id = parseOr400(idSchema, c.req.param('id'));
    const row = await loadBooking(id);
    if (!row || (row.booking.userId !== user.id && user.role !== 'admin')) throw notFound('Booking');
    if (row.slot.startsAt <= deps.now()) {
      throw new HttpError(422, 'SLOT_IN_PAST', 'Past bookings cannot be cancelled');
    }
    if (row.booking.status === 'confirmed') {
      await deps.db
        .update(bookings)
        .set({ status: 'cancelled', cancelledAt: deps.now() })
        .where(and(eq(bookings.id, id), eq(bookings.status, 'confirmed')));
    }
    const updated = await loadBooking(id);
    if (!updated) throw notFound('Booking');
    return c.json({ booking: toBooking(updated.booking, updated.slot, updated.service) });
  });

  return r;
}
