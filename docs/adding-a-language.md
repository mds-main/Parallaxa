# Adding a language

Parallaxa launches in English (`en`) and Spanish from Spain (`es-ES`). Every language-dependent part reads from the language registry, so adding a language is configuration and content work, with no changes to core code. Target: about 6 weeks of content work.

1. **Registry entry (disabled).** Add the language to `LANGUAGES` in `src/i18n/languages.ts` with `enabled: false`: BCP 47 tag, URL prefix, primary subtag, native name, text direction and `Intl` locale.
2. **UI catalogs.** Copy `messages/en/` to `messages/<tag>/`, have every file professionally translated and natively reviewed. `pnpm i18n:check` reports missing keys and placeholder mismatches.
3. **Reference content.** Add names in the new language to the topic taxonomy (`src/lib/data/topics.ts`) and places (`src/lib/data/places.ts`), the methodology (`methodology/<tag>/`) and the legal texts.
4. **Style guide and glossary** for the language (tone, form of address, institution names, neutral political vocabulary).
5. **Prompts.** Add `prompts/<tag>/render.md` and `prompts/<tag>/pushback.md`. Other steps use the English prompts on the language-neutral analysis.
6. **Gold set.** Add translated variants (`variantOf`) to `evals/gold-set.json` and pass the language-parity and fluency evals (`pnpm eval`).
7. **Native reviewers** join the review rota.
8. **Enable** the language (`enabled: true`). Browser detection, the switcher, `hreflang`, manifests, emails and tests pick it up automatically. Existing analyses render in the new language on first request.

The automated "add a language" dry run is the parameterized registry test in `src/i18n/negotiate.test.ts`.
