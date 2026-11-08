import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_EMAIL, TEST_NOW, type TestApp, setupTestApp } from './helpers';

let t: TestApp;
beforeAll(async () => {
  t = await setupTestApp();
});
afterAll(async () => {
  await t.close();
});

describe('email-code sign-in', () => {
  it('signs a new customer in and returns a JWT', async () => {
    expect((await t.call('POST', '/auth/request-code', { body: { email: 'Pat@Example.com' } })).status).toBe(204);
    const code = t.mailer.lastCode('pat@example.com');
    expect(code).toMatch(/^\d{6}$/);

    const res = await t.call('POST', '/auth/verify', { body: { email: 'pat@example.com', code } });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'pat@example.com', role: 'customer' });

    const me = await t.call('GET', '/auth/me', { token: res.body.token });
    expect(me.body.user.email).toBe('pat@example.com');
  });

  it('gives the admin role to configured emails', async () => {
    const token = await t.signIn(ADMIN_EMAIL);
    const me = await t.call('GET', '/auth/me', { token });
    expect(me.body.user.role).toBe('admin');
  });

  it('rejects a wrong code and locks the code after 5 attempts', async () => {
    const email = 'lock@example.com';
    await t.call('POST', '/auth/request-code', { body: { email } });
    const code = t.mailer.lastCode(email)!;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const res = await t.call('POST', '/auth/verify', { body: { email, code: wrong } });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CODE');
    }
    // Even the right code is refused now.
    expect((await t.call('POST', '/auth/verify', { body: { email, code } })).status).toBe(401);
  });

  it('accepts a code only once', async () => {
    const email = 'once@example.com';
    await t.call('POST', '/auth/request-code', { body: { email } });
    const code = t.mailer.lastCode(email);
    expect((await t.call('POST', '/auth/verify', { body: { email, code } })).status).toBe(200);
    expect((await t.call('POST', '/auth/verify', { body: { email, code } })).status).toBe(401);
  });

  it('expires codes after 10 minutes', async () => {
    const email = 'late@example.com';
    await t.call('POST', '/auth/request-code', { body: { email } });
    const code = t.mailer.lastCode(email);
    t.clock.set(new Date(TEST_NOW.getTime() + 11 * 60_000));
    try {
      expect((await t.call('POST', '/auth/verify', { body: { email, code } })).status).toBe(401);
    } finally {
      t.clock.set(TEST_NOW);
    }
  });

  it('invalidates an older code when a new one is requested', async () => {
    const email = 'twice@example.com';
    await t.call('POST', '/auth/request-code', { body: { email } });
    const first = t.mailer.lastCode(email);
    await t.call('POST', '/auth/request-code', { body: { email } });
    const second = t.mailer.lastCode(email);
    if (first !== second) {
      expect((await t.call('POST', '/auth/verify', { body: { email, code: first } })).status).toBe(401);
    }
    expect((await t.call('POST', '/auth/verify', { body: { email, code: second } })).status).toBe(200);
  });

  it('validates input with the shared schemas', async () => {
    const res = await t.call('POST', '/auth/request-code', { body: { email: 'not-an-email' } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('route protection', () => {
  it('requires a token for bookings', async () => {
    const res = await t.call('GET', '/bookings');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a tampered token', async () => {
    const token = await t.signIn('tamper@example.com');
    const [h, p, s] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p!, 'base64url').toString()), role: 'admin' })).toString('base64url');
    expect((await t.call('GET', '/admin/services', { token: `${h}.${forged}.${s}` })).status).toBe(401);
  });

  it('keeps customers out of admin routes', async () => {
    const token = await t.signIn('customer@example.com');
    const res = await t.call('GET', '/admin/services', { token });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
