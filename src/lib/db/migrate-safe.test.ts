import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { blocking, lintMigrations, normaliseHost, readLocalMigrations, runSafeMigrations, UnsafeMigrationError, type RunOptions, type SqlClient } from './migrate-safe';

const REAL = path.join(process.cwd(), 'drizzle');
const temps: string[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) fs.rmSync(t, { recursive: true, force: true });
});

function fresh(): { db: SqlClient; pg: PGlite } {
  const pg = new PGlite();
  return { pg, db: { query: (t, p) => pg.query(t, p) as Promise<{ rows: Record<string, unknown>[] }>, exec: (t) => pg.exec(t) } };
}

/** A copy of the real migrations plus one extra migration, with its own snapshot. */
function withExtra(sql: string, editSnapshot: (cols: Record<string, unknown>) => void = () => undefined, opts: { when?: number } = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plx-mig-'));
  temps.push(dir);
  fs.cpSync(REAL, dir, { recursive: true });
  const journalPath = path.join(dir, 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
  const last = journal.entries.at(-1);
  const idx = last.idx + 1;
  const tag = `${String(idx).padStart(4, '0')}_test`;
  journal.entries.push({ ...last, idx, tag, when: opts.when ?? last.when + 1000 });
  fs.writeFileSync(journalPath, JSON.stringify(journal));
  fs.writeFileSync(path.join(dir, `${tag}.sql`), sql);
  const snap = JSON.parse(fs.readFileSync(path.join(dir, 'meta', `${String(last.idx).padStart(4, '0')}_snapshot.json`), 'utf8'));
  editSnapshot(snap.tables['public.llm_calls'].columns);
  fs.writeFileSync(path.join(dir, 'meta', `${String(idx).padStart(4, '0')}_snapshot.json`), JSON.stringify(snap));
  return dir;
}

const opts = (folder: string, extra: Partial<RunOptions> = {}): RunOptions => ({ folder, environment: 'local', host: null, mode: 'auto', retries: 2, ...extra });
const appliedCount = async (db: SqlClient) => Number((await db.query('select count(*)::int as n from drizzle.__drizzle_migrations')).rows[0]!.n);
const columns = async (db: SqlClient) => (await db.query(`select column_name from information_schema.columns where table_name = 'llm_calls'`)).rows.map((r) => r.column_name);

describe('safe migrations', () => {
  it('reads the same history and hashes as Drizzle, and every released migration passes the safety rules', () => {
    const ours = readLocalMigrations(REAL);
    expect(ours.map((m) => m.hash)).toEqual(readMigrationFiles({ migrationsFolder: REAL }).map((m) => m.hash));
    expect(blocking(lintMigrations(ours))).toEqual([]);
  });

  it('applies everything to an empty database, verifies it, then reports it in sync', async () => {
    const { db } = fresh();
    const first = await runSafeMigrations(db, opts(REAL));
    expect(first.status).toBe('applied');
    expect(first.applied).toHaveLength(readLocalMigrations(REAL).length);
    expect((await runSafeMigrations(db, opts(REAL))).status).toBe('in-sync');
  });

  it('applies an additive migration and verifies the new column', async () => {
    const { db } = fresh();
    await runSafeMigrations(db, opts(REAL));
    const dir = withExtra('ALTER TABLE "llm_calls" ADD COLUMN "note" text;', (c) => (c.note = { name: 'note', type: 'text', primaryKey: false, notNull: false }));
    const r = await runSafeMigrations(db, opts(dir));
    expect(r.applied).toEqual(['0006_test']);
    expect(await columns(db)).toContain('note');
  });

  it('refuses destructive or breaking changes and leaves the database untouched', async () => {
    const { db } = fresh();
    await runSafeMigrations(db, opts(REAL));
    const before = await appliedCount(db);
    for (const sql of [
      'ALTER TABLE "llm_calls" DROP COLUMN "fallback";',
      'ALTER TABLE "llm_calls" ADD COLUMN "required_thing" text NOT NULL;',
      'ALTER TABLE "llm_calls" RENAME COLUMN "step" TO "stage";',
      'ALTER TABLE "llm_calls" ALTER COLUMN "model" SET DATA TYPE varchar(40);',
      'DELETE FROM "llm_calls";',
    ]) {
      await expect(runSafeMigrations(db, opts(withExtra(sql)))).rejects.toThrow(/could break the version serving traffic/);
    }
    expect(await appliedCount(db)).toBe(before);
    expect(await columns(db)).toContain('fallback');
  });

  it('rolls back an approved migration when the result does not match the code', async () => {
    const { db } = fresh();
    await runSafeMigrations(db, opts(REAL));
    const before = await appliedCount(db);
    const sql = '-- parallaxa:allow-destructive column unused since v2\nALTER TABLE "llm_calls" DROP COLUMN "fallback";';
    // The snapshot still expects the column: verification fails inside the transaction, so nothing changes.
    await expect(runSafeMigrations(db, opts(withExtra(sql)))).rejects.toThrow(/does not match the code/);
    expect(await columns(db)).toContain('fallback');
    expect(await appliedCount(db)).toBe(before);
    // With the code updated too, the approved change applies.
    const r = await runSafeMigrations(db, opts(withExtra(sql, (c) => delete c.fallback)));
    expect(r.applied).toEqual(['0006_test']);
    expect(r.warnings.some((w) => w.approved === 'column unused since v2')).toBe(true);
    expect(await columns(db)).not.toContain('fallback');
  });

  it('stops when released history was edited or a migration would be skipped', async () => {
    const { db } = fresh();
    await runSafeMigrations(db, opts(REAL));
    const edited = withExtra('SELECT 1;');
    fs.appendFileSync(path.join(edited, '0005_vendor_routing.sql'), '\n-- edited after release');
    await expect(runSafeMigrations(db, opts(edited))).rejects.toThrow(/were edited/);
    const old = readLocalMigrations(REAL)[0]!.when - 1;
    await expect(runSafeMigrations(db, opts(withExtra('SELECT 1;', undefined, { when: old })))).rejects.toThrow(/never ran/);
  });

  it('never lets a preview build migrate the production database', async () => {
    const { db } = fresh();
    await runSafeMigrations(db, opts(REAL, { environment: 'production', host: 'ep-prod.eu-central-1.aws.neon.tech' }));
    const dir = withExtra('ALTER TABLE "llm_calls" ADD COLUMN "note" text;', (c) => (c.note = { name: 'note', type: 'text', primaryKey: false, notNull: false }));
    await expect(runSafeMigrations(db, opts(dir, { environment: 'preview', host: 'ep-prod.eu-central-1.aws.neon.tech' }))).rejects.toThrow(/points at the production database/);
    expect(await columns(db)).not.toContain('note');
    // A preview on its own Neon branch (different host; the branch copied the production marker) may migrate.
    expect((await runSafeMigrations(db, opts(dir, { environment: 'preview', host: 'ep-branch.eu-central-1.aws.neon.tech' }))).applied).toEqual(['0006_test']);
  });

  it('is cautious when a preview cannot tell which database it has', async () => {
    const { db } = fresh();
    await expect(runSafeMigrations(db, opts(REAL, { environment: 'preview', host: 'ep-x.neon.tech' }))).rejects.toThrow(UnsafeMigrationError);
    expect((await runSafeMigrations(db, opts(REAL, { environment: 'preview', host: 'ep-x.neon.tech', mode: 'apply' }))).status).toBe('applied');
  });

  it('retries when the database is busy instead of waiting on locks', async () => {
    const { db } = fresh();
    let busy = 1;
    const flaky: SqlClient = {
      exec: db.exec,
      query: async (t, p) => {
        if (busy > 0 && t.includes('pg_advisory_xact_lock')) {
          busy--;
          throw Object.assign(new Error('canceling statement due to lock timeout'), { code: '55P03' });
        }
        return db.query(t, p);
      },
    };
    const lines: string[] = [];
    const r = await runSafeMigrations(flaky, opts(REAL, { log: (l) => lines.push(l) }));
    expect(r.status).toBe('applied');
    expect(lines.some((l) => l.includes('nothing was changed. Retrying'))).toBe(true);
  });

  it('recognises the same Neon database through pooled and direct hosts', () => {
    expect(normaliseHost('postgres://u:p@ep-cool-1234-pooler.eu-central-1.aws.neon.tech/db')).toBe(normaliseHost('postgres://u:p@ep-cool-1234.eu-central-1.aws.neon.tech/db'));
  });
});
