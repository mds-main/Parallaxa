# Working on Parallaxa

Read `TODO.md` section 0 first: it summarizes the product, the non-negotiable rules, the stack, languages, model slots and key numbers. The PRD has the full rationale.

## Commands
- `pnpm dev`, `pnpm build`, `pnpm start`
- `pnpm check:all` before every commit (typecheck, lint, i18n, tests, migration checks). There is no hosted CI: run `pnpm verify` (check:all, end-to-end and accessibility, client-secret scan) before pushing, and `pnpm eval` (release gate) before shipping prompt or model changes.
- `pnpm db:generate` after changing `src/lib/db/schema.ts`; commit the generated migration. Never edit a released migration. Migrations must not break the live version (no drops, renames, type changes or new NOT NULL without default); ship those in two deploys or mark the file `-- parallaxa:allow-destructive <reason>` after review. Builds apply migrations through `pnpm db:migrate` (see `docs/deployment.md`).

## Rules that must hold
- Truth over balance; values are never graded; "what each side gets right" may be empty.
- At least three perspective slots (≥ 2 origins, ≥ 3 vendors); identical neutral prompts for every slot; verdicts combined by `aggregateVerdicts`, never by a model.
- Raw user text only reaches Private models; Anonymized models get canonical, PII-free claims.
- `include_venice_system_prompt: false` on every Venice call (enforced in `src/lib/ai/client.ts`).
- No hard-coded locale lists: read `src/i18n/languages.ts`. Spanish is `es-ES` only (no Latin American terms).
- Every admin page and server action calls `requireAdmin` / `getAdminSession` itself.
- Personalization filters by place and topic only, never by side; analyses are identical for everyone.
- WCAG 2.2 AA; grades use shape + label, never colour alone.
- No PII in logs, URLs or model requests; no third-party scripts.
