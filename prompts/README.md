# Parallaxa prompts (CC BY 4.0)

These are the exact instructions every model receives. They are public so anyone can check them.

- One folder per language (`prompts/<lang>/`), following the language registry in `src/i18n/languages.ts`.
- Steps that work on the language-neutral analysis use the English prompt. Steps that write for readers
  (`render`, `pushback`) have a native prompt per language. If a language has no file for a step, the English one is used.
- **Every perspective slot gets the same `investigate` prompt.** No model is ever asked to take a political side.
- The prompt version is set in the admin console (Pipeline → prompt version) and recorded with a content hash on every analysis.
