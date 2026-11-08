import {
  type AuthResponse,
  type AvailabilityInput,
  type Booking,
  type ErrorCode,
  type RequestCodeInput,
  type Service,
  type ServiceInput,
  type ServiceUpdate,
  type Slot,
  type User,
  type VerifyCodeInput,
  apiErrorSchema,
  authResponseSchema,
  bookingResponseSchema,
  bookingsResponseSchema,
  meResponseSchema,
  serviceResponseSchema,
  servicesResponseSchema,
  slotsResponseSchema,
} from '@booking/shared';
import type { z } from 'zod';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK',
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Called when the API says the session is no longer valid. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function request<S extends z.ZodType>(
  method: string,
  path: string,
  schema: S | null,
  body?: unknown,
): Promise<z.output<S>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', "Can't reach the server. Check your connection and try again.");
  }

  const text = await res.text();
  const json: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(json);
    if (res.status === 401 && authToken) onUnauthorized?.();
    if (parsed.success) throw new ApiError(res.status, parsed.data.error.code, parsed.data.error.message);
    throw new ApiError(res.status, 'INTERNAL', 'Something went wrong. Please try again.');
  }

  if (!schema) return undefined as z.output<S>;
  // Responses are validated with the same schemas the API uses, so a contract
  // drift shows up as a clear error instead of undefined fields in the UI.
  return schema.parse(json);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  requestCode: (input: RequestCodeInput) => request('POST', '/auth/request-code', null, input),
  verifyCode: (input: VerifyCodeInput): Promise<AuthResponse> =>
    request('POST', '/auth/verify', authResponseSchema, input),
  me: async (): Promise<User> => (await request('GET', '/auth/me', meResponseSchema)).user,

  services: async (): Promise<Service[]> => (await request('GET', '/services', servicesResponseSchema)).services,
  service: async (id: string): Promise<Service> =>
    (await request('GET', `/services/${id}`, serviceResponseSchema)).service,
  slots: async (serviceId: string): Promise<Slot[]> =>
    (await request('GET', `/services/${serviceId}/slots`, slotsResponseSchema)).slots,

  bookings: async (): Promise<Booking[]> => (await request('GET', '/bookings', bookingsResponseSchema)).bookings,
  booking: async (id: string): Promise<Booking> =>
    (await request('GET', `/bookings/${id}`, bookingResponseSchema)).booking,
  book: async (slotId: string): Promise<Booking> =>
    (await request('POST', '/bookings', bookingResponseSchema, { slotId })).booking,
  cancel: async (id: string): Promise<Booking> =>
    (await request('POST', `/bookings/${id}/cancel`, bookingResponseSchema)).booking,

  admin: {
    services: async (): Promise<Service[]> =>
      (await request('GET', '/admin/services', servicesResponseSchema)).services,
    createService: async (input: ServiceInput): Promise<Service> =>
      (await request('POST', '/admin/services', serviceResponseSchema, input)).service,
    updateService: async (id: string, input: ServiceUpdate): Promise<Service> =>
      (await request('PATCH', `/admin/services/${id}`, serviceResponseSchema, input)).service,
    addAvailability: async (input: AvailabilityInput): Promise<Slot[]> =>
      (await request('POST', '/admin/availability', slotsResponseSchema, input)).slots,
    deleteSlot: (id: string) => request('DELETE', `/admin/slots/${id}`, null),
  },
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please try again.';
}
