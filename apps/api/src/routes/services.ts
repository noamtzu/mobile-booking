import { idSchema, slotsQuerySchema } from '@booking/shared';
import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { Hono } from 'hono';
import { bookings, services, slots } from '../db/schema';
import { notFound, parseOr400 } from '../errors';
import type { AppEnv, Deps } from '../types';
import { toService, toSlot } from './serialize';

const DEFAULT_WINDOW_MS = 30 * 24 * 60 * 60_000;

export function serviceRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();

  r.get('/', async (c) => {
    const rows = await deps.db.select().from(services).where(eq(services.active, true)).orderBy(asc(services.name));
    return c.json({ services: rows.map(toService) });
  });

  r.get('/:id', async (c) => {
    const id = parseOr400(idSchema, c.req.param('id'));
    const [row] = await deps.db.select().from(services).where(eq(services.id, id));
    if (!row) throw notFound('Service');
    return c.json({ service: toService(row) });
  });

  // Upcoming slots for a service, each flagged available or taken.
  r.get('/:id/slots', async (c) => {
    const id = parseOr400(idSchema, c.req.param('id'));
    const query = parseOr400(slotsQuerySchema, c.req.query());
    const now = deps.now();
    const from = query.from ? new Date(Math.max(Date.parse(query.from), now.getTime())) : now;
    const to = query.to ? new Date(query.to) : new Date(from.getTime() + DEFAULT_WINDOW_MS);

    const rows = await deps.db
      .select({ slot: slots, bookingId: bookings.id })
      .from(slots)
      .leftJoin(bookings, and(eq(bookings.slotId, slots.id), eq(bookings.status, 'confirmed')))
      .where(and(eq(slots.serviceId, id), gte(slots.startsAt, from), lt(slots.startsAt, to)))
      .orderBy(asc(slots.startsAt));

    return c.json({ slots: rows.map((row) => toSlot(row.slot, row.bookingId === null)) });
  });

  return r;
}
