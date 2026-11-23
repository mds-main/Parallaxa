# Deploying Parallaxa (Vercel + Neon)

## 1. Project and database

```bash
vercel link                       # creates the project (choose the team); keep .vercel git-ignored
vercel integration add neon       # Neon Postgres via the Marketplace, EU region (AWS Frankfurt)
```

Functions are pinned to `fra1` in `vercel.json`. The build runs `pnpm db:migrate && pnpm build`, so the database is checked, and migrated if needed, on every deploy (see **Database migrations** below). Only pushes to `main` deploy automatically (`git.deploymentEnabled` in `vercel.json`); other branches don't build. Run `vercel deploy` for a one-off preview. A preview without `DATABASE_URL` skips the database step and runs on the embedded demo database.

## Database migrations

Every build runs `pnpm db:migrate` (`scripts/db-migrate.ts`, `src/lib/db/migrate-safe.ts`). It either brings the database fully up to date and verified, or changes nothing and fails the build, so the live deployment keeps serving.

1. **Drift.** If `src/lib/db/schema.ts` changed without a generated migration, the build fails and prints the SQL that is missing. Fix: `pnpm db:generate`, commit the file.
2. **Safety rules.** While a migration runs, the previous version is still live, so changes must not break it. Blocked: dropping tables or columns, deleting data, renames, type changes, NOT NULL on existing columns, NOT NULL columns without a default, and new constraints or unique indexes on existing tables. Ship those in two deploys (add the new shape and switch the code; remove the old shape later). After review, a migration can opt in with a line `-- parallaxa:allow-destructive <reason>`.
3. **History.** An already-applied migration that was edited, or an old migration that never ran, stops the build. Never edit a released migration; add a new one.
4. **One transaction.** Pending migrations, their bookkeeping and a verification that every table and column in the latest Drizzle snapshot exists all run in one transaction, behind an advisory lock (concurrent builds wait their turn). `lock_timeout` is 5 s, so a migration never queues behind live traffic for long; on lock contention it rolls back and retries with backoff. Anything else rolls back and fails the build.
5. **Previews.** A preview build never migrates the production database. Production builds record the production database host; a preview whose `DATABASE_URL` points at the same host fails if it has unreleased migrations. Previews on their own Neon branch (recommended: enable preview branches in the Neon integration) migrate their branch normally.
6. **Restore point.** Before applying, the build logs the database time and WAL position for Neon point-in-time restore. With `NEON_API_KEY` and `NEON_PROJECT_ID` (optionally `NEON_BRANCH_ID`) set, production builds also create a Neon backup branch first, and do not migrate if that fails.

Options (environment variables): `MIGRATIONS=auto` (default) | `apply` (override the preview guard when the database is certainly separate) | `check` (never apply). `MIGRATION_LOCK_TIMEOUT`, `MIGRATION_STATEMENT_TIMEOUT` (Postgres intervals; defaults `5s`, `120s`). Migrations use `DATABASE_URL_UNPOOLED` when present.

Check any environment without changing it: `pnpm db:check` (with that environment's `DATABASE_URL` pulled to a file outside the repo).

## 2. Environment variables

Set these with `vercel env add <NAME> <environment>` (use the *sensitive* type for secrets). Names only are listed in `.env.example`.

| Name | Environments | Required | Notes |
|---|---|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | all | yes | Injected by the Neon integration (migrations use the unpooled one). Give previews their own Neon branch |
| `VENICE_API_KEY` | production, preview | yes | Without it the site runs in demo mode. A separate, lower-limit key for previews is safer |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | production, preview | yes | Password ≥ 20 random characters, secret ≥ 32; different values per environment. The secret also salts the daily IP hashes used for rate limits |
| `USER_SESSION_SECRET` | production, preview | yes | ≥ 32 characters. Enables the optional reader accounts (passkeys only, no email); without it accounts are switched off |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | production | yes for alerts | Admin alerts go to Telegram, never email. Bot from BotFather; get the chat id with `TELEGRAM_BOT_TOKEN=… pnpm telegram --find-chats`, test with `--test` or Admin › Alerts. Several chats: comma-separated |
| `LOG_LEVEL` | any | no | `debug`, `info` (default), `warn` or `error`. `debug` adds routine cron runs, unreadable pages and scrape fallbacks; see **Reading the logs** in `docs/runbooks.md` |
| `DATA_ENCRYPTION_KEY` | production, preview | yes | `openssl rand -base64 32`; encrypts push subscriptions and account data |
| `CRON_SECRET` | production | yes | Vercel sends it to the cron routes (`vercel.json`) |
| `NEXT_PUBLIC_SITE_URL` | production | optional | Public URL for feeds, share links and passkeys. Unset, production uses Vercel's `VERCEL_PROJECT_PRODUCTION_URL` (shortest custom domain, else `*.vercel.app`) and previews use their own address |
| `AI_GATEWAY_API_KEY` | production, preview | recommended | Backup AI vendor, or the primary if chosen in Admin › Models › AI vendors |
| `EXA_API_KEY` | production, preview | recommended | Default primary search engine (full page text). Order and backups: Admin › Investigation › Search engines |
| `BRAVE_SEARCH_API_KEY` | production, preview | optional | Default first backup search engine. Without Exa or Brave keys, searches use Exa or Brave through Venice (zero data retention) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | production | for push | `npx web-push generate-vapid-keys`; subject is a `mailto:` address |
| `ADMIN_IP_ALLOWLIST` | production | optional | Comma-separated IPs allowed into `/admin` |
| `EDGE_CONFIG`, `EDGE_CONFIG_ID`, `VERCEL_API_TOKEN` | production | optional | Fast config reads; token scoped to that Edge Config only |
| `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_BRANCH_ID` | production | optional | Neon backup branch before every production migration (see **Database migrations**) |
| `MIGRATIONS`, `MIGRATION_LOCK_TIMEOUT`, `MIGRATION_STATEMENT_TIMEOUT` | any | optional | Migration overrides (see **Database migrations**) |
| `BRIEFING_AUTO_PUBLISH` | preview only | optional | `1` publishes editions without human review. Never in production |

Never set in production: `PARALLAXA_DB` (local and test database), `VENICE_CATALOG_LIVE` (local development). Vercel sets `VERCEL_ENV` and `NODE_ENV` itself.

## 3. Cron jobs (vercel.json)

| Path | Schedule | Job |
|---|---|---|
| `/api/cron/catalog` | every 15 min | Venice model catalog sync; alerts on offline/deprecated/price changes of active models |
| `/api/cron/health` | every 5 min | Model pings, spend, error rate, latency, fallback and late-briefing alerts |
| `/api/cron/briefing` | every 15 min | Generates each place's edition at 05:00 local time |
| `/api/cron/push` | every 15 min | Sends the briefing notification at each subscriber's chosen time |
| `/api/cron/retention` | daily 03:30 UTC | Deletes short-lived data; aggregates telemetry first |
| `/api/cron/eval` | daily 02:00 UTC | Gold-set regression with alerting |

## 4. Before going public

- Firewall: add rate-limit rules for `/api/check`, `/api/dialogue`, `/api/report` and `/en/admin/login`, `/es/admin/login` in the Vercel Firewall; enable BotID for those routes.
- Replace the seed gold set (`evals/gold-set.json`) with the fact-checker-graded set and set `evals/baseline.json`.
- Complete the legal items in TODO block 2 (terms, privacy policy, DPIA, insurance) before any public Ledger profile.
