import { describe, expect, it } from 'vitest';
import { availabilityInputSchema, requestCodeSchema, serviceInputSchema, verifyCodeSchema } from '../src/schemas';

describe('auth schemas', () => {
  it('normalises email case and whitespace', () => {
    expect(requestCodeSchema.parse({ email: '  Alex@Example.COM ' }).email).toBe('alex@example.com');
  });

  it('requires a 6-digit code', () => {
    expect(verifyCodeSchema.safeParse({ email: 'a@example.com', code: '12345' }).success).toBe(false);
    expect(verifyCodeSchema.safeParse({ email: 'a@example.com', code: '123456' }).success).toBe(true);
  });
});

describe('serviceInputSchema', () => {
  it('applies defaults and bounds', () => {
    const parsed = serviceInputSchema.parse({ name: 'Intro session', durationMinutes: 30, priceCents: 0 });
    expect(parsed).toMatchObject({ description: '', active: true });
    expect(serviceInputSchema.safeParse({ name: 'X', durationMinutes: 5, priceCents: 0 }).success).toBe(false);
  });
});

describe('availabilityInputSchema', () => {
  const base = {
    serviceId: '6f1c2a59-6a8e-4c3e-9a45-3f1f0c6f2b10',
    date: '2026-11-09',
    times: ['09:00', '10:30'],
    timeZone: 'Europe/London',
  };

  it('accepts local times with an IANA zone', () => {
    expect(availabilityInputSchema.safeParse(base).success).toBe(true);
  });

  it('rejects unknown zones and malformed times', () => {
    expect(availabilityInputSchema.safeParse({ ...base, timeZone: 'Mars/Olympus' }).success).toBe(false);
    expect(availabilityInputSchema.safeParse({ ...base, times: ['9am'] }).success).toBe(false);
  });
});
