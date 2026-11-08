import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import type { DbHandle } from './client';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../migrations');

/** Apply migrations/*.sql in name order, once each. Small on purpose: easy to read, easy to audit. */
export async function migrate(handle: DbHandle): Promise<string[]> {
  await handle.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
  );
  const rows = await handle.db.execute<{ name: string }>(sql`SELECT name FROM schema_migrations`);
  const applied = new Set(toRows<{ name: string }>(rows).map((r) => r.name));

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const text = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    const escaped = file.replace(/'/g, "''");
    await handle.exec(`BEGIN;\n${text}\nINSERT INTO schema_migrations (name) VALUES ('${escaped}');\nCOMMIT;`);
    ran.push(file);
  }
  return ran;
}

// postgres-js returns an array; PGlite returns { rows }.
function toRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}
