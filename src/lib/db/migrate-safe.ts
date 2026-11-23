/**
 * Safe database migrations, run on every build (`pnpm db:migrate`, see vercel.json) and checked by `pnpm db:check` (part of `check:all`).
 *
 * Guarantees:
 * - All-or-nothing: pending migrations, their bookkeeping and a schema verification run in ONE transaction.
 *   If anything fails, the database stays exactly as it was and the build fails, so the live version keeps running.
 * - One at a time: a transaction-scoped advisory lock serialises concurrent builds (works through connection poolers).
 * - Never blocks traffic for long: short lock_timeout, retried with backoff; bounded statement_timeout.
 * - Backward compatible by default: SQL that would break the version still serving traffic (drops, renames,
 *   type changes, new NOT NULL without default, new constraints on existing tables…) is refused unless the
 *   migration file carries `-- parallaxa:allow-destructive <reason>`.
 * - History is trusted, not assumed: an applied migration that was edited, or one that would be silently skipped,
 *   stops the build.
 * - Verified: after applying, every table and column of the latest Drizzle snapshot must exist in the database.
 * - Preview builds never migrate the production database (detected by host, recorded on production builds).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type SqlClient = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  /** Runs SQL that may contain several statements. */
  exec: (text: string) => Promise<unknown>;
};

export type LocalMigration = { idx: number; tag: string; when: number; hash: string; sql: string; statements: string[]; allowDestructive: string | null };
export type AppliedMigration = { hash: string; createdAt: number };

const ALLOW_MARKER = /--\s*parallaxa:allow-destructive\b[:\s]*(.*)/i;
const MIGRATIONS_SCHEMA = 'drizzle';
const MIGRATIONS_TABLE = '__drizzle_migrations';
const LOCK_KEY = 'parallaxa:migrations';

/** Same files, order and hashes as Drizzle's own migrator, so both can share one history table. */
export function readLocalMigrations(folder: string): LocalMigration[] {
  const journal = JSON.parse(fs.readFileSync(path.join(folder, 'meta', '_journal.json'), 'utf8')) as { entries: { idx: number; tag: string; when: number }[] };
  return journal.entries.map((e) => {
    const file = path.join(folder, `${e.tag}.sql`);
    if (!fs.existsSync(file)) throw new UnsafeMigrationError(`The journal lists ${e.tag} but ${e.tag}.sql is missing.`);
    const sql = fs.readFileSync(file, 'utf8');
    return {
      idx: e.idx,
      tag: e.tag,
      when: e.when,
      hash: crypto.createHash('sha256').update(sql).digest('hex'),
      sql,
      statements: sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean),
      allowDestructive: sql.match(ALLOW_MARKER)?.[1]?.trim() || (ALLOW_MARKER.test(sql) ? 'no reason given' : null),
    };
  });
}

/** SQL files that exist on disk but are not in the journal would never run. */
export function orphanFiles(folder: string, local: LocalMigration[]): string[] {
  const known = new Set(local.map((m) => `${m.tag}.sql`));
  return fs.readdirSync(folder).filter((f) => f.endsWith('.sql') && !known.has(f));
}

export class UnsafeMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeMigrationError';
  }
}

// ───────────────────────────── Plan ─────────────────────────────

export type Plan = {
  pending: LocalMigration[];
  /** Applied migrations whose file changed since: the database no longer matches the history in the repo. */
  edited: LocalMigration[];
  /** Local migrations older than the newest applied one that never ran (Drizzle would skip them silently). */
  skipped: LocalMigration[];
  /** Applied migrations this code doesn't know (an older commit is being deployed); harmless if they were additive. */
  unknown: AppliedMigration[];
};

export function planMigrations(local: LocalMigration[], applied: AppliedMigration[]): Plan {
  const latest = applied.reduce((max, a) => Math.max(max, a.createdAt), Number.NEGATIVE_INFINITY);
  const byWhen = new Map(applied.map((a) => [a.createdAt, a.hash]));
  return {
    pending: local.filter((m) => m.when > latest),
    edited: local.filter((m) => byWhen.has(m.when) && byWhen.get(m.when) !== m.hash),
    skipped: local.filter((m) => m.when <= latest && !byWhen.has(m.when)),
    unknown: applied.filter((a) => !local.some((m) => m.when === a.createdAt)),
  };
}

// ───────────────────────────── Lint ─────────────────────────────

export type Finding = { tag: string; rule: string; severity: 'block' | 'warn'; statement: string; approved?: string };

const ident = String.raw`(?:"[^"]+"|[\w$]+)`;
const qualified = String.raw`(?:${ident}\.)?(${ident})`;
const unquote = (s: string) => s.replace(/^"|"$/g, '').toLowerCase();

function targetTable(stmt: string): string | null {
  const m = stmt.match(new RegExp(String.raw`^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?${qualified}`, 'i')) ?? stmt.match(new RegExp(String.raw`\bON\s+(?:ONLY\s+)?${qualified}`, 'i'));
  return m ? unquote(m[1]!) : null;
}

const RULES: { rule: string; severity: 'block' | 'warn'; test: (s: string, existing: boolean) => boolean }[] = [
  { rule: 'drops a table, view, type, schema or other object', severity: 'block', test: (s) => /\bDROP\s+(TABLE|SCHEMA|VIEW|MATERIALIZED\s+VIEW|TYPE|SEQUENCE|FUNCTION|EXTENSION)\b/i.test(s) },
  { rule: 'drops a column', severity: 'block', test: (s) => /\bDROP\s+COLUMN\b/i.test(s) },
  { rule: 'deletes data', severity: 'block', test: (s) => /^(TRUNCATE|DELETE\s+FROM)\b/i.test(s) },
  { rule: 'renames a table or column (the live version still uses the old name)', severity: 'block', test: (s) => /\bRENAME\s+(COLUMN|TO)\b/i.test(s) },
  { rule: 'changes a column type', severity: 'block', test: (s) => new RegExp(String.raw`\bALTER\s+COLUMN\s+${ident}\s+(SET\s+DATA\s+)?TYPE\b`, 'i').test(s) },
  { rule: 'makes an existing column NOT NULL', severity: 'block', test: (s, existing) => existing && new RegExp(String.raw`\bALTER\s+COLUMN\s+${ident}\s+SET\s+NOT\s+NULL\b`, 'i').test(s) },
  { rule: 'adds a NOT NULL column without a default to an existing table (the live version cannot insert rows)', severity: 'block', test: (s, existing) => existing && /\bADD\s+COLUMN\b/i.test(s) && /\bNOT\s+NULL\b/i.test(s) && !/\bDEFAULT\b/i.test(s) && !/\bGENERATED\b/i.test(s) },
  { rule: 'adds a constraint to an existing table (may reject current data or the live version’s writes)', severity: 'block', test: (s, existing) => existing && /\bADD\s+CONSTRAINT\b/i.test(s) },
  { rule: 'adds a unique index to an existing table (may fail on duplicates or reject the live version’s writes)', severity: 'block', test: (s, existing) => existing && /^CREATE\s+UNIQUE\s+INDEX\b/i.test(s) },
  { rule: 'builds an index on an existing table (blocks writes to it while building)', severity: 'warn', test: (s, existing) => existing && /^CREATE\s+INDEX\b/i.test(s) && !/\bCONCURRENTLY\b/i.test(s) },
  { rule: 'updates existing rows', severity: 'warn', test: (s) => /^UPDATE\b/i.test(s) },
  { rule: 'drops an index or constraint', severity: 'warn', test: (s) => /\bDROP\s+(INDEX|CONSTRAINT)\b/i.test(s) },
  { rule: 'creates an extension (needs database privileges)', severity: 'warn', test: (s) => /^CREATE\s+EXTENSION\b/i.test(s) },
];

/**
 * Checks each migration against the version that is live while it runs. A table counts as "existing"
 * (it may hold data and live code uses it) when an earlier migration created it.
 */
export function lintMigrations(all: LocalMigration[], only?: LocalMigration[]): Finding[] {
  const created = new Set<string>();
  const findings: Finding[] = [];
  const check = new Set((only ?? all).map((m) => m.tag));
  for (const m of all) {
    const createdHere = new Set<string>();
    for (const raw of m.statements) {
      const stmt = raw.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
      if (!stmt) continue;
      const newTable = stmt.match(new RegExp(String.raw`^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?${qualified}`, 'i'));
      if (newTable) {
        createdHere.add(unquote(newTable[1]!));
        continue;
      }
      if (!check.has(m.tag)) continue;
      const table = targetTable(stmt);
      const existing = table ? created.has(table) && !createdHere.has(table) : true;
      for (const r of RULES) {
        if (r.test(stmt, existing)) findings.push({ tag: m.tag, rule: r.rule, severity: r.severity, statement: stmt.slice(0, 160), approved: r.severity === 'block' && m.allowDestructive ? m.allowDestructive : undefined });
      }
    }
    for (const t of createdHere) created.add(t);
  }
  return findings;
}

export const blocking = (f: Finding[]) => f.filter((x) => x.severity === 'block' && !x.approved);

// ───────────────────────────── Verify ─────────────────────────────

type Snapshot = { tables: Record<string, { name: string; schema: string; columns: Record<string, { name: string; notNull: boolean }> }> };

export function latestSnapshot(folder: string, local: LocalMigration[]): Snapshot | null {
  const last = local.at(-1);
  if (!last) return null;
  const file = path.join(folder, 'meta', `${String(last.idx).padStart(4, '0')}_snapshot.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Snapshot) : null;
}

/** Every table and column the code expects must exist; required columns must be NOT NULL. Extra objects are fine. */
export async function verifySchema(db: SqlClient, snapshot: Snapshot): Promise<string[]> {
  const { rows } = await db.query(`select table_schema, table_name, column_name, is_nullable from information_schema.columns where table_schema not in ('pg_catalog', 'information_schema')`);
  const cols = new Map(rows.map((r) => [`${r.table_schema}.${r.table_name}.${r.column_name}`, r.is_nullable === 'YES']));
  const tables = new Set(rows.map((r) => `${r.table_schema}.${r.table_name}`));
  const problems: string[] = [];
  for (const t of Object.values(snapshot.tables)) {
    const schema = t.schema || 'public';
    if (!tables.has(`${schema}.${t.name}`)) {
      problems.push(`missing table ${schema}.${t.name}`);
      continue;
    }
    for (const c of Object.values(t.columns)) {
      const nullable = cols.get(`${schema}.${t.name}.${c.name}`);
      if (nullable === undefined) problems.push(`missing column ${t.name}.${c.name}`);
      else if (c.notNull && nullable) problems.push(`column ${t.name}.${c.name} should be NOT NULL`);
    }
  }
  return problems;
}

// ───────────────────────────── Run ─────────────────────────────

export type Environment = 'production' | 'preview' | 'development' | 'local';
export type Mode = 'auto' | 'apply' | 'check';

export type RunOptions = {
  folder: string;
  environment: Environment;
  /** Normalised database host, used to recognise the production database from a preview build. */
  host: string | null;
  mode: Mode;
  lockTimeout?: string;
  statementTimeout?: string;
  retries?: number;
  log?: (line: string) => void;
  /** Called once, before anything is applied, with the migrations about to run (e.g. to snapshot the database). */
  beforeApply?: (pending: LocalMigration[]) => Promise<void>;
};

export type RunReport = { status: 'in-sync' | 'applied' | 'pending-not-applied'; applied: string[]; pending: string[]; warnings: Finding[]; restorePoint?: string };

const RETRYABLE = new Set(['55P03', '40P01', '40001']); // lock_not_available, deadlock_detected, serialization_failure
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const q = (s: string) => `"${s}"`;

async function readApplied(db: SqlClient): Promise<AppliedMigration[]> {
  await db.exec(`CREATE SCHEMA IF NOT EXISTS ${q(MIGRATIONS_SCHEMA)}`);
  await db.exec(`CREATE TABLE IF NOT EXISTS ${q(MIGRATIONS_SCHEMA)}.${q(MIGRATIONS_TABLE)} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`);
  await db.exec(`CREATE TABLE IF NOT EXISTS ${q(MIGRATIONS_SCHEMA)}."__parallaxa_deploy" (key text PRIMARY KEY, value text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
  const { rows } = await db.query(`select hash, created_at from ${q(MIGRATIONS_SCHEMA)}.${q(MIGRATIONS_TABLE)}`);
  return rows.map((r) => ({ hash: String(r.hash), createdAt: Number(r.created_at) }));
}

async function productionHost(db: SqlClient): Promise<string | null> {
  const { rows } = await db.query(`select value from ${q(MIGRATIONS_SCHEMA)}."__parallaxa_deploy" where key = 'production_host'`);
  return rows[0] ? String(rows[0].value) : null;
}

/** Decides whether this build may apply migrations to this database. Throws with the reason when it may not. */
function assertAllowed(opts: RunOptions, prodHost: string | null, pending: LocalMigration[]) {
  if (!pending.length || opts.mode === 'apply') return;
  if (opts.mode === 'check') throw new UnsafeMigrationError(`${pending.length} migration(s) pending and this run only checks: ${pending.map((m) => m.tag).join(', ')}.`);
  if (opts.environment !== 'preview') return;
  if (prodHost && opts.host && prodHost === opts.host) {
    throw new UnsafeMigrationError(
      `This preview build points at the production database and has unreleased migrations (${pending.map((m) => m.tag).join(', ')}). ` +
        'Migrations reach production only through a production deploy. Give previews their own Neon branch, or merge to main.',
    );
  }
  if (!prodHost) {
    throw new UnsafeMigrationError(
      'This preview build cannot tell whether its database is the production one (no production deploy has recorded it yet). ' +
        'Deploy to production first, or set MIGRATIONS=apply on this preview if its database is certainly separate.',
    );
  }
}

export async function runSafeMigrations(db: SqlClient, opts: RunOptions): Promise<RunReport> {
  const log = opts.log ?? (() => undefined);
  const local = readLocalMigrations(opts.folder);
  const orphans = orphanFiles(opts.folder, local);
  if (orphans.length) throw new UnsafeMigrationError(`SQL files not in the journal (they would never run): ${orphans.join(', ')}. Regenerate them with pnpm db:generate.`);
  const snapshot = latestSnapshot(opts.folder, local);
  if (!snapshot) throw new UnsafeMigrationError('The latest migration has no Drizzle snapshot, so the schema cannot be verified.');

  const retries = opts.retries ?? 5;
  let beforeApplyDone = false;
  for (let attempt = 1; ; attempt++) {
    // A read-only look first, so a snapshot of the database can be taken before anything changes.
    if (opts.beforeApply && !beforeApplyDone) {
      const peek = planMigrations(local, await readApplied(db));
      if (peek.pending.length && !peek.edited.length && !peek.skipped.length && !blocking(lintMigrations(local, peek.pending)).length) {
        assertAllowed(opts, await productionHost(db), peek.pending);
        await opts.beforeApply(peek.pending);
      }
      beforeApplyDone = true;
    }
    await db.exec('BEGIN');
    try {
      await db.exec(`SET LOCAL lock_timeout = '${opts.lockTimeout ?? '5s'}'`);
      await db.exec(`SET LOCAL statement_timeout = '${opts.statementTimeout ?? '120s'}'`);
      await db.query('select pg_advisory_xact_lock(hashtext($1))', [LOCK_KEY]);
      const applied = await readApplied(db);
      const plan = planMigrations(local, applied);
      if (plan.edited.length) throw new UnsafeMigrationError(`Already-applied migrations were edited: ${plan.edited.map((m) => m.tag).join(', ')}. Never change a released migration; add a new one.`);
      if (plan.skipped.length) throw new UnsafeMigrationError(`Migrations older than the newest applied one never ran: ${plan.skipped.map((m) => m.tag).join(', ')}. Regenerate them so they sort last.`);
      if (plan.unknown.length) log(`⚠ The database has ${plan.unknown.length} migration(s) newer than this code (an older commit is being deployed). Nothing to apply.`);

      const findings = lintMigrations(local, plan.pending);
      const blocked = blocking(findings);
      if (blocked.length) {
        throw new UnsafeMigrationError(
          'Refusing to apply migrations that could break the version serving traffic:\n' +
            blocked.map((f) => `  • ${f.tag}: ${f.rule}\n      ${f.statement}`).join('\n') +
            '\nShip it in two steps (add the new shape, deploy, then remove the old one), or, after review, add\n' +
            '  -- parallaxa:allow-destructive <reason>\nto the migration file.',
        );
      }
      assertAllowed(opts, await productionHost(db), plan.pending);

      let restorePoint: string | undefined;
      if (plan.pending.length) {
        try {
          const { rows } = await db.query(`select now()::text as at, pg_current_wal_lsn()::text as lsn`);
          restorePoint = `${rows[0]!.at} (LSN ${rows[0]!.lsn})`;
        } catch {
          restorePoint = new Date().toISOString();
        }
        log(`Restore point before migrating: ${restorePoint}`);
        for (const m of plan.pending) {
          log(`Applying ${m.tag} (${m.statements.length} statement${m.statements.length === 1 ? '' : 's'})`);
          for (const stmt of m.statements) await db.exec(stmt);
          await db.query(`insert into ${q(MIGRATIONS_SCHEMA)}.${q(MIGRATIONS_TABLE)} (hash, created_at) values ($1, $2)`, [m.hash, m.when]);
        }
      }

      const problems = await verifySchema(db, snapshot);
      if (problems.length) throw new UnsafeMigrationError(`The database does not match the code after migrating:\n  • ${problems.join('\n  • ')}`);

      if (opts.environment === 'production' && opts.host) {
        await db.query(`insert into ${q(MIGRATIONS_SCHEMA)}."__parallaxa_deploy" (key, value) values ('production_host', $1) on conflict (key) do update set value = excluded.value, updated_at = now()`, [opts.host]);
      }
      await db.exec('COMMIT');
      const warnings = findings.filter((f) => f.severity === 'warn' || f.approved);
      return { status: plan.pending.length ? 'applied' : 'in-sync', applied: plan.pending.map((m) => m.tag), pending: [], warnings, restorePoint };
    } catch (e) {
      await db.exec('ROLLBACK').catch(() => undefined);
      const code = (e as { code?: string }).code;
      if (code && RETRYABLE.has(code) && attempt < retries) {
        const wait = Math.min(30_000, 1000 * 2 ** attempt);
        log(`Database busy (${code}); nothing was changed. Retrying in ${wait / 1000}s (${attempt}/${retries - 1})…`);
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
}

/** Status without applying anything (used by `pnpm db:check` when a database is available). */
export async function migrationStatus(db: SqlClient, folder: string): Promise<{ plan: Plan; problems: string[] }> {
  const local = readLocalMigrations(folder);
  const snapshot = latestSnapshot(folder, local);
  await db.exec('BEGIN');
  try {
    const plan = planMigrations(local, await readApplied(db));
    const problems = plan.pending.length || !snapshot ? [] : await verifySchema(db, snapshot);
    return { plan, problems };
  } finally {
    await db.exec('ROLLBACK');
  }
}

/** Neon hostnames differ only by the "-pooler" suffix between pooled and direct connections. */
export function normaliseHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace('-pooler', '').toLowerCase();
  } catch {
    return null;
  }
}
