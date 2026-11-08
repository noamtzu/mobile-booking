import {
  NonexistentLocalTimeError,
  availabilityInputSchema,
  idSchema,
  localToUtc,
  serviceInputSchema,
  serviceUpdateSchema,
} from '@booking/shared';
import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { requireAdmin } from '../auth';
import { PG_EXCLUSION_VIOLATION, pgErrorCode } from '../db/client';
import { bookings, services, slots } from '../db/schema';
import { HttpError, notFound, parseOr400, readJson } from '../errors';
import type { AppEnv, Deps } from '../types';
import { toService, toSlot } from './serialize';

export function adminRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();
  r.use('*', requireAdmin);

  r.get('/services', async (c) => {
    const rows = await deps.db.select().from(services).orderBy(asc(services.name));
    return c.json({ services: rows.map(toService) });
  });

  r.post('/services', async (c) => {
    const input = await readJson(c, serviceInputSchema);
    const [row] = await deps.db.insert(services).values(input).returning();
    if (!row) throw new Error('service insert returned no row');
    return c.json({ service: toService(row) }, 201);
  });

  r.patch('/services/:id', async (c) => {
    const id = parseOr400(idSchema, c.req.param('id'));
    const input = await readJson(c, serviceUpdateSchema);
    const [row] = await deps.db.update(services).set(input).where(eq(services.id, id)).returning();
    if (!row) throw notFound('Service');
    return c.json({ service: toService(row) });
  });

  /**
   * Add availability from local wall-clock times. "09:00 on 2026-11-09 in
   * America/New_York" becomes a UTC instant here, once, using the zone the
   * admin works in, so slots stay correct across DST changes.
   */
  r.post('/availability', async (c) => {
    const input = await readJson(c, availabilityInputSchema);
    const [service] = await deps.db.select().from(services).where(eq(services.id, input.serviceId));
    if (!service) throw notFound('Service');

    const now = deps.now();
    const values = input.times.map((time) => {
      let startsAt: Date;
      try {
        startsAt = localToUtc(input.date, time, input.timeZone);
      } catch (err) {
        if (err instanceof NonexistentLocalTimeError) {
          throw new HttpError(422, 'NONEXISTENT_LOCAL_TIME', err.message);
        }
        throw err;
      }
      if (startsAt <= now) throw new HttpError(422, 'SLOT_IN_PAST', `${input.date} ${time} is in the past`);
      return {
        serviceId: service.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + service.durationMinutes * 60_000),
      };
    });

    try {
      const created = await deps.db.insert(slots).values(values).returning();
      return c.json({ slots: created.map((s) => toSlot(s, true)) }, 201);
    } catch (err) {
      if (pgErrorCode(err) === PG_EXCLUSION_VIOLATION) {
        throw new HttpError(409, 'SLOT_OVERLAP', 'One of those times overlaps an existing slot');
      }
      throw err;
    }
  });

  r.delete('/slots/:id', async (c) => {
    const id = parseOr400(idSchema, c.req.param('id'));
    const [hasBooking] = await deps.db.select({ id: bookings.id }).from(bookings).where(eq(bookings.slotId, id)).limit(1);
    if (hasBooking) throw new HttpError(409, 'SLOT_HAS_BOOKING', 'This slot has bookings and cannot be removed');
    const deleted = await deps.db.delete(slots).where(eq(slots.id, id)).returning({ id: slots.id });
    if (deleted.length === 0) throw notFound('Slot');
    return c.body(null, 204);
  });

  return r;
}
