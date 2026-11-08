import { localToUtc } from '@booking/shared';
import { loadConfig } from '../config';
import { createDb } from './client';
import { migrate } from './migrate';
import { services, slots } from './schema';

/** Demo data: three services and two weeks of weekday availability. */
const config = loadConfig();
const timeZone = process.env.SEED_TIME_ZONE ?? 'Europe/London';
const handle = createDb(config.databaseUrl);
await migrate(handle);
const { db } = handle;

const existing = await db.select({ id: services.id }).from(services).limit(1);
if (existing.length > 0) {
  console.log('Seed skipped: services already exist.');
  await handle.close();
  process.exit(0);
}

const [intro, session, group] = await db
  .insert(services)
  .values([
    { name: 'Intro call', description: 'A free 30-minute call to talk about your goals.', durationMinutes: 30, priceCents: 0 },
    { name: 'Coaching session', description: 'One-to-one session with a written plan afterwards.', durationMinutes: 60, priceCents: 9000 },
    { name: 'Small-group class', description: 'Up to six people, all levels welcome.', durationMinutes: 45, priceCents: 2500 },
  ])
  .returning();
if (!intro || !session || !group) throw new Error('seed: service insert failed');

// One provider, so the daily plan never overlaps.
const plan: [string, string][] = [
  ['09:00', intro.id],
  ['10:00', session.id],
  ['11:30', group.id],
  ['14:00', session.id],
  ['15:30', intro.id],
];
const durations = new Map([intro, session, group].map((s) => [s.id, s.durationMinutes]));

const rows: (typeof slots.$inferInsert)[] = [];
const today = new Date();
for (let offset = 1; offset <= 14; offset++) {
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset));
  const weekday = day.getUTCDay();
  if (weekday === 0 || weekday === 6) continue;
  const date = day.toISOString().slice(0, 10);
  for (const [time, serviceId] of plan) {
    const startsAt = localToUtc(date, time, timeZone);
    rows.push({ serviceId, startsAt, endsAt: new Date(startsAt.getTime() + (durations.get(serviceId) ?? 30) * 60_000) });
  }
}
await db.insert(slots).values(rows);
console.log(`Seeded 3 services and ${rows.length} slots (${timeZone}).`);
await handle.close();
