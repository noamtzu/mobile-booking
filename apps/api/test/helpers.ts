import { createApp } from '../src/app';
import { type DbHandle, createDb } from '../src/db/client';
import { migrate } from '../src/db/migrate';
import { services, slots } from '../src/db/schema';
import { memoryMailer } from '../src/mailer';

export const ADMIN_EMAIL = 'admin@example.com';
/** Tests run at a fixed "now": Monday 2 Nov 2026, 12:00 UTC. */
export const TEST_NOW = new Date('2026-11-02T12:00:00.000Z');

/**
 * Fresh database + app per test file.
 * TEST_DATABASE_URL=postgres://... runs against a real server (CI does this,
 * so the race test exercises real concurrent connections). Without it the
 * suite uses in-process PGlite.
 */
// PGlite takes a few seconds to boot (WASM), so one instance is shared by
// all files in the worker (vitest runs with isolate: false) and the schema is
// reset per file instead.
let sharedPglite: DbHandle | undefined;

async function freshDatabase(): Promise<{ handle: DbHandle; close: () => Promise<void> }> {
  const url = process.env.TEST_DATABASE_URL;
  let handle: DbHandle;
  let close: () => Promise<void>;
  if (url) {
    handle = createDb(url);
    close = () => handle.close();
  } else {
    sharedPglite ??= createDb('pglite://memory');
    handle = sharedPglite;
    close = async () => {};
  }
  await handle.exec('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  await migrate(handle);
  return { handle, close };
}

export async function setupTestApp() {
  const { handle, close } = await freshDatabase();

  const mailer = memoryMailer();
  let now = TEST_NOW;
  const clock = {
    now: () => now,
    set: (d: Date) => {
      now = d;
    },
  };

  const app = createApp({
    db: handle.db,
    mailer,
    jwtSecret: 'test-secret-that-is-definitely-long-enough-for-hs256',
    adminEmails: [ADMIN_EMAIL],
    now: clock.now,
  });

  async function call<T = any>(
    method: string,
    path: string,
    opts: { token?: string; body?: unknown } = {},
  ): Promise<{ status: number; body: T }> {
    const headers: Record<string, string> = {};
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await app.request(path, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
  }

  async function signIn(email: string): Promise<string> {
    const req = await call('POST', '/auth/request-code', { body: { email } });
    if (req.status !== 204) throw new Error(`request-code failed: ${req.status}`);
    const code = mailer.lastCode(email);
    const res = await call<{ token: string }>('POST', '/auth/verify', { body: { email, code } });
    if (res.status !== 200) throw new Error(`verify failed: ${res.status}`);
    return res.body.token;
  }

  /** Insert a service and one slot directly, starting `hoursFromNow` after the test clock. */
  async function seedSlot(hoursFromNow = 24, durationMinutes = 60) {
    const [service] = await handle.db
      .insert(services)
      .values({ name: `Service ${Math.random().toString(36).slice(2, 7)}`, durationMinutes, priceCents: 5000 })
      .returning();
    const startsAt = new Date(clock.now().getTime() + hoursFromNow * 3_600_000);
    const [slot] = await handle.db
      .insert(slots)
      .values({ serviceId: service!.id, startsAt, endsAt: new Date(startsAt.getTime() + durationMinutes * 60_000) })
      .returning();
    return { service: service!, slot: slot! };
  }

  return { app, handle, db: handle.db, mailer, clock, call, signIn, seedSlot, close };
}

export type TestApp = Awaited<ReturnType<typeof setupTestApp>>;
