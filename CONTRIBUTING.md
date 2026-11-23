# Contributing

- Open an issue before large changes. Methodology and prompt changes are reviewed by the cross-partisan panel.
- Run `pnpm verify` before opening a pull request (typecheck, lint, i18n, migrations, unit, end-to-end and accessibility, client-secret scan). There is no hosted CI. If you changed prompts, models or the pipeline, also run `pnpm eval` with a Venice key and include the result.
- Changes to `prompts/`, `src/lib/ai/` or `src/lib/pipeline/` must pass the gold-set eval gate.
- New user-facing copy needs English and Spain-Spanish translations (`pnpm i18n:check`).
- Code is AGPL-3.0-only; prompts and methodology are CC BY 4.0.
