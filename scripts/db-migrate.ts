/** Applies Drizzle migrations to Neon (DATABASE_URL) or the local PGlite database, then seeds reference data. */
import { getDb } from '../src/lib/db/client';
import { seedIfEmpty } from '../src/lib/db/seed';
import path from 'node:path';

async function main() {
  if (process.env.DATABASE_URL) {
    const { drizzle } = await import('drizzle-orm/neon-serverless');
    const { migrate } = await import('drizzle-orm/neon-serverless/migrator');
    const { Pool } = await import('@neondatabase/serverless');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle({ client: pool });
    await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
    await seedIfEmpty((await getDb()) as never);
    await pool.end();
  } else {
    await getDb(); // PGlite migrates and seeds on open
  }
  console.log('Migrations applied.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
