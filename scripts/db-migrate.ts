/**
 * `pnpm db:migrate` (every build, see vercel.json) and `pnpm db:check` (part of `pnpm check:all`, or by hand against any database).
 *
 * 1. Drift: fails if src/lib/db/schema.ts has changes no migration covers (someone forgot `pnpm db:generate`).
 * 2. Lint: every migration must be safe for the version that is live while it runs (see src/lib/db/migrate-safe.ts).
 * 3. Database (DATABASE_URL, or the local PGlite database when unset; skipped on Vercel when unset):
 *    - db:check reports pending migrations and verifies the schema, changing nothing.
 *    - db:migrate applies pending migrations in one locked, verified transaction, or changes nothing and fails.
 *
 * Environment:
 *   MIGRATIONS=auto|apply|check   auto (default): production and local apply; previews apply only to their own database.
 *   NEON_API_KEY + NEON_PROJECT_ID (+ NEON_BRANCH_ID)  optional: snapshot the database as a Neon branch before migrating production.
 *   MIGRATION_LOCK_TIMEOUT, MIGRATION_STATEMENT_TIMEOUT  optional Postgres intervals (defaults 5s and 120s).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  blocking,
  lintMigrations,
  migrationStatus,
  normaliseHost,
  readLocalMigrations,
  runSafeMigrations,
  UnsafeMigrationError,
  type Environment,
  type LocalMigration,
  type Mode,
  type SqlClient,
} from '../src/lib/db/migrate-safe';

const ROOT = process.cwd();
const FOLDER = path.join(ROOT, 'drizzle');
const checkOnly = process.argv.includes('--check');
const log = (line: string) => console.log(`[db] ${line}`);

/**
 * Runs drizzle-kit against a copy of the migrations: if it would generate anything, the schema has drifted.
 * drizzle-kit exits 0 even when it crashes, so "in sync" requires its explicit "nothing to migrate" message.
 */
function schemaDrift(): string | null {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'parallaxa-drift-'));
  try {
    const out = path.join(work, 'drizzle');
    fs.cpSync(FOLDER, out, { recursive: true });
    const config = path.join(work, 'drizzle.config.ts');
    // drizzle-kit resolves `out` against the working directory even when it is absolute, so pass it relative.
    fs.writeFileSync(config, `export default ${JSON.stringify({ dialect: 'postgresql', schema: './src/lib/db/schema.ts', out: path.relative(ROOT, out) })};\n`);
    const sqlFiles = () => fs.readdirSync(out).filter((f) => f.endsWith('.sql'));
    const before = new Set(sqlFiles());
    const bin = path.join(ROOT, 'node_modules', '.bin', 'drizzle-kit');
    const r = spawnSync(bin, ['generate', `--config=${config}`], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000, encoding: 'utf8' });
    const output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    const added = sqlFiles().filter((f) => !before.has(f));
    if (added.length) {
      const sql = fs.readFileSync(path.join(out, added[0]!), 'utf8').trim();
      return `src/lib/db/schema.ts has changes that no migration covers. Run \`pnpm db:generate\` and commit the new file. It would contain:\n${sql}`;
    }
    if (r.error || r.status !== 0 || !/nothing to migrate/i.test(output)) {
      return `Could not confirm that the schema matches the migrations (drizzle-kit ${r.error ? r.error.message : `exited ${r.status}`}; it may need an answer about a rename). Run \`pnpm db:generate\` locally.\n${output.slice(-800)}`;
    }
    return null;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

function environment(): Environment {
  const v = process.env.VERCEL_ENV;
  return v === 'production' || v === 'preview' || v === 'development' ? v : 'local';
}

async function neonBackup(pending: LocalMigration[]) {
  const key = process.env.NEON_API_KEY;
  const project = process.env.NEON_PROJECT_ID;
  if (environment() !== 'production') return;
  if (!key || !project) {
    log('No NEON_API_KEY/NEON_PROJECT_ID: no backup branch. Neon point-in-time restore can return to the restore point printed below.');
    return;
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
  const name = `pre-${pending.at(-1)!.tag}-${stamp}`.slice(0, 60);
  const parent = process.env.NEON_BRANCH_ID;
  const res = await fetch(`https://console.neon.tech/api/v2/projects/${encodeURIComponent(project)}/branches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ branch: { name, ...(parent ? { parent_id: parent } : {}) } }),
  });
  if (!res.ok) throw new UnsafeMigrationError(`Could not create the Neon backup branch (HTTP ${res.status}), so nothing was migrated.`);
  const j = (await res.json()) as { branch?: { id?: string; name?: string } };
  log(`Backup branch created: ${j.branch?.name ?? name} (${j.branch?.id ?? 'id unknown'}).`);
}

async function connect(): Promise<{ db: SqlClient; host: string | null; close: () => Promise<void>; seed: () => Promise<void> }> {
  // Direct (unpooled) connection when available: migrations hold a transaction open.
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import('@neondatabase/serverless');
    const pool = new Pool({ connectionString: url });
    const client = await pool.connect();
    const db: SqlClient = { query: (t, p) => client.query(t, p as unknown[]), exec: (t) => client.query(t) };
    return {
      db,
      host: normaliseHost(process.env.DATABASE_URL ?? url),
      seed: async () => {
        const { drizzle } = await import('drizzle-orm/neon-serverless');
        const { seedIfEmpty } = await import('../src/lib/db/seed');
        await seedIfEmpty(drizzle({ client: pool }) as never);
      },
      close: async () => {
        client.release();
        await pool.end();
      },
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const dir = path.join(ROOT, '.data', 'pglite');
  fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  return {
    db: { query: (t, p) => client.query(t, p) as Promise<{ rows: Record<string, unknown>[] }>, exec: (t) => client.exec(t) },
    host: null,
    seed: async () => {
      const { drizzle } = await import('drizzle-orm/pglite');
      const { seedIfEmpty } = await import('../src/lib/db/seed');
      await seedIfEmpty(drizzle({ client }) as never);
    },
    close: () => client.close(),
  };
}

async function main() {
  const drift = schemaDrift();
  if (drift) throw new UnsafeMigrationError(drift);
  log('Schema and migrations agree.');

  const local = readLocalMigrations(FOLDER);
  const findings = lintMigrations(local);
  const blocked = blocking(findings);
  if (blocked.length) throw new UnsafeMigrationError(`Unsafe migrations:\n${blocked.map((f) => `  • ${f.tag}: ${f.rule}\n      ${f.statement}`).join('\n')}\nSplit the change in two deploys, or add "-- parallaxa:allow-destructive <reason>" after review.`);
  for (const f of findings.filter((x) => x.severity === 'warn' || x.approved)) log(`${f.approved ? `Approved (${f.approved})` : 'Note'}: ${f.tag} ${f.rule}`);
  log(`${local.length} migrations pass the safety rules.`);

  const hasDatabase = Boolean(process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING);
  if (!hasDatabase && (checkOnly || process.env.VERCEL)) {
    // On Vercel without a database (a demo preview) the build's local PGlite would be thrown away: nothing to migrate.
    log('No DATABASE_URL: skipped the database step (the app runs on its embedded demo database).');
    return;
  }

  const conn = await connect();
  try {
    if (checkOnly) {
      const { plan, problems } = await migrationStatus(conn.db, FOLDER);
      if (plan.edited.length || plan.skipped.length) throw new UnsafeMigrationError(`History mismatch: edited ${plan.edited.map((m) => m.tag).join(', ') || 'none'}; never applied ${plan.skipped.map((m) => m.tag).join(', ') || 'none'}.`);
      if (problems.length) throw new UnsafeMigrationError(`The database does not match the code:\n  • ${problems.join('\n  • ')}`);
      log(plan.pending.length ? `${plan.pending.length} migration(s) will apply on the next deploy: ${plan.pending.map((m) => m.tag).join(', ')}` : 'Database is in sync.');
      return;
    }
    const mode = (['auto', 'apply', 'check'] as const).find((m) => m === process.env.MIGRATIONS) ?? ('auto' satisfies Mode);
    const report = await runSafeMigrations(conn.db, {
      folder: FOLDER,
      environment: environment(),
      host: conn.host,
      mode,
      lockTimeout: process.env.MIGRATION_LOCK_TIMEOUT,
      statementTimeout: process.env.MIGRATION_STATEMENT_TIMEOUT,
      log,
      beforeApply: neonBackup,
    });
    log(report.status === 'applied' ? `Applied and verified: ${report.applied.join(', ')}.` : 'Database is in sync; nothing to apply.');
    await conn.seed();
  } finally {
    await conn.close();
  }
}

main().catch((e) => {
  console.error(`[db] ✗ ${e instanceof UnsafeMigrationError ? e.message : (e as Error).stack ?? e}`);
  console.error('[db] The database was not changed. The build stops here so the live version keeps running.');
  process.exit(1);
});
