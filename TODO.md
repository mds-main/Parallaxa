# TODO.md: Parallaxa implementation plan

This file lists **every block of work, and every task inside each block**, needed to build Parallaxa from an empty repository to a public product. It is self-contained: section 0 gives all the context needed to work from it. The PRD (`Parallaxa PRD_ A Calm, Open, Cross-Partisan Reality Check App.md`) holds the research, rationale and full specs, and the section references (e.g. "PRD 6.1") point there for detail.

**How to use it**
- `- [ ]` open, `- [x]` done. Tick tasks in the same PR that completes them.
- Task IDs (`12.4`) are stable. Reference them in commits, PRs and `needs:` notes.
- Phase tags: **[P0]** Foundations (months 0–2) · **[P1]** MVP closed beta (months 2–5) · **[P2]** Public launch (months 5–9) · **[P3]** Expansion (months 9–18).
- `needs:` lists hard dependencies. Anything without one can start once its block's earlier tasks allow.
- Every user-facing task also meets the **Definition of done** in 0.9.

---

## Status (23 Nov 2026)

The application is implemented on branch `feat/mvp-implementation`: public site (Check, Today, Ledger, quiz, Trust Center, Your Parallaxa, onboarding, PWA), the full pipeline with three perspective slots and the Venice investigation harness, rule-based aggregation, corrections, briefing generation, push, cron jobs, the admin console, and unit, end-to-end and accessibility tests. Ticked tasks below are done in code; partially done tasks stay open. Implementation choices that differ from the plan: a thin fetch client instead of the AI SDK (to pass `venice_parameters` exactly); first-party magic links + passkeys instead of Auth.js/Neon Auth (no email stored); source snapshots in Postgres instead of Vercel Blob (private by default); embeddings as `real[]` with app-side similarity until pgvector is needed.

**Needs you (cannot be done from code):** a Venice API key (the site runs in labelled demo mode without it), Vercel and Neon provisioning and env vars (`docs/deployment.md`), Firewall/BotID rules, and every organizational, legal and editorial task in blocks 2 and 3 (entity, DPIA, panel, fact-checker gold set, legal review of the Ledger).

**Main open engineering items:** pgvector at scale, named reviewer accounts, offline background sync, Row-Level Security roles, and the Phase 2/3 features (community review, prediction tracker, prebunk lessons, browser extension, debate maps, common-ground rooms).

## 0. Project at a glance

### 0.1 What Parallaxa is
A calm, open, cross-partisan "reality check" web app (installable PWA). It checks political claims from every side with **one published standard**, shows all its work, and helps reduce polarization with evidence-based tools. It does not optimize for engagement. It is run as a non-profit, with no ads and no tracking.

### 0.2 Features
| ID | Feature | One line |
|---|---|---|
| F1 | **Check** (truth-seeking pipeline) | Paste a claim, link, image or video URL and get a sourced, graded, multi-model analysis in < 60 s |
| F2 | **Daily Parallax** | A finite morning briefing of 3–5 stories, assembled from human-reviewed editions per place |
| F3 | **Actor Ledger** | Behaviour-based track records of politicians, parties, media and influencers, with right of reply and appeals |
| F4 | **Depolarization tools** | Side-by-side card, perception-gap quiz, steelman, moral reframing, "Push back" dialogue |
| F5 | **Trust Center** | Open methodology and prompts, audits, cross-partisan panel, funding, corrections log |
| F6 | **Your Parallaxa** | Places (global / country / region), topics (follow / mute), follows, subscriptions, briefing settings |
| F7 | **Languages** | `en` and `es-ES` at launch, detected from the browser with English as fallback; a language registry makes adding more a content task |
| F8 | **Admin console** | `/admin` behind `ADMIN_USERNAME`/`ADMIN_PASSWORD`: swap models, tune every relevant setting, monitor the main metrics |

### 0.3 Non-negotiable rules (every task must respect them)
1. **Truth over balance:** symmetric *rules*, not symmetric *outcomes*. "What each side gets right" sections may be empty. Never split the difference.
2. **Facts, values and predictions are separate.** Value questions are never graded true or false.
3. **At least three perspective models investigate every claim independently:** a US model perceived as right-leaning (e.g., Grok), a US model perceived as left-leaning (e.g., GPT, Claude or Gemini) and a Chinese model (e.g., DeepSeek or Kimi). All get the same neutral prompts, a published rule combines their verdicts, and disagreement is shown, never hidden.
4. **Show the work:** sources, verbatim quotes, reasoning, confidence, model IDs, prompt version and provider on every analysis.
5. **Calm by design:** no infinite feed, outrage ranking, streaks, "dunk" sharing, ads or third-party trackers. Engagement is never a goal.
6. **Personalization is by place and topic only, never by side or outlet.** Analyses are identical for everyone.
7. **Privacy:** anonymous by default, preferences stored on the device, Art. 9 data encrypted and separate, EU data residency, no user identifiers sent to model providers.
8. **Ledger language describes conduct, never character.** No crime allegations without a final ruling.
9. **Spanish is `es-ES` (Spain) only.** Never Latin American Spanish.
10. **Accessibility:** WCAG 2.2 AA everywhere. No colour-only meaning, and never red/blue/party colours for sides.
11. **Model and setting changes are versioned, reasoned, audit-logged and reversible**, and model-lineup changes are public on the Trust Center.

### 0.4 Tech stack (decided unless marked *decide*)
| Area | Choice |
|---|---|
| App | Next.js (App Router, RSC, TypeScript strict), pnpm |
| Hosting | Vercel Pro, functions pinned to `fra1`, Fluid compute (Node.js runtime, never Edge for the pipeline) |
| Durable jobs | Vercel Workflow + Vercel Queues (fallback: Postgres job table + cron drain) |
| Database | Neon Postgres (EU, AWS Frankfurt) via Vercel Marketplace, pgvector, RLS, preview branch per PR |
| ORM / validation | Drizzle ORM + drizzle-kit migrations; Zod for every schema (API, AI output, env) |
| Storage / config | Vercel Blob (private), Edge Config (active configuration version: model slots, harness and pipeline settings, flags, kill switches), Marketplace Redis/KV (circuit breaker, rate counters) |
| AI | AI SDK (tool calling, `generateObject` / `streamText`), Venice (OpenAI-compatible, primary) with web search, scraping and X search (Grok), Vercel AI Gateway (fallback) |
| Admin | `/admin` route group in the same app; env-var login (`ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`); forms generated from a Zod settings schema; *decide:* chart library |
| Untrusted fetching | Vercel Sandbox with egress allow-list |
| Security edge | Vercel Firewall/WAF, BotID |
| Auth | First-party passkeys (SimpleWebAuthn); no email, no passwords |
| Notifications | No email anywhere. Readers: Web Push (browser and installed PWA). Admins: Telegram bot |
| i18n | next-intl, ICU messages; *decide:* translation management (git-based JSON with PR review, or Tolgee/Crowdin/Lokalise) |
| UI | *decide:* Tailwind CSS + accessible headless primitives (e.g., Radix) or a custom CSS-variables system |
| PWA | Serwist (or equivalent) service worker, Web Push (VAPID) |
| Testing | Vitest, Playwright (mobile/tablet/desktop), axe-core, LLM eval harness |
| Observability | Vercel Observability, Speed Insights, cookieless Web Analytics, OpenTelemetry |
| Licences | Code AGPL-3.0, methodology and prompts CC BY 4.0 |

### 0.5 Languages (F7)
| Language | Locale | URL prefix | Browser match (primary subtag) |
|---|---|---|---|
| English | `en` | `/en` | `en-*` (and the fallback for anything unmatched) |
| Spanish (Spain) | `es-ES` | `/es` | every `es-*` (incl. `es-MX`, `es-419`); **no Latin American variant exists** |

Resolution order: URL prefix → saved choice (account setting or `NEXT_LOCALE` cookie) → `Accept-Language` in q-order, first enabled primary subtag → `en`. Language is independent of place and never inferred from IP. All language behaviour comes from one **language registry**, so adding a language later (candidates: French, German, Italian, Portuguese) needs a registry entry plus content, not code changes (block 4.C).

### 0.6 AI perspectives and investigation harness
| Slot | Meaning | Default model (Nov 2026 Venice catalog) | Alternatives | Privacy | X search |
|---|---|---|---|---|---|
| US-R | US model, perceived right-leaning | xAI Grok `grok-4-7` | other Grok versions | Private | Yes |
| US-L | US model, perceived left-leaning | OpenAI `openai-gpt-62-sol` | Claude `claude-sonnet-5-5`, Gemini `gemini-4-carbon` | Anonymized (canonical claim + public sources only) | No |
| CN | Chinese model | DeepSeek `deepseek-v4-pro` | Kimi `kimi-k3`, GLM `z-ai-glm-5-3`, Qwen | Private | No |

- **Labels describe published perceptions, not instructions.** Every slot gets identical neutral prompts. Up to 5 slots; invariants: ≥ 3 slots, ≥ 2 origins, ≥ 3 vendors, no vendor > 50% of adjudication volume.
- **Harness (same for every slot):** an agentic tool loop starting from a shared evidence pool.
  - Venice web search, scraping and citations on every slot; X search on Grok slots.
  - Parallaxa tools: secondary search, sandboxed fetch, primary-data connectors, quote verification, Wikidata, past analyses.
  - Verdict via `json_schema`.
- **Requirements to be selectable:** `supportsFunctionCalling`, `supportsResponseSchema`, `supportsWebSearch`, online, not deprecated, context ≥ 128k, allowed privacy tier.
- **Combining verdicts:** by rule (median grade; spread lowers confidence; ≥ 2 grade steps apart → "Models disagree" + human review). Refusals count as abstentions. A slot's conflict-of-interest topics exclude its vote.
- **Swaps:** done in the admin console. Choose → Test (harness check) → optional Shadow → Activate, live in ~10 s without a deploy. Post-swap eval and one-click rollback.

### 0.7 Places and topics (F6)
- Places: Global · Country (ISO 3166-1) · Region (ISO 3166-2 first level). Up to 5 per user, one marked home, each in Focus or Include mode. Nothing finer than region.
- Launch coverage: Global, Spain, US country editions, and 2–3 pilot Spanish autonomous communities (P1). Then all Spanish regions, the largest US states, and the UK and Mexico (P2). Then new languages with their country editions (P3).
- Topics: a published two-level taxonomy (~20 topics, ~150 subtopics), each Follow / Neutral / Mute. Muting never affects Check.

### 0.8 Key numbers
- Check: p50 < 25 s for cached-similar claims, p95 time-to-first-result < 20 s, hard limit < 60 s; availability 99.5%.
- Semantic cache reuse at pgvector similarity ≥ 0.92. Graded facts need ≥ 2 independent sources, ≥ 1 of them T1/T2. Quotes ≤ 25 words, verified verbatim.
- Investigation budget per slot: 12 tool calls, 4 web searches, 3 X searches, 5 scraped URLs, 90 s. Fresh analysis cost ~$0.35–$0.50 (default lineup), ~$0.20–$0.30 (economy lineup).
- Model swap live for new analyses within ~10 s. Admin session 8 h (30 min idle); lockout after 5 failed logins in 15 min.
- Model timeouts: first token 8 s; 45 s per step (90 s for an investigation). Circuit breaker opens after 5 failures in 60 s or p95 > 3× baseline; half-open probe every 30 s.
- Briefing: editions generated at 05:00 local time and reviewed by 07:00, ready by 06:45 on 99% of days; ≤ 5 stories; ≤ 6 minutes to read.
- Notifications: ≤ 1 routine per day plus ≤ 3 requested follow-ups per day.
- Rate limits: 20 checks/hour anonymous, 60 signed-in. Push back dialogue: ≤ 10 turns.
- Corrections published < 72 h after a validated report (target median < 48 h). Ledger replies published ≤ 5 business days after verification; re-review ≤ 10 business days.
- Ledger: no dimension score before n ≥ 10 analyzed claims. Aggregates use k-anonymity ≥ 50.

### 0.9 Definition of done (every user-facing task)
- [ ] Copy exists in every enabled locale (`en`, `es-ES`; no missing keys), with es-ES reviewed natively. No hard-coded locale lists (everything reads the language registry).
- [ ] WCAG 2.2 AA: axe clean, keyboard and screen-reader tested, targets ≥ 24×24 px, contrast ≥ 4.5:1, respects `prefers-reduced-motion`.
- [ ] Works at mobile (< 640 px), tablet (640–1024 px) and desktop (> 1024 px), including +40% pseudo-locale text expansion.
- [ ] Unit tests and a Playwright E2E path. LLM-touching changes pass the eval release gate (block 23).
- [ ] No PII in logs, URLs or model requests. No third-party scripts.
- [ ] Observability: OpenTelemetry spans and cost tracking where models are called.

---

## 1. Milestones and exit criteria

- [ ] **M0: Foundations complete [P0].** Legal entity exists; name cleared; methodology v1, taxonomy v1 and place list published; gold set v1 (500 claims, en + es) ready; panel recruited; DPIA signed off; Spanish translator and native reviewers contracted; repo, infra and local checks (`pnpm verify`) running with an empty localized shell deployed; admin login and Models page working with the three default slots passing the harness check.
- [ ] **M1: Closed beta [P1].** F1, F2 (Global + ES + US + 2–3 Spanish regions), F4 (side-by-side, quiz ES/US, steelman, Push back), read-only F3 (parties + national leaders), F5, F6 core, F7 (`en` + `es-ES`, registry ready for more) and F8 (admin console with models, settings, metrics, alerts, audit log) live for invited users, with three perspective slots investigating every claim. Eval gates are green, the first symmetry report is published internally, and SLOs have been met for 2 weeks.
- [ ] **M2: Public launch [P2].** Full Ledger with reply and appeals; regional actors; community review (invite-only); prediction tracker; prebunk lessons; UK and Mexico country editions; named admin accounts; all Spanish regions and the largest US states; email digest and RSS; first public symmetry audit; first RCT running.
- [ ] **M3: Expansion [P3].** Browser extension, debate maps, common-ground rooms pilot, first additional language(s) via the playbook with their country editions, municipal-scope pilot, institutional licences, external audit published.

---

## 2. Organization, legal and governance
- [ ] 2.1 [P0] Choose the legal home (Spain *fundación*, Dutch *stichting* or Ireland) with counsel, weighing defamation exposure and funding access; incorporate.
- [ ] 2.2 [P0] Write and publish the funding policy: no donor > 10% of the annual budget; no party, government or platform-company money; donors > €1,000 published; no model vendor > 50% of adjudication volume.
- [ ] 2.3 [P0] Name clearance: registrar checks for parallaxa.app/.eu/.es/.com/.org (fallbacks getparallaxa.app, parallaxa.eu); EUIPO, OEPM and USPTO knockout searches in Classes 9, 38, 41 and 42; counsel clearance opinion; register the chosen domains and file the trademark.
- [ ] 2.4 [P0] DPIA covering profiling of public figures, Art. 9 data (political self-placement, topic/place preferences), AI processing and EU residency; legitimate-interest assessment for the Ledger.
- [ ] 2.5 [P0] DPAs with Vercel, Neon, Venice, AI Gateway upstream providers, Telegram, the search API providers and the KV provider; record of processing activities.
- [ ] 2.6 [P0] Legal opinion on GDPR Art. 85 journalistic exemption, Spanish LO 1/1982 (honour) and LO 2/1984 (rectification), criminal defamation exposure, and the equivalent regimes in the UK and Mexico [P2] and in each country whose edition is added later [P3].
- [ ] 2.7 [P0] EU AI Act Art. 50 compliance plan: AI-interaction disclosure and machine-readable marking of AI-generated content.
- [ ] 2.8 [P1] DSA readiness review (point of contact, terms) and check for small-enterprise exemptions; full notice-and-action when user content is hosted [P2] (needs: 27).
- [ ] 2.9 [P0] Terms of service, privacy policy, cookie statement (cookieless; essential cookies only) and AI disclosure, in English and Spanish, legally reviewed, with the governing version stated.
- [ ] 2.10 [P1] Media liability insurance in place before any public Ledger profile.
- [ ] 2.11 [P0] Recruit the cross-partisan review panel: ≥ 9 paid, rotating members balanced across left, centre and right (Spain, US, LatAm, plus members from each new country before its edition launches); publish bios; panel charter (decisions need one member from each bloc; conflicts-of-interest rules).
- [ ] 2.12 [P0] Sign academic partners for the gold set, perceived-slant panels, RCTs and audits; agree data-sharing and publication terms (all results published, including nulls).
- [ ] 2.13 [P1] Rectification and right-of-reply procedure meeting LO 2/1984 deadlines, documented for staff and published in English and Spanish.
- [ ] 2.14 [P2] External annual audit contract with a university team from another country.
- [ ] 2.15 [P0] Hire or contract the minimal team (4–6: engineering, editorial, ops) plus native Spain-Spanish reviewers.
- [ ] 2.16 [P0] Review acceptable-use and data terms for every model vendor reached through Venice (xAI, OpenAI, Anthropic, Google, DeepSeek, Moonshot/Kimi, Zhipu/GLM, Alibaba/Qwen), including export-control and sanctions checks for Chinese models.

## 3. Methodology and editorial standards (published under CC BY 4.0)
- [x] 3.1 [P0] Claim types and definitions: Fact, Value, Prediction, Attribution, Framing.
- [x] 3.2 [P0] Evidence grades and definitions: Well supported · Mostly supported · Mixed/contested · Missing context · Mostly unsupported · Contradicted by evidence · Not checkable (yet). Confidence levels High/Medium/Low, with reason templates.
- [x] 3.3 [P0] Source tiers T1–T4 with examples per launch country (statistics offices, courts, legislation, peer review, wires, outlets across the spectrum); the "≥ 2 independent sources, ≥ 1 T1/T2" rule.
- [x] 3.4 [P0] Manipulation-technique catalogue (cherry-picked window, base-rate neglect, misleading axis, correlation→causation, out-of-context clip, AI-generated media), with examples drawn equally from all sides.
- [ ] 3.5 [P0] Mirror-test protocol: how to build the structurally equivalent opposite-side claim, the parity tolerance (±0.1 ordinal), and logging and publication.
- [ ] 3.6 [P0] Briefing selection rules (cross-outlet salience on both sides, virality of contested claims, upcoming decisions) and "outside your filters" salience rules.
- [ ] 3.7 [P0] Ledger rubric v1: seven dimensions, minimum samples, reach weighting, confidence, conduct-only phrasing rules, positive signals; legal review (needs: 2.6).
- [ ] 3.8 [P0] Corrections policy (versioning, public diff, reasons, 72 h SLA) and appeals policy (two stages).
- [ ] 3.9 [P0] Topic taxonomy v1: ~20 topics and ~150 subtopics with neutral names in English and Spanish, country-specific subtopics mapped to neutral parents; panel review; versioning rules.
- [x] 3.10 [P0] Place list: ISO 3166-1 countries and ISO 3166-2 first-level regions for launch countries; official local names; time zones; coverage-level criteria (Full / Partial / Limited) and the threshold for a regional edition.
- [ ] 3.11 [P0] Left/right labelling rules per country for the side-by-side card (e.g., Spain "izquierda/derecha" plus party families; no logos or party colours).
- [ ] 3.12 [P0] Gold set v1: 500 claims balanced by side, country and language, graded by fact-checkers of different orientations plus academics; each claim professionally translated into the other launch language (grows to ≥ 1,000 by P2; needs: 2.12).
- [x] 3.13 [P0] Publish methodology v1 in the public repo (`/methodology`) and in the Trust Center in English and Spanish.
- [x] 3.14 [P0] Verdict aggregation rule (median grade, spread → confidence, disagreement threshold, abstentions for refusals, conflict-of-interest exclusions) and conflict-of-interest topic lists per model family, published in the methodology.
- [x] 3.15 [P0] Methodology page explaining the perspective slots, what "perceived leaning" means (with the research behind it), and why every slot gets identical neutral prompts.

## 4. Languages and localization (F7)
Launch languages: `en` and `es-ES` (Spain Spanish only). Everything is built so that adding a language later is configuration and content work, not code.

### 4.A Engineering
- [x] 4.1 [P0] Language registry (`src/i18n/languages.ts`): the single source of truth per language (BCP 47 tag, URL prefix, primary-subtag matcher, native name, `dir`, `Intl` locale, enabled flag). Middleware, switcher, sitemaps, `hreflang`, manifests, emails, automated checks, prompt loading and evals all read from it. Launch entries: `en`, `es-ES`.
- [x] 4.2 [P0] Lint rule forbidding hard-coded locale lists or locale literals outside the registry.
- [x] 4.3 [P0] next-intl configured from the registry; URL prefixes `/en` and `/es`; default and fallback `en`.
- [x] 4.4 [P0] Locale negotiation in Routing Middleware, in order: URL prefix → `NEXT_LOCALE` cookie or account setting → `Accept-Language` by q-value, primary-subtag match among *enabled* languages (`es-*`→`es-ES`, `en-*`→`en`) → `en`. Never use IP. Redirect `/` to the resolved prefix (302, `Vary: Accept-Language, Cookie`).
- [x] 4.5 [P0] Negotiation tests: `es-MX,es;q=0.9`→es-ES; `es-419`→es-ES; `ca,es;q=0.8,en;q=0.5`→es-ES; `en-GB`→en; `fr-FR,de;q=0.8`→en; empty header→en; cookie overrides header; URL overrides cookie. Plus a parameterized suite that runs for every registry entry, so new languages are covered automatically.
- [x] 4.6 [P0] Language switcher (header menu, settings, onboarding) listing enabled languages by their own names ("English", "Español"), never flags. It persists the choice (cookie or account) and keeps the current path.
- [x] 4.7 [P0] Message catalogs at `messages/<lang>/<namespace>.json`, English as source, ICU plurals/select, generated TypeScript key types.
- [x] 4.8 [P0] i18n checks (`pnpm i18n:check`, part of `check:all`) that loop over the registry: missing keys, unused keys, ICU syntax, placeholder parity. An enabled language can have no gaps; a disabled, in-progress language may.
- [ ] 4.9 [P0] Pseudo-locale (accented, +40% length) registered as a dev-only language; Playwright snapshots in pseudo and es-ES at all breakpoints, so longer future languages (German, French) fit without redesign.
- [x] 4.10 [P0] Formatting helpers on `Intl` (dates, relative time, numbers, percentages, currency, lists) per locale; device time zone; never hand-formatted strings.
- [x] 4.11 [P0] `lang` on `<html>` and on every mixed-language fragment (original-language quotes, source titles); `hyphens: auto`; logical CSS properties with `dir` from the registry (RTL-ready); font stack with full Latin Extended coverage.
- [x] 4.12 [P0] Language columns stored as BCP 47 text validated against the registry (no database enums) in users, analysis renderings, subscriptions and email logs, so a new language needs no migration.
- [x] 4.13 [P1] Per-language enable flag in Edge Config for a staged rollout (staff → beta → everyone) without a redeploy. It can only be switched on when the catalogs are complete and the parity evals pass.
- [x] 4.14 [P1] SEO generated from the registry: locale-prefixed public URLs, `hreflang` for every enabled language plus `x-default`→`/en`, localized `<title>`, meta description and Open Graph, localized sitemaps.
- [x] 4.15 [P1] Localized PWA manifests per language (`lang`, `description`, shortcuts, `start_url` with prefix); serve the one matching the active locale (needs: 20.1).
- [x] 4.16 [P1] Push payloads in the recipient's saved language (no email is sent).
- [x] 4.17 [P1] Localized share cards (OG images) in the sharer's language.
- [x] 4.18 [P1] es-ES lexicon linter for UI catalogs and sampled model output, flagging Latin American-only terms and forms ("ustedes" as informal plural, "computadora", "celular", "carro", "manejar" for driving, etc.); runs in `pnpm check:all` and in the nightly eval.
- [ ] 4.19 [P1] Translation workflow: export new and changed keys → professional translation → native review → import via PR; *decide* git-only vs a translation management system; glossary enforcement.
- [x] 4.20 [P1] "Add a language" dry run as an automated test: register the pseudo-locale as a test language and confirm that nothing outside the registry, `messages/`, `prompts/` and `methodology/` has to change.

### 4.B Content and operations
- [ ] 4.21 [P0] Style guides for en and es-ES: tone (curious, plain, non-humiliating), form of address (es-ES "tú"/"vosotros"; a direct "you" in English), English spelling convention, number style, quotation marks, inclusive-language policy.
- [ ] 4.22 [P0] Glossaries for en and es-ES: grade names, claim types, technique names, Ledger dimensions, neutral political vocabulary per country, institution names (Spain's terms only in Spanish, e.g. "Congreso de los Diputados", "comunidad autónoma", "ordenador").
- [ ] 4.23 [P1] Translate and natively review all UI copy, onboarding, Trust Center, methodology, legal texts, emails and notifications into es-ES.
- [ ] 4.24 [P1] Native Spain-Spanish reviewer rota in the review console (needs: 21) for briefings, Ledger text and sampled analyses.

### 4.C Adding a language later (playbook)
- [x] 4.25 [P1] Write `docs/adding-a-language.md`:
  1. Add a disabled registry entry.
  2. Translate and natively review the UI catalogs, taxonomy, place and grade names, Trust Center, methodology and legal texts.
  3. Write the style guide and glossary.
  4. Add renderer prompts and few-shot examples in `prompts/<lang>/`.
  5. Translate the gold set and pass the parity and fluency evals.
  6. Recruit native reviewers.
  7. Turn the flag on for staff, then beta, then everyone.

  Target: ≤ 6 weeks of content work and no core code changes.
- [ ] 4.26 [P3] Add the first new language through the playbook (candidates: French, German, Italian, Portuguese), together with its country edition.

## 5. Repository and tooling
- [x] 5.1 [P0] Scaffold Next.js (App Router, TS strict, `src/` layout), pnpm, Node LTS pinned (`.nvmrc`, `engines`).
- [x] 5.2 [P0] ESLint, Prettier, typecheck, import boundaries (`app/`, `features/*`, `lib/*`, `server/*`), conventional commits.
- [x] 5.3 [P0] Vitest with coverage; Playwright projects for mobile, tablet and desktop in Chromium, WebKit and Firefox; axe-core integration.
- [x] 5.4 [P0] No hosted CI/CD by decision (Nov 2026; GitHub Actions and Dependabot removed). The same checks run locally: `pnpm verify` (typecheck, lint, i18n 4.8, migrations, unit, E2E with axe, client-secret scan) before every push, `pnpm eval` (23.6) before prompt or model changes, `pnpm audit:deps` for dependencies. Deploys build on Vercel, which runs the safe migrations (5.7a).
- [x] 5.5 [P0] Renovate config, pnpm lockfile enforcement, dependency review.
- [x] 5.6 [P0] Licences: AGPL-3.0 for code, CC BY 4.0 for `/methodology` and `/prompts`; `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`.
- [x] 5.7 [P0] Env var schema with Zod (fail fast on boot) covering `VENICE_API_KEY`, `AI_GATEWAY_API_KEY`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, optional `ADMIN_IP_ALLOWLIST`, Edge Config and Vercel API tokens, database and email keys; `.env.example` with names only; secrets never committed.
- [x] 5.7a [P0] Safe migrations on every build (`pnpm db:migrate`): schema-drift check, safety rules for the live version (opt-in marker for reviewed destructive changes), history integrity, one locked and verified transaction with lock-timeout retries, preview builds never migrate the production database, restore point and optional Neon backup branch. `pnpm db:check` in `check:all`.
- [x] 5.8 [P0] `CLAUDE.md`/`AGENTS.md` for the repo: stack, commands, non-negotiable rules (0.3), locale rules (0.5), model-slot rules (0.6).
- [x] 5.9 [P0] Seed and fixture scripts: places, topics, sample analyses in en and es-ES, demo actors (fictional) for previews and tests.

## 6. Infrastructure and platform (Vercel + Neon)
- [ ] 6.1 [P0] Create the Vercel project (Pro), link the repo, pin functions to `fra1`, enable Fluid compute; set up production and preview environments.
- [ ] 6.2 [P0] Provision Neon via Vercel Marketplace in the EU (AWS Frankfurt): Free plan for prototyping, Launch for production; branch per preview deployment, auto-deleted on PR close; production minimum 0.25 CU, autoscaling max 2 CU; scale-to-zero only for previews.
- [ ] 6.3 [P0] Enable pgvector; configure the pooled connection string for functions; `@neondatabase/serverless` (HTTP for one-shot queries, WebSocket for transactions).
- [ ] 6.4 [P0] Vercel Blob store (private, signed URLs) for screenshots and source snapshots.
- [x] 6.5 [P0] Edge Config: active configuration version (model slots, harness and pipeline settings), feature flags, language flags, circuit-breaker overrides, kill switches (per feature and per locale); written only by the admin publish flow (22.9).
- [ ] 6.6 [P0] Marketplace Redis/KV for circuit-breaker state, rate counters and short-lived caches.
- [ ] 6.7 [P0] Vercel Workflow for the analysis pipeline and Queues for retrieval fan-out; verify availability in region and plan, otherwise implement a Postgres job table plus cron drain.
- [x] 6.8 [P0] Cron jobs (`vercel.json`): edition generation per place at 05:00 local, nightly evals, 1-minute model health checks, cache warmers, retention purge, corrections RSS rebuild, symmetry-report aggregation.
- [ ] 6.9 [P1] Vercel Firewall/WAF rules and rate limits on `/api/check`, `/api/dialogue`, `/api/rate`; BotID on write and LLM-triggering endpoints; WAF rule and rate limit on `/admin/login`; attack challenge mode runbook.
- [ ] 6.13 [P0] Vercel API token scoped to the Edge Config store only, used by the admin publish flow; stored as a sensitive env var.
- [x] 6.10 [P0] Security headers: strict nonce-based CSP, HSTS preload, `frame-ancestors 'none'`, Referrer-Policy, Permissions-Policy.
- [ ] 6.11 [P1] Rolling Releases and an instant-rollback runbook; production promotion requires the eval gate to be green.
- [ ] 6.12 [P0] Custom domains (needs: 2.3), with locale-prefix routing working on them.

## 7. Data model and database
- [x] 7.1 [P0] Drizzle schema and migrations for: `users`, `user_political_self_id` (separate table, separate key), `user_preferences` (encrypted), `subscriptions`, `places`, `topics`, `claims` (with `embedding vector(1024)`), `claim_places`, `claim_topics`, `analyses` (versioned, immutable), `analysis_renderings` (per language), `analysis_sources`, `sources`, `outlets`, `actors`, `actor_places`, `actor_claims`, `actor_dimension_scores`, `actor_replies`, `appeals`, `corrections`, `briefing_editions`, `edition_stories`, `quiz_items` (+ translations), `quiz_responses` (no user_id), `error_reports`, `review_tasks`, `audit_log`, `llm_calls` (with slot, searches, finish reason), `analysis_verdicts` (per-slot verdicts), `config_versions`, `eval_runs`, `admin_sessions`, `metrics_daily` (aggregate only), `jobs` (if the Workflow fallback is used). Language columns are BCP 47 text, never enums (4.12).
- [ ] 7.2 [P0] Row-Level Security on user-owned rows; DB roles (app, reviewer, admin, analytics read-only).
- [x] 7.3 [P0] Application-level AES-256-GCM encryption helpers with key IDs and rotation: separate key classes for political self-ID, preferences and push subscriptions.
- [ ] 7.4 [P0] pgvector indexes (HNSW) for the claim semantic cache and source dedup; text-hash unique index.
- [x] 7.5 [P0] Content-addressed cache keys: claim hash + model set + prompt version (+ language for renderings).
- [x] 7.6 [P0] Seed places (ISO 3166-1/2 with names in English and Spanish plus local official names, time zones, coverage level) and topics (taxonomy v1) (needs: 3.9, 3.10).
- [x] 7.7 [P1] Retention jobs: daily-salted IP hashes deleted after 7 days; logs after 30 days; account-linked query text de-linked after 90 days.
- [ ] 7.8 [P1] Backups and restore drill (Neon point-in-time restore); old snapshots archived to Blob.

## 8. Design system and app shell
- [x] 8.1 [P0] Design tokens: paper `#F7F5F0`, ink `#1C1F24`, ochre accent `#C98A1B`, monochrome intensity scale; no red/blue/purple/green/orange/teal as semantic colours; editorial type scale with full Latin Extended coverage (ç, ß, ã, õ, ñ, à, è…).
- [x] 8.2 [P0] Verdict chip: one distinct shape per grade + word label + monochrome intensity (never colour-only), in every supported language.
- [x] 8.3 [P0] Core components: input box (text/URL/image/voice), cards, tier badges, confidence indicator, model-agreement indicator, banners ("Models disagree", "Backup provider", "Stale data"), side sheet, tabs, disclosure/accordion, toasts, empty states.
- [x] 8.4 [P0] App shell: header with scope chip and language menu; bottom nav on mobile (Check · Today · Ledger · More); two-pane on tablet landscape; three columns on desktop (claims · evidence · sources); keyboard shortcuts (`/` focus input, `j/k` navigate).
- [ ] 8.5 [P0] Motion that respects `prefers-reduced-motion`; plain-language mode (CEFR B1) toggle wiring.
- [x] 8.6 [P0] Accessibility baseline: focus styles, skip links, landmarks, live regions for streaming results, form errors.
- [ ] 8.7 [P1] Storybook (or equivalent) with locale and viewport toolbars, including the pseudo-locale.

## 9. Accounts, auth and privacy center
- [x] 9.1 [P0] *Decide* Auth.js vs Neon Auth (verify passkeys, magic links, EU data, RLS integration).
- [x] 9.2 [P1] Anonymous-first: every core feature works without an account; local history and preferences in IndexedDB.
- [x] 9.3 [P1] Passkey-only accounts (Nov 2026: email sign-in removed): create an account and sign in with a passkey; no email, no password, nothing identifying stored.
- [x] 9.4 [P1] Account sync of preferences, follows and history (encrypted, 7.3); merge local → account on first sign-in.
- [x] 9.5 [P1] Privacy center: export (JSON), delete account (hard delete with confirmation), withdraw consents, view what is stored.
- [x] 9.6 [P1] Optional political self-placement: explicit Art. 9 consent screen, separate encrypted table, aggregate use only (k ≥ 50), deletable at any time; never joined with preferences or behaviour.
- [x] 9.7 [P1] Per-user quotas and per-IP-hash quotas for anonymous use (20 checks/hour anonymous, 60 signed-in).

## 10. AI layer: Venice, perspective slots and investigation harness
### 10.A Provider layer
- [x] 10.1 [P0] Venice client through the AI SDK OpenAI-compatible provider (`https://api.venice.ai/api/v1`), with `json_schema` structured output and Zod validation. `include_venice_system_prompt: false` is forced on every call (enforced in the client and tested).
- [x] 10.2 [P0] Venice catalog sync: fetch `GET /models?type=text` every 15 minutes and cache each model's capabilities (`supportsFunctionCalling`, `supportsResponseSchema`, `supportsWebSearch`, `supportsXSearch`, reasoning-effort options), context length, privacy tier, offline and deprecation status, and prices. Alert when an active model is deprecated, goes offline or changes price.
- [x] 10.3 [P0] Adapter layer for model quirks, so prompts stay identical across slots: OpenAI reasoning models rejecting `seed`/`stop`/`n`/penalties; per-model reasoning-effort options; `reasoning_details` round-trip in tool loops; refusal detection (`finish_reason: "content_filter"` and in-stream `content_blocked_by_provider`).
- [x] 10.4 [P0] Privacy-tier enforcement: raw user text only ever goes to Private/TEE models. Anonymized models receive only canonical, PII-free claims (12.3) and public sources. Unit tests prove it for every step and slot.
- [x] 10.5 [P0] Prompt registry: versioned prompts in `prompts/<lang>/` (CC BY 4.0), with en and es-ES variants and few-shot examples. The same prompts serve every perspective slot, and the content hash is recorded on every call.
- [x] 10.6 [P0] Error-class handling:
  - 429 → honour the reset header, retry once with jitter, else fall back.
  - 5xx/timeout → retry once (250 ms→1 s), then fall back.
  - 4xx schema → one repair prompt, no fallback.
  - 401/402 → immediate fallback and page on-call.
  - Refusal → abstention for perspective slots; alternate model, then fallback, for utility roles.
- [x] 10.7 [P0] Timeouts: first token 8 s, 45 s per step, 90 s per investigation.
- [x] 10.8 [P0] Per-model circuit breaker (state in KV, overrides in Edge Config): opens after 5 failures in 60 s or p95 > 3× baseline; half-open probe every 30 s; manual override from the admin console.
- [x] 10.9 [P0] AI Gateway fallback with a per-slot mapping: same family and origin (Grok → xAI, GPT → OpenAI, DeepSeek → DeepSeek), otherwise the same origin, flagged. On the fallback path, investigations use Parallaxa's own search and fetch tools (no Venice-native web or X search) and the analysis discloses it. Zero-data-retention routing for user-text steps.
- [x] 10.10 [P1] Health-check cron (1 min) with a tiny completion per active model, feeding the breaker, the admin console and the public status page.
- [x] 10.11 [P0] `llm_calls` logging: provider, model, slot, step, tokens, searches (web, X, scrape), cost, latency, finish reason, error class; OpenTelemetry spans. Never send user identifiers to providers.
- [x] 10.12 [P1] Spend controls: app-level daily spend ceiling (set in the admin console) and Gateway budget alerts. During fallback only Check and Briefing run; dialogue pauses with a friendly localized message.
- [x] 10.13 [P0] Contract tests for the Venice and Gateway adapters (recorded fixtures), covering tool calls, structured output, web search, X search and refusals.
- [x] 10.13a [P0] Vendor switch in Admin › Models › AI vendors: Venice or Vercel AI Gateway first, the other as backup or off, applied as an audited config version. Steps with the user's own words (screenshot OCR, canonicalization of typed text, Push back) stay on Venice's private models whatever the routing; `llm_calls.fallback` records backup use for alerts and the overview.

### 10.B Perspective slots and utility roles
- [x] 10.14 [P0] Slot model. Up to 5 slots; each has a model, allowed privacy tiers, harness settings and conflict-of-interest topics. Verify the defaults against the live catalog at build time.
  - **US-R** (US, perceived right-leaning): default xAI Grok `grok-4-7`.
  - **US-L** (US, perceived left-leaning): default OpenAI `openai-gpt-62-sol`; alternatives Claude (`claude-sonnet-5-5`) and Gemini (`gemini-4-carbon`).
  - **CN** (Chinese): default DeepSeek `deepseek-v4-pro`; alternatives Kimi (`kimi-k3`), GLM (`z-ai-glm-5-3`) and Qwen.
- [x] 10.15 [P0] Lineup invariants checked on every configuration change: ≥ 3 active slots, ≥ 2 countries of origin, ≥ 3 vendors, no vendor > 50% of adjudication volume, no empty slot.
- [x] 10.16 [P0] Utility-role configuration:
  - PII redaction and canonicalization, decomposition and tagging: small Private model.
  - Reader: mid Private model, tool-less.
  - Writer: rotates among the slots.
  - Renderer and consistency checker: different vendors.
  - Push back: Private model.
- [x] 10.17 [P1] Conflict-of-interest topic lists per model family (3.14), applied at aggregation and editable in the admin console.

### 10.C Investigation harness
- [x] 10.18 [P0] Agentic investigation loop per slot (AI SDK tool calling). Input: canonical claim + shared evidence pool. Output: `submit_verdict` (grade, confidence, reasoning, cited sources) via structured output. A slot never sees the other slots' verdicts.
- [x] 10.19 [P0] Venice-native tools:
  - `enable_web_search: "on"`, `return_search_results_as_documents: true` and `enable_web_citations: true` on every slot.
  - `enable_web_scraping` for URLs in the claim.
  - `enable_x_search: true` only when the model has `supportsXSearch` (Grok). X results are tagged T4 context.
- [x] 10.20 [P0] Parallaxa function tools:
  - `search_web`: secondary search API.
  - `fetch_source`: sandbox + snapshot.
  - `query_primary_data`: primary-data connectors.
  - `verify_quote`.
  - `lookup_entity`: Wikidata.
  - `find_past_analyses`.

  All tool output is wrapped as inert data (11.2).
- [x] 10.21 [P0] Budgets per slot: tool calls (12), web searches (4), X searches (3), scraped URLs (5), 90 s, cost cap per investigation. When a budget is reached, the loop stops gracefully and the verdict says so.
- [x] 10.22 [P0] Harness requirement validator. A model must have:
  - `supportsFunctionCalling`, `supportsResponseSchema` and `supportsWebSearch`.
  - Not offline and not deprecated.
  - Context ≥ 128k tokens.
  - A privacy tier allowed for the slot.

  It returns pass/fail with readable reasons, which the admin model picker uses.
- [x] 10.23 [P1] Harness check runner: sends 5 gold-set claims through a candidate model and verifies tool calls, search, citations, structured output and (where available) X search. Results are stored in `eval_runs` and shown side by side with the current model.

### 10.D Swapping models
- [x] 10.24 [P0] Versioned configuration:
  - `config_versions` in Postgres moves through draft → testing → shadow → active → retired.
  - The active version is published to Edge Config and reaches new analyses within ~10 s, with no deploy.
  - Each analysis records `config_version_id` and every slot's model.
  - In-flight analyses finish on their starting version.
- [x] 10.25 [P1] Shadow mode: a candidate model runs alongside the live one on the next N analyses. Its results are stored, never published, and a comparison report shows agreement, grades, cost and latency.
- [x] 10.26 [P1] Post-swap eval: a 50-claim gold-set run after every activation. A regression beyond tolerance raises an alert and offers rollback.
- [x] 10.27 [P1] One-step rollback to any earlier version. Emergency swap path: harness check required, shadow skipped.
- [x] 10.28 [P1] Public lineup and change-history feed for the Trust Center (19.8).

## 11. Retrieval, sources and sandboxed fetching
- [x] 11.1 [P0] Sandboxed fetcher on Vercel Sandbox: egress allow-list, private-IP and SSRF blocking, size and time limits, HTML and PDF rendering, OCR for images (English and Spanish at launch; Latin-script ready).
- [x] 11.2 [P0] Prompt-injection defences: retrieved text wrapped in inert data blocks, separate tool-less "reader" calls, hidden text and HTML comments stripped, schema validation; retrieved content can never change instructions, tools or fetched URLs.
- [x] 11.3 [P0] Venice web search with results returned as documents (primary).
- [x] 11.4 [P1] *Decide* and integrate a secondary search API (Brave / Exa / Tavily) for diversity and cross-checks.
- [ ] 11.5 [P1] Primary-data connectors: Eurostat, INE, OECD, World Bank, BOE/EUR-Lex, US Census/BLS, CIS barometers, CENDOJ, parliamentary records, Wikidata (entity resolution only).
- [ ] 11.6 [P2] Connectors for new country editions: ONS/UK Parliament and INEGI/DOF, plus regional statistics offices for regional editions; [P3] connectors for each country added with a new language (e.g., INSEE/Légifrance, Destatis/Bundestag, ISTAT/Normattiva, INE-PT/DRE).
- [x] 11.7 [P0] Source snapshotting to Blob (dated, hashed) for every cited page; respect robots.txt; snapshots private; only short quotes displayed.
- [x] 11.8 [P0] Outlet registry: type, country, language. **No** left/right bias scores.
- [x] 11.9 [P0] Retrieval that is aware of place and language: per-claim query plans use place tags to pick authoritative local sources and search in the claim's language plus English; deliberately retrieve outlets from both sides when coverage diverges.
- [x] 11.9a [P0] Deep research before the perspective slots: a planner turns the canonical claim (and its PII-free local-language version) into 4–6 targeted queries (primary source, exact figure, reporting, existing fact-checks, counter-evidence, local language); they run in parallel across the search engines, results are ranked (tier, agreement across queries, ≤ 2 per domain) and the best 4–8 pages are read and archived, with verbatim excerpts. Slots open those pages free, and `search_web` takes up to 3 phrasings per call. The user's own words are never searched.
- [x] 11.9b [P0] Interchangeable search engines (Exa, Brave, Exa via Venice, Brave via Venice): primary, ordered backups, optional combined mode and research depth in Admin › Investigation › Search engines, as an audited config version.

## 12. Truth-seeking pipeline (F1 engine)
- [x] 12.1 [P0] Workflow skeleton: each stage is a durable, retryable step with persisted state and OpenTelemetry spans; progress events streamed to the UI.
- [x] 12.2 [P1] Stage 1, ingest and normalize: URL fetch (11.1), text extraction and OCR, source-language detection, canonicalization, hashing; exact and semantic cache hit (≥ 0.92) → reuse with "previously analyzed on <date>, refresh?".
- [x] 12.3 [P1] Stage 2, claim decomposition into atomic claims typed Fact / Value / Prediction / Attribution / Framing, plus canonicalization by a Private model: each claim rewritten as a neutral, self-contained public statement with personal data removed (the only user-derived text Anonymized models see).
- [x] 12.4 [P1] Stage 2b, place and topic tagging (ISO codes + 1–3 taxonomy topics, with confidence; low confidence falls back to the parent).
- [x] 12.5 [P1] Stage 3, retrieval with the tier plan (T1–T4) and the "≥ 2 independent sources, ≥ 1 T1/T2" rule.
- [x] 12.6 [P1] Stage 4, evidence grading with confidence and a reason.
- [x] 12.7 [P1] Stage 5, manipulation-technique detection (probability language for AI-generated media, never certainty).
- [x] 12.8 [P1] Stage 6, independent investigation: every perspective slot (US-R, US-L, CN, plus extras) runs the investigation harness (10.C) in parallel from the shared evidence pool and returns a blind structured verdict. Sources found by any slot are snapshotted, quote-verified and pooled; verdicts resting on unverifiable sources are downgraded.
- [x] 12.8b [P1] Verdict aggregation by the published rule (3.14): median grade, spread lowers confidence, ≥ 2 grade steps apart (configurable) or supported-vs-contradicted split → "Models disagree" banner with every slot's rationale and a human review task; refusals → abstentions; conflict-of-interest exclusions; fewer than 2 valid verdicts → human review before publication. Store per-slot verdicts in `analysis_verdicts`.
- [x] 12.9 [P1] Stage 7, mirror test for contested political claims; results logged per analysis and aggregated for audits.
- [x] 12.10 [P1] Stage 8, composition into a **language-neutral structured analysis** (summary points, true/missing/wrong, each side's correct points only with evidence, sources, reasoning trace, model and prompt versions, timestamp).
- [x] 12.11 [P1] Stage 8b, native rendering per language from the structured analysis (per-language prompts and style guides). Cached per (analysis version, language) and rendered on first request. Never changes grades, numbers or sources. Quotes stay in the original language with a labelled translation.
- [x] 12.12 [P1] Cross-language consistency check on 100% of renderings (a second model verifies meaning, grades and numbers against the structured analysis); failures re-render once, then go to native review.
- [x] 12.13 [P1] Verbatim quote verification (string match against the snapshot); unverified quotes are removed. Unsupported claims are auto-downgraded to "Not checkable".
- [x] 12.14 [P1] Disclosure flags: model disagreement, fallback provider used, stale data (> 12 months), human-reviewed yes/no, AI-assisted badge (AI Act).
- [x] 12.15 [P1] Versioning and corrections: analyses are immutable; a correction creates a new version with a public diff and reason; feeds the corrections log and RSS.
- [x] 12.16 [P1] Values handling: Value claims are never graded; they route to the steelman composer ("Values question: here are the strongest arguments").
- [ ] 12.17 [P1] Performance work to hit p50 < 25 s cached-similar and p95 time-to-first-result < 20 s (streaming partial results, parallel retrieval, small models for early stages).

## 13. Check experience (F1 UI)
- [x] 13.1 [P1] Home: one large input ("Paste something you saw, or ask a question"), with paste/URL/image upload/voice (speech-to-text in English and Spanish), "Today's Parallax" card, updates on follows, recent checks.
- [x] 13.2 [P1] Share-target handling (`/check` receives POSTed text, URLs and images from the OS share sheet).
- [x] 13.3 [P1] Streaming progress view with honest stage labels.
- [x] 13.4 [P1] Result screen: verdict chip, 3-line summary, true/missing/wrong, "Each side gets right" (may be empty), sources with tier badges and verified quotes (original + labelled translation), model agreement, disclosure banners, collapsed reasoning trace, model and prompt versions.
- [x] 13.5 [P1] Progressive disclosure: headline → summary → evidence → reasoning → raw sources.
- [x] 13.6 [P1] "Report an error" flow (creates `error_reports`, which feeds the review queue and the 72 h SLA clock).
- [x] 13.7 [P1] "Re-run with other models": choose an alternative model mix and show the diff against the original.
- [x] 13.8 [P1] Version history with public diffs.
- [x] 13.9 [P1] Follow this analysis (notifies on correction, update or resolution).
- [x] 13.10 [P1] Share card (claim + evidence, never a "FALSE" stamp over a face), localized.
- [ ] 13.11 [P1] Public, cacheable analysis pages per language (ISR / `use cache`, tag revalidation on new versions).

## 14. Push back dialogue
- [x] 14.1 [P1] User-initiated chat from any result: accuracy-first prompt, no persuasion goal, every factual statement cited, concedes where the user is right, max 10 turns.
- [x] 14.2 [P1] Replies in the user's message language if supported, otherwise the UI language; Private models only.
- [x] 14.3 [P1] Guardrails: stays on the claim, refuses to tell users how to vote, handles abuse calmly; pauses with a localized message during fallback.
- [ ] 14.4 [P1] Eval set for dialogue accuracy and tone in English and Spanish.

## 15. Places, topics and personalization (F6)
- [x] 15.1 [P1] Preferences model (local IndexedDB for anonymous users, encrypted sync when signed in): up to 5 places with home flag and Focus/Include mode, Global on/off, topic states (Follow/Neutral/Mute), follows, briefing settings, channels, quiet hours, pause.
- [x] 15.2 [P1] Default suggestion: home country from browser locale region subtag and coarse IP country (suggestion only, never stored) + Global; user confirms. No Geolocation API.
- [x] 15.3 [P1] Place picker: search and browse country → region, coverage level shown, local official names.
- [x] 15.4 [P1] Topic picker: two-level list with Follow/Neutral/Mute, search, "skip keeps everything neutral".
- [x] 15.5 [P1] Header scope chip: session-only quick switch without changing saved preferences.
- [x] 15.6 [P1] "Your Parallaxa" screen with a live preview ("With these settings, today's briefing would be…").
- [x] 15.7 [P1] Filtering engine (pure, client-side capable): applies place and topic filters to editions, Ledger lists and quiz items; never touches Check results or analysis content.
- [x] 15.8 [P1] "Why am I seeing this?" explanation on every briefing card and alert.
- [x] 15.9 [P1] "Outside your filters" slot: on by default, labelled, can be switched off, with a reminder every 90 days when off.
- [x] 15.10 [P1] Coverage honesty: fallback from region to country to Global with localized disclosure text.
- [ ] 15.11 [P1] Subscriptions: follow topics, places, analyses (P1), actors (P2); in-app and push channels (P1); weekly email digest (P2); RSS per topic and place without an account (P2).
- [ ] 15.12 [P1] Notification budget enforcement: ≤ 1 routine per day, ≤ 3 requested follow-ups per day, quiet hours, pause.
- [x] 15.13 [P1] Automated test: analyses, grades and side-by-side cards are byte-identical across preference profiles.
- [ ] 15.14 [P2] On-device topic suggestions (computed locally, shown as suggestions that need acceptance).

## 16. Daily Parallax (F2)
- [x] 16.1 [P1] Edition model: one Global, one per supported country, one per supported region; a ranked pool of 5–10 candidate stories per edition by the published selection rules.
- [x] 16.2 [P1] Edition generation cron at 05:00 local per place: candidate discovery, analysis via the pipeline, card composition (what happened, place, topic, what's disputed, each side right/wrong, one perception-gap fact).
- [x] 16.3 [P1] Review flow: editor plus at least one cross-partisan reviewer before 07:00 (P1 minimum: one human, always disclosed); native-language spot review of renderings.
- [x] 16.4 [P1] Deterministic personal assembly (no model call): match places, weight followed topics, drop muted ones, add the outside-filters slot, apply the length (3/5) and depth (Quick/Standard) settings; runs client-side for anonymous users and server-side for push and email.
- [x] 16.5 [P1] Briefing UI: ≤ 5 cards, swipe on mobile and arrow keys on desktop, the "You're up to date. See you tomorrow." end state, and no feed below.
- [x] 16.6 [P1] Delivery at the user's chosen time and days via push; offline reading of the last 3 briefings.
- [x] 16.7 [P1] Weekly symmetry audit per edition (whose claims were checked and why), published in the Trust Center.
- [x] 16.8 [P1] Pilot editions: Global, Spain, US, and 2–3 Spanish autonomous communities.
- [ ] 16.9 [P2] All Spanish autonomous communities and the largest US states (as review capacity allows); UK and Mexico country editions.
- [ ] 16.10 [P3] Country editions for each newly added language (candidates: France, Germany, Italy, Portugal), then their regions.

## 17. Actor Ledger (F3)
- [x] 17.1 [P1] Actor model and admin: types (politician, party, government/country, public figure, influencer ≥ 100k reach, company, entrepreneur, media outlet), places, verified contact. Private individuals are never profiled.
- [x] 17.2 [P1] Link analyzed claims to actors (`actor_claims`) with reach weighting.
- [x] 17.3 [P1] Dimension scoring jobs: factual reliability (n ≥ 10), correction behaviour, data integrity, integrity record (final rulings only), influence-operation links (sourced, with confidence), civility of conduct; prediction calibration (Brier score) in P2. Sample size and confidence on each; no overall score.
- [x] 17.4 [P1] Actor page: dimension tiles with n and confidence, analyzed claims, positive conduct, actor reply, appeal status; conduct-only phrasing in English and Spanish (natively and legally reviewed).
- [ ] 17.5 [P1] Read-only launch scope: parties and national leaders in Spain and the US; legal review of the first 100 profiles (needs: 2.6, 2.10).
- [x] 17.6 [P1] Filters by country, region and topic.
- [ ] 17.7 [P2] Right of reply: verified-contact "Respond" channel, ≤ 300 words + links, published within 5 business days; a rebuttal with new evidence triggers re-review within 10 business days.
- [ ] 17.8 [P2] Appeals: stage 1 editorial re-review by a different reviewer and model pair; stage 2 panel decision published with reasons.
- [ ] 17.9 [P2] Statutory rectification workflow (LO 2/1984 deadlines) and equivalents for new countries.
- [ ] 17.10 [P2] Regional actors (regional presidents, governments, parliaments, regional outlets) and actors for the new country editions.
- [ ] 17.11 [P2] Follow actors (new analyses, replies, appeal results).

## 18. Depolarization features (F4)
- [x] 18.1 [P1] Side-by-side card: "What [left/progressive] voices get right · What [right/conservative] voices get right · What the evidence says"; labels per country (3.11); sections may be empty; no logos or party colours.
- [x] 18.2 [P1] Perception-gap quiz: slider guess → reveal the real survey value with source and margin of error → reflection prompt; published surveys only (More in Common, CIS, Pew, Eurobarometer, regional institutes such as CEO); question wording in the user's language with a link to the original; items matched to the home place and followed topics; regional items only with adequate samples.
- [ ] 18.3 [P1] Quiz content for Spain and the US (P1); UK and MX (P2); each country added with a new language (P3).
- [x] 18.4 [P1] Anonymous quiz responses (no user_id) for aggregate before/after error measurement.
- [x] 18.5 [P1] Steelman composer for value questions (the strongest version of each position, written to be endorsed by its holders); cross-partisan rater validation and bridging score in P2.
- [x] 18.6 [P1] Moral reframing hints (why the fact matters across care, fairness, liberty, loyalty and authority) without changing the fact.

## 19. Trust Center and transparency (F5)
- [x] 19.1 [P1] Trust Center pages in English and Spanish: methodology, grades, tiers, selection rules, rubric, prompts (linked to the repo), model list and roles, funding and donors, panel bios, legal entity.
- [x] 19.2 [P1] Per-analysis provenance: model IDs, provider (Venice or fallback), prompt hash, human-review status.
- [x] 19.3 [P1] Public corrections log with diffs and reasons; RSS feed per language.
- [x] 19.4 [P1] Symmetry and audit reports: mirror-test aggregates, story mix per edition, Ledger outcomes by party family, with raw data downloads (quarterly from P2).
- [x] 19.5 [P1] Public status page (model health, fallback in use, incidents).
- [x] 19.6 [P1] Eval results page (accuracy, calibration, parity, language parity) updated on every release.
- [ ] 19.7 [P2] External audit publication.
- [x] 19.8 [P1] Model lineup page: current model per perspective slot and utility role, full change history (date, old → new, reason) and post-swap eval results (needs: 10.28).

## 20. PWA, offline and notifications
- [x] 20.1 [P1] Manifest: name, short_name "Parallaxa", icons 192/512 + maskable, `display: standalone`, `share_target` (POST text/url/images → `/check`), one per language (4.15).
- [ ] 20.2 [P1] Service worker (Serwist): precache the shell; network-first for API; stale-while-revalidate for briefings; offline reading of the last 3 briefings and saved checks; background-sync queue for offline checks.
- [x] 20.3 [P1] Web Push (VAPID): opt-in after the second meaningful session, never on the first visit; on iOS only inside the installed app (iOS/iPadOS 16.4+); subscriptions encrypted at rest; payloads localized.
- [x] 20.4 [P1] Install reminders: only after ≥ 2 visits on different days and ≥ 1 completed check or briefing; in-page bottom banner, never a modal; `beforeinstallprompt` on Android and desktop; illustrated 3-step iOS sheet; max once per 14 days; stop after 2 dismissals; never during a check or quiz; manual Install in settings.
- [x] 20.5 [P1] Onboarding (≤ 60 s, skippable, no sign-up): detected language with switcher → three panels → place picker → optional topic picker → demo (each side one right, one wrong) → "Don't trust us? Good." hook.

## 21. Editorial and review console (internal)
- [ ] 21.1 [P1] Roles and permissions with individual accounts: editor, reviewer, native language reviewer, panel member, legal; every action written to `audit_log`. (The operator admin console is block 22.)
- [x] 21.2 [P1] Queues: model disagreements, briefing editions, Ledger entries, error reports (72 h SLA timer), appeals, replies, failed consistency checks, 2% cross-partisan sampling of outputs.
- [x] 21.3 [P1] Review UI: side-by-side model rationales, sources and snapshots, renderings in every supported language next to the structured analysis, approve / edit / escalate / correct.
- [ ] 21.4 [P1] Panel workflows: votes requiring one member from each bloc, decisions published with reasons.
- [ ] 21.5 [P1] Reviewer scheduling for the 05:00–07:00 briefing window per time zone and language.

## 22. Admin console (F8)
### 22.A Access and security
- [x] 22.1 [P0] `/admin` route group: server-rendered, `noindex`, not linked from the public app, in English and Spanish through the same i18n system.
- [x] 22.2 [P0] Env vars `ADMIN_USERNAME`, `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` (Vercel "sensitive", different per environment), plus optional `ADMIN_IP_ALLOWLIST`. A boot check disables the admin site if the password is missing or shorter than 20 characters.
- [x] 22.3 [P0] Login form with constant-time comparison. Session: a signed `HttpOnly`/`Secure`/`SameSite=Strict` cookie (8 h, 30 min idle), backed by `admin_sessions` for revocation. Logout.
- [x] 22.4 [P0] Login protection:
  - After 5 failed attempts in 15 minutes from one IP hash, lock out for 15 minutes and send an alert email.
  - BotID and a WAF rule on the login route.
  - CSRF tokens on every change.
- [x] 22.5 [P0] Session checked in middleware *and* in every admin page, route handler and server action. An automated test calls every admin route without a session and expects a redirect or 401.
- [x] 22.6 [P0] Audit log for every admin action (time, IP hash, before/after diff, reason), with revert and export.

### 22.B Settings framework
- [x] 22.7 [P0] One typed settings schema (Zod): type, range, default, help text in en and es-ES, "needs a test run" flag and affected features. Forms, validation and the settings reference are generated from it, so nobody edits JSON.
- [x] 22.8 [P1] Save bar:
  - A plain-language summary of pending changes.
  - A required reason.
  - An impact preview: cost per analysis and per month, latency, affected features.
  - Typed confirmation for production-wide actions.
  - Undo.
- [x] 22.9 [P1] Publish flow: save → `config_versions` → Edge Config (Vercel API token scoped to that store) → live within ~10 s, with publish status shown.

### 22.C Sections
- [x] 22.10 [P1] **Overview** ("Is everything OK?"):
  - System status and fallback state.
  - Today's checks, cache-hit rate, p50/p95 time to result, error rate.
  - Spend against the daily ceiling.
  - Briefing editions status, review queues and the corrections SLA.
  - Model agreement rate, latest evals, open alerts.
- [x] 22.11 [P0] **Models:**
  - Slot and role cards: model, vendor, origin, privacy tier, harness badges, price, p95, refusal rate, agreement, breaker state.
  - A picker of live compatible Venice models (filter by vendor, origin, price, context), with incompatible models greyed out and the reason shown.
  - Test → Shadow → Activate; emergency swap.
  - Clear messages when a change would break a lineup rule.
  - History and rollback.
- [x] 22.12 [P1] **Investigation settings** per slot:
  - Web search mode, scraping, citations.
  - X search, shown only when the model supports it.
  - Reasoning effort, limited to the model's options.
  - Budgets, temperature, conflict-of-interest topics.

  The Venice system prompt is shown as locked off.
- [x] 22.13 [P1] **Pipeline settings:** thresholds, aggregation rule, disagreement threshold, human-review triggers, mirror test by topic, writer rotation. The prompt version is read-only.
- [x] 22.14 [P1] **Reliability and limits:** breaker thresholds, timeouts, fallback mapping and on/off per feature, spend ceiling and alert levels, quotas, rate limits, kill switches, maintenance banner.
- [x] 22.15 [P1] **Content:** language flags from the registry, places and editions with coverage levels, briefing timing, notification limits, "outside your filters" default, quiz on/off per country.
- [x] 22.16 [P1] **Metrics** with date range and CSV export: truth, even-handedness, models (agreement matrix, per-slot grade distribution, refusals, conflict-of-interest exclusions, latency, cost), operations, usage (aggregate, k ≥ 50), wellbeing and relevance, guardrails, costs. *Decide* the chart library.
- [ ] 22.17 [P1] `metrics_daily` aggregation jobs feeding the metrics pages. No per-user data is stored for the console.
- [x] 22.18 [P1] **Alerts:** thresholds (spend, SLO breach, fallback active, eval regression, late briefing, login lockouts, catalog changes), posted to the admins’ Telegram chat (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID); test button in Admin › Alerts and `pnpm telegram`. Never emailed.
- [ ] 22.19 [P1] Usability test with a first-time operator: swap the CN model, lower the spend ceiling and find yesterday's p95, all without help. Fix what they stumble on.
- [ ] 22.20 [P2] Named admin accounts with passkeys and roles, replacing the shared env-var login.

## 23. Evaluation and quality gates
- [x] 23.1 [P0] Eval harness: run the pipeline on the gold set and compute grade accuracy, macro-F1, calibration (ECE), citation precision and source-tier quality.
- [x] 23.2 [P1] Even-handedness suite: mirror pairs (parity ±0.1), refusal symmetry by side and by slot, outcome reporting by side.
- [x] 23.2b [P1] Per-slot model metrics: agreement matrix between slots, grade distribution by side of claim origin, refusal and abstention rates, conflict-of-interest exclusions, cost and latency; nightly, surfaced in the admin console (22.16).
- [x] 23.3 [P1] Language parity suite: the same claims in every supported language (en and es-ES at launch); ≥ 98% cross-language grade agreement; native fluency and terminology ratings ≥ 4.5/5 (es-ES raters for Spanish); es-ES lexicon check (4.18).
- [x] 23.4 [P1] Tag accuracy evals: country ≥ 95%, region and topic ≥ 90%.
- [x] 23.5 [P1] Nightly regression on the gold set, with alerts.
- [x] 23.6 [P1] Release gate (`pnpm eval` before shipping; also automatic after every model swap in the admin console): no prompt or model change ships if accuracy drops > 1 point or any symmetry or language-parity metric regresses beyond tolerance.
- [ ] 23.7 [P2] Perceived-slant panels (Westwood-style) stratified by ideology in ES, US, UK and MX, then each country added with a new language; goal: no significant perceived slant on ≥ 80% of topics.
- [ ] 23.8 [P1] Hallucination tests: quote verification coverage, "Not checkable" downgrade behaviour, prompt-injection red-team set.

## 24. Security and abuse prevention
- [ ] 24.1 [P1] Rate limits and quotas (WAF + app level), BotID on expensive and write routes, account age and reputation signals.
- [x] 24.2 [P1] Anomaly detection for rating bursts, coordinated reports and brigading on errors and appeals.
- [x] 24.3 [P1] Secrets: environment-scoped Vercel env vars, quarterly rotation runbook, no secrets in client bundles (`pnpm check:secrets`, part of `pnpm verify`).
- [ ] 24.4 [P1] Abuse reporting channel; no bulk API in the MVP.
- [ ] 24.5 [P1] Third-party penetration test before public launch (focus: SSRF, prompt injection, auth, RLS); fix all high and critical findings.
- [x] 24.6 [P1] Incident response plan (security, model outage, viral error, legal notice) with on-call rotation.

## 25. Observability, cost control and operations
- [x] 25.1 [P0] OpenTelemetry traces per pipeline step (model, latency, tokens, cost); Vercel Observability dashboards.
- [x] 25.2 [P1] Speed Insights and cookieless Web Analytics (no third-party pixels).
- [x] 25.3 [P1] SLO monitoring and alerts: 99.5% Check availability, p95 time-to-first-result < 20 s, briefing ready by 06:45 local on 99% of days.
- [x] 25.4 [P1] Cost dashboard: cost per fresh analysis (target ~$0.35–$0.50 default lineup, ~$0.20–$0.30 economy), cost per slot and search type, cache-hit rate (30% → 70%), rendering cost per language, briefing cost per edition, daily spend vs ceiling.
- [ ] 25.5 [P1] Guardrail alarms: average session > 15 minutes; < 60% of users keep "outside your filters" on; topic diversity below the edition baseline; > 10% manual switches away from the detected language.
- [x] 25.6 [P1] Runbooks: Venice outage, Gateway fallback, briefing late, viral error correction, rollback.

## 26. Research and experimentation
- [x] 26.1 [P1] Opt-in research consent flow (localized), ethics review with academic partners.
- [x] 26.2 [P1] A/B bucketing in middleware (cookie, no PII).
- [ ] 26.3 [P1] Instruments: feeling thermometer (affective polarization), perception-gap error, "I felt respected / calmer", "briefing relevant to me", trust by self-placed ideology (opt-in), in English and Spanish with validated translations.
- [ ] 26.4 [P2] First pre-registered RCT (2- and 8-week follow-ups), benchmarked against the megastudy's best treatments; publish all results, including nulls.

## 27. Community review (bridging) [P2]
- [ ] 27.1 [P2] Invite-only reviewer program with reputation.
- [ ] 27.2 [P2] Bridging-based rating algorithm (ratings count when people who usually disagree agree), with brigading defences.
- [ ] 27.3 [P2] Ratings feed into the human review queues, never directly into grades.
- [ ] 27.4 [P2] DSA notice-and-action, statements of reasons and point of contact for hosted user content (needs: 2.8).

## 28. Phase 2 and 3 features
- [ ] 28.1 [P2] Prediction tracker: capture resolvable predictions, resolution rules, Brier scores, feed into the Ledger calibration dimension.
- [ ] 28.2 [P2] Prebunk micro-lessons on manipulation techniques, with examples balanced across sides, in every supported language.
- [ ] 28.3 [P2] Weekly email digest and RSS per topic and place (15.11).
- [ ] 28.4 [P3] Browser extension (context at the moment of exposure; same privacy rules).
- [ ] 28.5 [P3] Debate maps for deep divers.
- [ ] 28.6 [P3] Common-ground rooms pilot (Habermas-style AI mediation, moderated).
- [ ] 28.7 [P3] Personal "bias mirror" (on-device only).
- [ ] 28.8 [P3] Municipal scope pilot (decide after evaluating source and review cost).
- [ ] 28.9 [P3] Institutional licences (newsrooms, schools, researchers) with citable exports.
- [ ] 28.10 [P3] Choose and add further languages via the playbook (4.25): candidates French, German, Italian, Portuguese; also evaluate Spain's co-official languages (Catalan, Basque, Galician) against reviewer capacity.

## 29. Launch readiness
- [ ] 29.1 [P1] Closed beta: invite list balanced across left, centre and right in each language; feedback channel; weekly review of metrics and errors.
- [ ] 29.2 [P1] Content seeding: a symmetric showcase of examples (each side right and wrong) in every language for the landing page and onboarding.
- [ ] 29.3 [P2] Launch partners and creators from across the spectrum in each launch country.
- [ ] 29.4 [P2] Public launch checklist: legal sign-offs (2.6, 2.9, 2.10), pen test fixed (24.5), eval gates green, SLOs met for 2 weeks, first symmetry audit published, panel active, support rota staffed in English and Spanish.
- [ ] 29.5 [P2] Post-launch review at 30 days: metrics vs targets (PRD 10), honest public report.

---

## Appendix A: success targets (year 1)
| Category | Metric | Target |
|---|---|---|
| Truth | Gold-set grade accuracy | ≥ 90% |
| Truth | Calibration (ECE) | ≤ 0.05 |
| Truth | Verified-citation precision | ≥ 99% |
| Truth | Validated errors per 1,000 analyses; median time to correction | < 5; < 48 h |
| Even-handedness | Mirror-pair grade parity | within ±0.1 |
| Trust | Trust gap between left and right (opt-in survey) | ≤ 10 points |
| Reach balance | Usage share by self-placed ideology vs population | neither wing < 60% of its population share |
| Depolarization | Affective polarization, users vs control, at 2 and 8 weeks | significant reduction, reported honestly |
| Depolarization | Perception-gap error before vs after the quiz | ≥ 30% reduction |
| Wellbeing | "I felt respected" / "I felt calmer" | ≥ 80% |
| Relevance | "Today's briefing was relevant to me" | ≥ 75% |
| Language | Cross-language grade agreement; native fluency rating | ≥ 98%; ≥ 4.5/5 per language |

Explicitly **not** goals: time on site, daily sessions, shares, streaks.
