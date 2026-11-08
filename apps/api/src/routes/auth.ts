import { requestCodeSchema, verifyCodeSchema } from '@booking/shared';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { CODE_TTL_MS, MAX_CODE_ATTEMPTS, generateCode, hashCode, requireAuth, sameHash, signToken } from '../auth';
import { loginCodes, users } from '../db/schema';
import { HttpError, readJson } from '../errors';
import type { AppEnv, Deps } from '../types';

export function authRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();

  // Step 1: email a 6-digit code. Always 204, so the endpoint does not reveal who has an account.
  r.post('/request-code', async (c) => {
    const { email } = await readJson(c, requestCodeSchema);
    const code = generateCode();
    const now = deps.now();
    await deps.db.transaction(async (tx) => {
      // A new code replaces any earlier one.
      await tx
        .update(loginCodes)
        .set({ consumedAt: now })
        .where(and(eq(loginCodes.email, email), isNull(loginCodes.consumedAt)));
      await tx.insert(loginCodes).values({
        email,
        codeHash: hashCode(email, code, deps.jwtSecret),
        expiresAt: new Date(now.getTime() + CODE_TTL_MS),
      });
    });
    await deps.mailer.sendLoginCode(email, code);
    return c.body(null, 204);
  });

  // Step 2: exchange the code for a JWT. Creates the user on first sign-in.
  r.post('/verify', async (c) => {
    const { email, code } = await readJson(c, verifyCodeSchema);
    const now = deps.now();
    const invalid = new HttpError(401, 'INVALID_CODE', 'That code is wrong or has expired');

    const [pending] = await deps.db
      .select()
      .from(loginCodes)
      .where(and(eq(loginCodes.email, email), isNull(loginCodes.consumedAt), gt(loginCodes.expiresAt, now)))
      .orderBy(desc(loginCodes.createdAt))
      .limit(1);
    if (!pending || pending.attempts >= MAX_CODE_ATTEMPTS) throw invalid;

    if (!sameHash(pending.codeHash, hashCode(email, code, deps.jwtSecret))) {
      await deps.db
        .update(loginCodes)
        .set({ attempts: sql`${loginCodes.attempts} + 1` })
        .where(eq(loginCodes.id, pending.id));
      throw invalid;
    }

    const role = deps.adminEmails.includes(email) ? 'admin' : 'customer';
    const user = await deps.db.transaction(async (tx) => {
      // Single use: the WHERE makes a concurrent second use of the same code a no-op.
      const consumed = await tx
        .update(loginCodes)
        .set({ consumedAt: now })
        .where(and(eq(loginCodes.id, pending.id), isNull(loginCodes.consumedAt)))
        .returning({ id: loginCodes.id });
      if (consumed.length === 0) throw invalid;
      const [row] = await tx
        .insert(users)
        .values({ email, role })
        .onConflictDoUpdate({ target: users.email, set: { role } })
        .returning({ id: users.id, email: users.email, role: users.role });
      if (!row) throw new Error('user upsert returned no row');
      return row;
    });

    return c.json({ token: await signToken(user, deps), user });
  });

  r.get('/me', requireAuth(deps), (c) => c.json({ user: c.get('user') }));

  return r;
}
