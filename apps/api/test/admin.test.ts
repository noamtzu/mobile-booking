import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_EMAIL, type TestApp, setupTestApp } from './helpers';

let t: TestApp;
let admin: string;
beforeAll(async () => {
  t = await setupTestApp();
  admin = await t.signIn(ADMIN_EMAIL);
});
afterAll(async () => {
  await t.close();
});

describe('admin: services', () => {
  it('creates a service and hides it from customers when deactivated', async () => {
    const created = await t.call('POST', '/admin/services', {
      token: admin,
      body: { name: 'Mobility class', description: 'Gentle, all levels.', durationMinutes: 45, priceCents: 2000 },
    });
    expect(created.status).toBe(201);
    const id = created.body.service.id;

    expect((await t.call('GET', '/services')).body.services.map((s: { id: string }) => s.id)).toContain(id);

    const patched = await t.call('PATCH', `/admin/services/${id}`, { token: admin, body: { active: false } });
    expect(patched.body.service.active).toBe(false);
    expect((await t.call('GET', '/services')).body.services.map((s: { id: string }) => s.id)).not.toContain(id);
    expect((await t.call('GET', '/admin/services', { token: admin })).body.services.map((s: { id: string }) => s.id)).toContain(id);
  });

  it('validates service input', async () => {
    const res = await t.call('POST', '/admin/services', { token: admin, body: { name: 'X', durationMinutes: 5, priceCents: -1 } });
    expect(res.status).toBe(400);
  });
});

describe('admin: slots', () => {
  it('deletes a free slot but not one with a booking', async () => {
    const free = await t.seedSlot(24);
    const booked = await t.seedSlot(30);
    const customer = await t.signIn('c@example.com');
    await t.call('POST', '/bookings', { token: customer, body: { slotId: booked.slot.id } });

    expect((await t.call('DELETE', `/admin/slots/${free.slot.id}`, { token: admin })).status).toBe(204);
    const res = await t.call('DELETE', `/admin/slots/${booked.slot.id}`, { token: admin });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_HAS_BOOKING');
  });

  it('rejects availability in the past', async () => {
    const { service } = await t.seedSlot(500);
    const res = await t.call('POST', '/admin/availability', {
      token: admin,
      body: { serviceId: service.id, date: '2026-11-01', times: ['09:00'], timeZone: 'UTC' },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('SLOT_IN_PAST');
  });
});
