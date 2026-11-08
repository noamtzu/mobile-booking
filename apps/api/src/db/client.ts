import { PGlite } from '@electric-sql/pglite';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DbHandle {
  db: Database;
  /** Run a multi-statement SQL script (migrations). */
  exec: (sqlText: string) => Promise<void>;
  close: () => Promise<void>;
}

/**
 * `postgres://...` connects to a real server (dev, CI, production).
 * `pglite://memory` runs Postgres in-process via WASM, which keeps the test
 * suite runnable on any machine without Docker. Same SQL, same constraints.
 */
export function createDb(url: string): DbHandle {
  if (url.startsWith('pglite://')) {
    const client = new PGlite();
    const db = drizzlePglite({ client, schema }) as unknown as Database;
    return {
      db,
      exec: async (text) => {
        await client.exec(text);
      },
      close: () => client.close(),
    };
  }

  const client = postgres(url, { max: 10, onnotice: () => {} });
  const db = drizzlePostgres({ client, schema }) as unknown as Database;
  return {
    db,
    exec: async (text) => {
      await client.unsafe(text).simple();
    },
    close: () => client.end({ timeout: 5 }),
  };
}

/** Postgres SQLSTATE of an error thrown by either driver (drizzle may wrap it in `cause`). */
export function pgErrorCode(err: unknown): string | undefined {
  let current: unknown = err;
  for (let depth = 0; depth < 4 && current; depth++) {
    if (typeof current === 'object' && current !== null) {
      const code = (current as { code?: unknown }).code;
      if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
      current = (current as { cause?: unknown }).cause;
    } else {
      break;
    }
  }
  return undefined;
}

export const PG_UNIQUE_VIOLATION = '23505';
export const PG_EXCLUSION_VIOLATION = '23P01';
