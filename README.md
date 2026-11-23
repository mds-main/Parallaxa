# Parallaxa

**See it from both sides. Find where it really stands.**

Parallaxa is a calm, open, cross-partisan reality check. Paste a claim, a link or a screenshot: three AI models from different countries and perceived political leanings investigate it independently, a published rule combines their verdicts, and every source, quote and step is shown. A short daily briefing, an actor Ledger, a perception-gap quiz and a Trust Center complete it. No ads, no tracking, no engagement optimization.

- Product requirements: [`Parallaxa PRD_ A Calm, Open, Cross-Partisan Reality Check App.md`](./Parallaxa%20PRD_%20A%20Calm,%20Open,%20Cross-Partisan%20Reality%20Check%20App.md)
- Implementation plan and status: [`TODO.md`](./TODO.md)
- Deployment: [`docs/deployment.md`](./docs/deployment.md) · Adding a language: [`docs/adding-a-language.md`](./docs/adding-a-language.md)
- Prompts (public): [`prompts/`](./prompts) · Methodology (public): [`methodology/`](./methodology)

## Quick start

```bash
pnpm install
pnpm db:seed      # demo briefing editions (demo mode only)
pnpm dev          # http://localhost:3000
```

Without `VENICE_API_KEY` the app runs in **demo mode**: every AI step is simulated by a deterministic stand-in, and the site says so on every page and analysis. The local database is an embedded PGlite instance in `.data/` (no setup needed).

The admin console is at `/en/admin`. Set `ADMIN_USERNAME`, `ADMIN_PASSWORD` (at least 20 characters) and `ADMIN_SESSION_SECRET` (at least 32 characters) in `.env.local`; without them it stays disabled.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js development, production build, production server |
| `pnpm test` | Unit and integration tests (Vitest, demo mode, in-memory database) |
| `pnpm e2e` | End-to-end and accessibility tests (Playwright + axe, mobile and desktop) |
| `pnpm check:all` | Typecheck, lint, i18n catalogs and tests |
| `pnpm i18n:check` | Every registry language has every key; placeholders match; no Latin American terms in es-ES |
| `pnpm db:generate` / `pnpm db:migrate` | Create / safely apply Drizzle migrations (Neon when `DATABASE_URL` is set, otherwise PGlite); `db:migrate` runs on every build |
| `pnpm db:check` | Schema drift and migration safety rules; with `DATABASE_URL`, also pending migrations and schema verification (changes nothing) |
| `pnpm verify` | Everything before a push: `check:all`, end-to-end and accessibility tests, and the client-secret scan (there is no hosted CI) |
| `pnpm eval` | Release gate: gold-set accuracy, symmetry and language parity against `evals/baseline.json` (needs `VENICE_API_KEY`) |
| `pnpm eval` | Gold-set release gate (accuracy, mirror parity, language parity) |

## How it is built

| Area | Choice |
|---|---|
| App | Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript strict, Tailwind CSS 4 |
| Languages | `en` and `es-ES` (Spain only), driven by one registry in `src/i18n/languages.ts`; next-intl |
| Data | Drizzle ORM; Neon Postgres in production (EU), PGlite locally and in tests |
| AI | Venice (OpenAI-compatible) through a thin fetch client that passes `venice_parameters` exactly (web search, scraping, citations, X search, `include_venice_system_prompt: false`); Vercel AI Gateway as the default backup. Which vendor goes first, and whether the other backs it up, is a switch in Admin › Models |
| Hosting | Vercel (functions in `fra1`, Cron Jobs, Edge Config optional) |

### The pipeline (`src/lib/pipeline/run.ts`)

1. **Ingest**: text, a URL (fetched safely) or a screenshot (text read by a Private vision model).
2. **Canonicalize**: a Private model splits the input into atomic claims and removes personal data. Anonymized models only ever see these canonical claims.
3. **Cache**: exact hash and embedding similarity against earlier published analyses.
4. **Tag** places (ISO 3166-1/2) and topics (published taxonomy).
5. **Shared evidence pool**: secondary search + Venice web search.
6. **Independent investigations**: every perspective slot runs the same harness (`src/lib/ai/harness.ts`) with the same prompt and tools: Venice web search and scraping, X search on Grok, plus `search_web`, `fetch_source`, `query_primary_data` (World Bank, Eurostat, INE, BLS), `verify_quote`, `lookup_entity`, `find_past_analyses`, then `submit_verdict`.
7. **Aggregate** by the published rule (`src/lib/ai/aggregate.ts`): median grade, confidence drops with spread, "Models disagree" + human review at ≥ 2 steps, abstentions, conflict-of-interest exclusions.
8. **Mirror** claim stored for symmetry audits; **compose** the language-neutral analysis; **render** natively per language with a consistency check; **publish** (or hold for review).

### Model slots

| Slot | Default | Why |
|---|---|---|
| US-R | `grok-4-7` (xAI) | US model perceived as right-leaning; only one with X search |
| US-L | `openai-gpt-62-sol` (OpenAI) | US model perceived as left-leaning |
| CN | `deepseek-v4-pro` (DeepSeek) | Chinese model |

Swap them at any time in **Admin → Models** (test → optional shadow → activate). The change is versioned, audited and listed publicly at `/trust/models`.

## Licence

Code: AGPL-3.0-only. Prompts and methodology: CC BY 4.0. See [`LICENSE`](./LICENSE).
