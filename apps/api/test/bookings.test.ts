import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bookingResponseSchema, bookingsResponseSchema, slotsResponseSchema } from '@booking/shared';
import { PG_UNIQUE_VIOLATION, pgErrorCode } from '../src/db/client';
import { bookings } from '../src/db/schema';
import { TEST_NOW, type TestApp, setupTestApp } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await setupTestApp();
});
afterAll(async () => {
  await t.close();
});

describe('booking a slot', () => {
  it('books, then shows the slot as taken', async () => {
    const { service, slot } = await t.seedSlot();
    const token = await t.signIn('booker@example.com');

    const res = await t.call('POST', '/bookings', { token, body: { slotId: slot.id } });
    expect(res.status).toBe(201);
    const { booking } = bookingResponseSchema.parse(res.body);
    expect(booking).toMatchObject({ status: 'confirmed', service: { id: service.id } });

    const list = slotsResponseSchema.parse((await t.call('GET', `/services/${service.id}/slots`)).body);
    expect(list.slots.find((s) => s.id === slot.id)?.available).toBe(false);
  });

  it('returns 409 SLOT_TAKEN to the second customer', async () => {
    const { slot } = await t.seedSlot(48);
    const a = await t.signIn('first@example.com');
    const b = await t.signIn('second@example.com');
    expect((await t.call('POST', '/bookings', { token: a, body: { slotId: slot.id } })).status).toBe(201);
    const res = await t.call('POST', '/bookings', { token: b, body: { slotId: slot.id } });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_TAKEN');
  });

  it('lets exactly one of 20 simultaneous requests win the race', async () => {
    const { slot } = await t.seedSlot(72);
    const tokens = await Promise.all(Array.from({ length: 20 }, (_, i) => t.signIn(`racer${i}@example.com`)));

    const results = await Promise.all(tokens.map((token) => t.call('POST', '/bookings', { token, body: { slotId: slot.id } })));
    const statuses = results.map((r) => r.status).sort();

    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(19);

    const rows = await t.db.execute(sql`SELECT count(*)::int AS n FROM bookings WHERE slot_id = ${slot.id} AND status = 'confirmed'`);
    const n = Array.isArray(rows) ? rows[0].n : (rows as any).rows[0].n;
    expect(n).toBe(1);
  });

  it('is guaranteed by the database even if application checks are bypassed', async () => {
    const { slot } = await t.seedSlot(96);
    const token = await t.signIn('direct@example.com');
    const me = (await t.call('GET', '/auth/me', { token })).body.user;
    await t.db.insert(bookings).values({ slotId: slot.id, userId: me.id });

    let error: unknown;
    try {
      await t.db.insert(bookings).values({ slotId: slot.id, userId: me.id });
    } catch (err) {
      error = err;
    }
    expect(pgErrorCode(error)).toBe(PG_UNIQUE_VIOLATION);
  });

  it('refuses slots that have already started', async () => {
    const { slot } = await t.seedSlot(1);
    const token = await t.signIn('late-booker@example.com');
    t.clock.set(new Date(TEST_NOW.getTime() + 2 * 3_600_000));
    try {
      const res = await t.call('POST', '/bookings', { token, body: { slotId: slot.id } });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('SLOT_IN_PAST');
    } finally {
      t.clock.set(TEST_NOW);
    }
  });

  it('returns 404 for an unknown slot and 400 for a malformed id', async () => {
    const token = await t.signIn('typo@example.com');
    expect((await t.call('POST', '/bookings', { token, body: { slotId: '00000000-0000-4000-8000-000000000000' } })).status).toBe(404);
    expect((await t.call('POST', '/bookings', { token, body: { slotId: 'abc' } })).status).toBe(400);
  });
});

describe('cancelling', () => {
  it('frees the slot so someone else can book it', async () => {
    const { slot } = await t.seedSlot(120);
    const a = await t.signIn('canceller@example.com');
    const b = await t.signIn('next-in-line@example.com');

    const booked = await t.call('POST', '/bookings', { token: a, body: { slotId: slot.id } });
    const cancelled = await t.call('POST', `/bookings/${booked.body.booking.id}/cancel`, { token: a });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.booking.status).toBe('cancelled');

    expect((await t.call('POST', '/bookings', { token: b, body: { slotId: slot.id } })).status).toBe(201);
  });

  it("does not let a customer see or cancel someone else's booking", async () => {
    const { slot } = await t.seedSlot(144);
    const owner = await t.signIn('owner@example.com');
    const other = await t.signIn('nosy@example.com');
    const booked = await t.call('POST', '/bookings', { token: owner, body: { slotId: slot.id } });
    const id = booked.body.booking.id;

    expect((await t.call('GET', `/bookings/${id}`, { token: other })).status).toBe(404);
    expect((await t.call('POST', `/bookings/${id}/cancel`, { token: other })).status).toBe(404);
  });
});

describe('my bookings', () => {
  it('lists only my bookings, soonest first', async () => {
    const later = await t.seedSlot(200);
    const sooner = await t.seedSlot(170);
    const token = await t.signIn('lister@example.com');
    await t.call('POST', '/bookings', { token, body: { slotId: later.slot.id } });
    await t.call('POST', '/bookings', { token, body: { slotId: sooner.slot.id } });

    const { bookings: mine } = bookingsResponseSchema.parse((await t.call('GET', '/bookings', { token })).body);
    expect(mine.map((b) => b.slot.id)).toEqual([sooner.slot.id, later.slot.id]);
  });
});
