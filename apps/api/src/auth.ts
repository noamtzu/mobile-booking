import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { roleSchema } from '@booking/shared';
import { createMiddleware } from 'hono/factory';
import { sign, verify } from 'hono/jwt';
import { z } from 'zod';
import { HttpError } from './errors';
import type { AppEnv, AuthUser, Deps } from './types';

export const CODE_TTL_MS = 10 * 60_000;
export const MAX_CODE_ATTEMPTS = 5;
const TOKEN_TTL_S = 30 * 24 * 60 * 60;

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Codes are stored hashed and peppered with the server secret, never in plain text. */
export function hashCode(email: string, code: string, secret: string): string {
  return createHash('sha256').update(`${email}:${code}:${secret}`).digest('hex');
}

export function sameHash(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function signToken(user: AuthUser, deps: Pick<Deps, 'jwtSecret' | 'now'>): Promise<string> {
  const iat = Math.floor(deps.now().getTime() / 1000);
  return sign({ sub: user.id, email: user.email, role: user.role, iat, exp: iat + TOKEN_TTL_S }, deps.jwtSecret, 'HS256');
}

const claimsSchema = z.object({ sub: z.uuid(), email: z.email(), role: roleSchema });

export function requireAuth(deps: Pick<Deps, 'jwtSecret'>) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const header = c.req.header('Authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new HttpError(401, 'UNAUTHORIZED', 'Sign in to continue');
    let payload: unknown;
    try {
      payload = await verify(token, deps.jwtSecret, 'HS256');
    } catch {
      throw new HttpError(401, 'UNAUTHORIZED', 'Your session has expired. Sign in again.');
    }
    const claims = claimsSchema.safeParse(payload);
    if (!claims.success) throw new HttpError(401, 'UNAUTHORIZED', 'Invalid session');
    c.set('user', { id: claims.data.sub, email: claims.data.email, role: claims.data.role });
    await next();
  });
}

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get('user').role !== 'admin') throw new HttpError(403, 'FORBIDDEN', 'Admins only');
  await next();
});
