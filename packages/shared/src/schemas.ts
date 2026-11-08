import { z } from 'zod';

/**
 * Every request and response body is described here once. The API validates
 * input with these schemas; the app parses responses with them. A breaking
 * change on either side fails typecheck in the other.
 */

// ---------- primitives ----------

export const idSchema = z.uuid();

/** Instants always travel as UTC ISO-8601 strings, e.g. 2026-11-09T09:00:00.000Z. */
export const utcInstantSchema = z.iso.datetime();

/** Local calendar date, e.g. 2026-11-09. */
export const localDateSchema = z.iso.date();

/** Local wall-clock time, 24h, e.g. 09:30. */
export const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm (24h)');

export const timeZoneSchema = z.string().refine(isValidTimeZone, 'Unknown IANA time zone');

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ---------- errors ----------

export const errorCodeSchema = z.enum([
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'SLOT_TAKEN',
  'SLOT_OVERLAP',
  'SLOT_IN_PAST',
  'SLOT_HAS_BOOKING',
  'INVALID_CODE',
  'NONEXISTENT_LOCAL_TIME',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

// ---------- auth ----------

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address'));

export const requestCodeSchema = z.object({ email: emailSchema });
export type RequestCodeInput = z.infer<typeof requestCodeSchema>;

export const verifyCodeSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, 'The code has 6 digits'),
});
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;

export const roleSchema = z.enum(['customer', 'admin']);
export type Role = z.infer<typeof roleSchema>;

export const userSchema = z.object({
  id: idSchema,
  email: z.email(),
  role: roleSchema,
});
export type User = z.infer<typeof userSchema>;

export const authResponseSchema = z.object({
  token: z.string().min(1),
  user: userSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

// ---------- services ----------

export const serviceSchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string(),
  durationMinutes: z.number().int(),
  priceCents: z.number().int(),
  active: z.boolean(),
});
export type Service = z.infer<typeof serviceSchema>;

export const serviceInputSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(80),
  description: z.string().trim().max(500).default(''),
  durationMinutes: z.number().int().min(15, 'At least 15 minutes').max(480, 'At most 8 hours'),
  priceCents: z.number().int().min(0).max(1_000_000),
  active: z.boolean().default(true),
});
export type ServiceInput = z.input<typeof serviceInputSchema>;

export const serviceUpdateSchema = serviceInputSchema.partial();
export type ServiceUpdate = z.input<typeof serviceUpdateSchema>;

// ---------- slots ----------

export const slotSchema = z.object({
  id: idSchema,
  serviceId: idSchema,
  startsAt: utcInstantSchema,
  endsAt: utcInstantSchema,
  available: z.boolean(),
});
export type Slot = z.infer<typeof slotSchema>;

/**
 * Admins enter availability the way they think about it: a local date, a list
 * of local start times and the zone they work in. The API converts to UTC.
 */
export const availabilityInputSchema = z.object({
  serviceId: idSchema,
  date: localDateSchema,
  times: z.array(localTimeSchema).min(1, 'Pick at least one time').max(48),
  timeZone: timeZoneSchema,
});
export type AvailabilityInput = z.infer<typeof availabilityInputSchema>;

export const slotsQuerySchema = z.object({
  from: utcInstantSchema.optional(),
  to: utcInstantSchema.optional(),
});

// ---------- bookings ----------

export const bookingStatusSchema = z.enum(['confirmed', 'cancelled']);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

export const createBookingSchema = z.object({ slotId: idSchema });
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const bookingSchema = z.object({
  id: idSchema,
  status: bookingStatusSchema,
  createdAt: utcInstantSchema,
  slot: slotSchema.omit({ available: true }),
  service: serviceSchema.pick({ id: true, name: true, durationMinutes: true, priceCents: true }),
});
export type Booking = z.infer<typeof bookingSchema>;

// ---------- list envelopes ----------

export const servicesResponseSchema = z.object({ services: z.array(serviceSchema) });
export const slotsResponseSchema = z.object({ slots: z.array(slotSchema) });
export const bookingsResponseSchema = z.object({ bookings: z.array(bookingSchema) });
export const bookingResponseSchema = z.object({ booking: bookingSchema });
export const serviceResponseSchema = z.object({ service: serviceSchema });
export const meResponseSchema = z.object({ user: userSchema });
