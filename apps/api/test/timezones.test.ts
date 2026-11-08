import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { slotsResponseSchema } from '@booking/shared';
import { ADMIN_EMAIL, type TestApp, setupTestApp } from './helpers';

let t: TestApp;
let admin: string;
let serviceId: string;

beforeAll(async () => {
  t = await setupTestApp();
  admin = await t.signIn(ADMIN_EMAIL);
  const res = await t.call('POST', '/admin/services', {
    token: admin,
    body: { name: 'Coaching session', durationMinutes: 60, priceCents: 9000 },
  });
  serviceId = res.body.service.id;
});
afterAll(async () => {
  await t.close();
});

function rowsOf<T>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : ((result as { rows: T[] }).rows ?? []);
}

describe('availability in local time, stored as UTC', () => {
  it('converts the admin wall-clock time with their zone', async () => {
    const res = await t.call('POST', '/admin/availability', {
      token: admin,
      body: { serviceId, date: '2026-11-10', times: ['09:00'], timeZone: 'America/New_York' },
    });
    expect(res.status).toBe(201);
    // 09:00 EST is 14:00 UTC; the end comes from the service duration.
    expect(res.body.slots[0]).toMatchObject({ startsAt: '2026-11-10T14:00:00.000Z', endsAt: '2026-11-10T15:00:00.000Z' });

    // The database holds the same instant, independent of any session time zone.
    const rows = rowsOf<{ utc: string }>(
      await t.db.execute(sql`SELECT to_char(starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI') AS utc FROM slots WHERE id = ${res.body.slots[0].id}`),
    );
    expect(rows[0]?.utc).toBe('2026-11-10T14:00');
  });

  it('keeps "9 AM" at 9 AM local across a DST change', async () => {
    // London moves to BST on 2027-03-28. 09:00 local is 09:00Z before and 08:00Z after.
    const res = await t.call('POST', '/admin/availability', {
      token: admin,
      body: { serviceId, date: '2027-03-26', times: ['09:00'], timeZone: 'Europe/London' },
    });
    const after = await t.call('POST', '/admin/availability', {
      token: admin,
      body: { serviceId, date: '2027-03-29', times: ['09:00'], timeZone: 'Europe/London' },
    });
    expect(res.body.slots[0].startsAt).toBe('2027-03-26T09:00:00.000Z');
    expect(after.body.slots[0].startsAt).toBe('2027-03-29T08:00:00.000Z');
  });

  it('rejects a local time that does not exist (spring-forward gap)', async () => {
    const res = await t.call('POST', '/admin/availability', {
      token: admin,
      body: { serviceId, date: '2027-03-14', times: ['02:30'], timeZone: 'America/New_York' },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NONEXISTENT_LOCAL_TIME');
  });

  it('refuses overlapping slots with a database exclusion constraint', async () => {
    const first = await t.call('POST', '/admin/availability', {
      token: admin,
      body: { serviceId, date: '2026-11-12', times: ['10:00'], timeZone: 'UTC' },
    });
    expect(first.status).toBe(201);
    // 10:30 in Paris (UTC+1) is 09:30Z; 09:30-10:30Z overlaps the 10:00-11:00Z slot.
    const clash = await t.call('POST', '/admin/availability', {
      token: admin,
      body: { serviceId, date: '2026-11-12', times: ['10:30'], timeZone: 'Europe/Paris' },
    });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('SLOT_OVERLAP');
  });

  it('allows back-to-back slots (end is exclusive)', async () => {
    const res = await t.call('POST', '/admin/availability', {
      token: admin,
      body: { serviceId, date: '2026-11-13', times: ['10:00', '11:00'], timeZone: 'UTC' },
    });
    expect(res.status).toBe(201);
    expect(res.body.slots).toHaveLength(2);
  });

  it('filters slots by a UTC window', async () => {
    const res = await t.call('GET', `/services/${serviceId}/slots?from=2026-11-12T00:00:00.000Z&to=2026-11-13T00:00:00.000Z`);
    const { slots } = slotsResponseSchema.parse(res.body);
    expect(slots.map((s) => s.startsAt)).toEqual(['2026-11-12T10:00:00.000Z']);
  });

  it('never returns slots that already started', async () => {
    const res = await t.call('GET', `/services/${serviceId}/slots?from=2020-01-01T00:00:00.000Z`);
    const { slots } = slotsResponseSchema.parse(res.body);
    expect(slots.every((s) => Date.parse(s.startsAt) > t.clock.now().getTime())).toBe(true);
  });
});
