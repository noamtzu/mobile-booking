import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Typed view of the tables for queries. The source of truth for DDL is
 * migrations/*.sql, because the constraints that matter most (the partial
 * unique index on bookings and the exclusion constraint on slots) are plain
 * Postgres features and read best as SQL.
 */

const instant = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  role: text('role', { enum: ['customer', 'admin'] }).notNull().default('customer'),
  createdAt: instant('created_at').notNull().defaultNow(),
});

export const loginCodes = pgTable('login_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  codeHash: text('code_hash').notNull(),
  expiresAt: instant('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  consumedAt: instant('consumed_at'),
  createdAt: instant('created_at').notNull().defaultNow(),
});

export const services = pgTable('services', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  durationMinutes: integer('duration_minutes').notNull(),
  priceCents: integer('price_cents').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: instant('created_at').notNull().defaultNow(),
});

export const slots = pgTable('slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  serviceId: uuid('service_id')
    .notNull()
    .references(() => services.id, { onDelete: 'cascade' }),
  startsAt: instant('starts_at').notNull(),
  endsAt: instant('ends_at').notNull(),
  createdAt: instant('created_at').notNull().defaultNow(),
});

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  slotId: uuid('slot_id')
    .notNull()
    .references(() => slots.id, { onDelete: 'restrict' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['confirmed', 'cancelled'] }).notNull().default('confirmed'),
  createdAt: instant('created_at').notNull().defaultNow(),
  cancelledAt: instant('cancelled_at'),
});
