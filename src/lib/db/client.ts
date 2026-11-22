/**
 * Database client. Production: Neon Postgres (DATABASE_URL). Local development and tests:
 * embedded PGlite (file in .data/, or in-memory when PARALLAXA_DB=memory). Same Drizzle schema.
 */
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import * as schema from './schema';
import path from 'node:path';

export type Db = ReturnType<typeof drizzlePglite<typeof schema>>;

const globalForDb = globalThis as unknown as { __plxDb?: Promise<Db> };

async function create(): Promise<Db> {
  const migrationsFolder = path.join(process.cwd(), 'drizzle');
  if (process.env.DATABASE_URL) {
    const { Pool } = await import('@neondatabase/serverless');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    // Neon migrations run in CI/deploy via `pnpm db:migrate`, not on request paths.
    return drizzleNeon({ client: pool, schema }) as unknown as Db;
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const dataDir = process.env.PARALLAXA_DB === 'memory' ? undefined : path.join(process.cwd(), '.data', 'pglite');
  if (dataDir) (await import('node:fs')).mkdirSync(dataDir, { recursive: true });
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  const db = drizzlePglite({ client, schema });
  await migratePglite(db, { migrationsFolder });
  const { seedIfEmpty } = await import('./seed');
  await seedIfEmpty(db);
  return db;
}

export function getDb(): Promise<Db> {
  if (!globalForDb.__plxDb) globalForDb.__plxDb = create();
  return globalForDb.__plxDb;
}

/** Tests only: start from a fresh in-memory database. */
export function resetDbForTests() {
  globalForDb.__plxDb = undefined;
}

export { schema };
