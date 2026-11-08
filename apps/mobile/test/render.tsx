import type { Booking, Service, Slot, User } from '@booking/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, userEvent } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { AuthContext, type AuthState, type Session } from '@/lib/auth';

export const customer: User = { id: '0b8f6a63-6c31-4c43-a4ce-0f2f3c7f9a01', email: 'pat@example.com', role: 'customer' };
export const admin: User = { id: '0b8f6a63-6c31-4c43-a4ce-0f2f3c7f9a02', email: 'admin@example.com', role: 'admin' };

const clients: QueryClient[] = [];
afterEach(() => {
  // Drop cached queries and their timers so Jest workers exit cleanly.
  clients.splice(0).forEach((client) => client.clear());
});

export async function renderScreen(ui: ReactElement, opts: { session?: Session | null } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  clients.push(queryClient);
  const session = opts.session === undefined ? { token: 't', user: customer } : opts.session;
  const auth: AuthState = {
    status: session ? 'signedIn' : 'signedOut',
    session,
    signIn: jest.fn(() => Promise.resolve()),
    signOut: jest.fn(() => Promise.resolve()),
  };
  const user = userEvent.setup();
  const utils = await render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>{ui}</AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { ...utils, auth, queryClient, user };
}

let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

export function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: uuid(),
    name: 'Coaching session',
    description: 'One-to-one session with a written plan afterwards.',
    durationMinutes: 60,
    priceCents: 9000,
    active: true,
    ...overrides,
  };
}

export function makeSlot(serviceId: string, startsAt: string, overrides: Partial<Slot> = {}): Slot {
  return {
    id: uuid(),
    serviceId,
    startsAt,
    endsAt: new Date(Date.parse(startsAt) + 3_600_000).toISOString(),
    available: true,
    ...overrides,
  };
}

export function makeBooking(service: Service, startsAt: string, overrides: Partial<Booking> = {}): Booking {
  return {
    id: uuid(),
    status: 'confirmed',
    createdAt: '2026-01-01T00:00:00.000Z',
    slot: { id: uuid(), serviceId: service.id, startsAt, endsAt: new Date(Date.parse(startsAt) + 3_600_000).toISOString() },
    service: { id: service.id, name: service.name, durationMinutes: service.durationMinutes, priceCents: service.priceCents },
    ...overrides,
  };
}
