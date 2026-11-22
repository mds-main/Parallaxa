# Deploying Parallaxa (Vercel + Neon)

## 1. Project and database

```bash
vercel link                       # creates the project (choose the team); keep .vercel git-ignored
vercel integration add neon       # Neon Postgres via the Marketplace, EU region (AWS Frankfurt)
```

Functions are pinned to `fra1` in `vercel.json`. The build runs `pnpm db:migrate && pnpm build`, so migrations apply on each deploy.

## 2. Environment variables

Set these with `vercel env add <NAME> <environment>` (use the *sensitive* type for secrets). Names only are listed in `.env.example`.

| Name | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Injected by the Neon integration |
| `VENICE_API_KEY` | yes (production) | Without it the site runs in demo mode |
| `AI_GATEWAY_API_KEY` | recommended | Fallback when Venice fails |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | yes | Password ≥ 20 random characters, secret ≥ 32; use different values per environment |
| `ADMIN_IP_ALLOWLIST` | optional | Comma-separated IPs allowed into `/admin` |
| `DATA_ENCRYPTION_KEY` | yes | `openssl rand -base64 32`; encrypts push subscriptions and future account data |
| `CRON_SECRET` | yes | Vercel sends it to the cron routes |
| `NEXT_PUBLIC_SITE_URL` | yes | Public URL used in feeds and share links |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | for push | `npx web-push generate-vapid-keys` |
| `RESEND_API_KEY`, `ALERT_EMAIL_TO`, `ALERT_EMAIL_FROM` | for alerts | Resend, EU region |
| `BRAVE_SEARCH_API_KEY` | optional | Secondary search; otherwise Venice `/augment/search` is used |
| `EDGE_CONFIG`, `EDGE_CONFIG_ID`, `VERCEL_API_TOKEN` | optional | Fast config reads; token scoped to that Edge Config only |

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
- Set `BRIEFING_AUTO_PUBLISH` only on preview deployments (production editions wait for human review).
- Replace the seed gold set (`evals/gold-set.json`) with the fact-checker-graded set and set `evals/baseline.json`.
- Complete the legal items in TODO block 2 (terms, privacy policy, DPIA, insurance) before any public Ledger profile.
