# TODO.md: Parallaxa implementation plan

This file lists **every block of work, and every task inside each block**, needed to build Parallaxa from an empty repository to a public product. It is self-contained: section 0 gives all the context needed to work from it. The PRD (`Parallaxa PRD_ A Calm, Open, Cross-Partisan Reality Check App.md`) holds the research, rationale and full specs, and the section references (e.g. "PRD 6.1") point there for detail.

**How to use it**
- `- [ ]` open, `- [x]` done. Tick tasks in the same PR that completes them.
- Task IDs (`12.4`) are stable. Reference them in commits, PRs and `needs:` notes.
- Phase tags: **[P0]** Foundations (months 0–2) · **[P1]** MVP closed beta (months 2–5) · **[P2]** Public launch (months 5–9) · **[P3]** Expansion (months 9–18).
- `needs:` lists hard dependencies. Anything without one can start once its block's earlier tasks allow.
- Every user-facing task also meets the **Definition of done** in 0.8.

---

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
| F7 | **Languages** | `en`, `es-ES`, `fr-FR`, `de-DE`, `it-IT`, `pt-PT`, detected from the browser with English as fallback |

### 0.3 Non-negotiable rules (every task must respect them)
1. **Truth over balance:** symmetric *rules*, not symmetric *outcomes*. "What each side gets right" sections may be empty. Never split the difference.
2. **Facts, values and predictions are separate.** Value questions are never graded true or false.
3. **At least two models of different national origin** adjudicate. Disagreement is shown, never hidden.
4. **Show the work:** sources, verbatim quotes, reasoning, confidence, model IDs, prompt version and provider on every analysis.
5. **Calm by design:** no infinite feed, outrage ranking, streaks, "dunk" sharing, ads or third-party trackers. Engagement is never a goal.
6. **Personalization is by place and topic only, never by side or outlet.** Analyses are identical for everyone.
7. **Privacy:** anonymous by default, preferences stored on the device, Art. 9 data encrypted and separate, EU data residency, no user identifiers sent to model providers.
8. **Ledger language describes conduct, never character.** No crime allegations without a final ruling.
9. **Spanish is `es-ES` (Spain) only.** Never Latin American Spanish.
10. **Accessibility:** WCAG 2.2 AA everywhere. No colour-only meaning, and never red/blue/party colours for sides.

### 0.4 Tech stack (decided unless marked *decide*)
| Area | Choice |
|---|---|
| App | Next.js (App Router, RSC, TypeScript strict), pnpm |
| Hosting | Vercel Pro, functions pinned to `fra1`, Fluid compute (Node.js runtime, never Edge for the pipeline) |
| Durable jobs | Vercel Workflow + Vercel Queues (fallback: Postgres job table + cron drain) |
| Database | Neon Postgres (EU, AWS Frankfurt) via Vercel Marketplace, pgvector, RLS, preview branch per PR |
| ORM / validation | Drizzle ORM + drizzle-kit migrations; Zod for every schema (API, AI output, env) |
| Storage / config | Vercel Blob (private), Edge Config (flags, model routing, kill switches), Marketplace Redis/KV (circuit breaker, rate counters) |
| AI | AI SDK (`generateObject` / `streamText`), Venice (OpenAI-compatible, primary), Vercel AI Gateway (fallback) |
| Untrusted fetching | Vercel Sandbox with egress allow-list |
| Security edge | Vercel Firewall/WAF, BotID |
| Auth | *decide:* Auth.js vs Neon Auth. Must support passkeys + email magic links, with optional Google/Apple OAuth |
| Email | Resend (EU region): magic links, digests, reply and appeal notices |
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
| French | `fr-FR` | `/fr` | every `fr-*` |
| German | `de-DE` | `/de` | every `de-*` |
| Italian | `it-IT` | `/it` | every `it-*` |
| Portuguese (Portugal) | `pt-PT` | `/pt` | every `pt-*` (incl. `pt-BR`) |

Resolution order: URL prefix → saved choice (account setting or `NEXT_LOCALE` cookie) → `Accept-Language` in q-order, first supported primary subtag → `en`. Language is independent of place and never inferred from IP.

### 0.6 Places and topics (F6)
- Places: Global · Country (ISO 3166-1) · Region (ISO 3166-2 first level). Up to 5 per user, one marked home, each in Focus or Include mode. Nothing finer than region.
- Launch coverage: Global, Spain, US country editions, and 2–3 pilot Spanish autonomous communities (P1). Then all Spanish regions, the largest US states, and the UK, France, Germany, Italy, Portugal and Mexico (P2). Then regions of FR/DE/IT/PT (P3).
- Topics: a published two-level taxonomy (~20 topics, ~150 subtopics), each Follow / Neutral / Mute. Muting never affects Check.

### 0.7 Key numbers
- Check: p50 < 25 s for cached-similar claims, p95 time-to-first-result < 20 s, hard limit < 60 s; availability 99.5%.
- Semantic cache reuse at pgvector similarity ≥ 0.92. Graded facts need ≥ 2 independent sources, ≥ 1 of them T1/T2. Quotes ≤ 25 words, verified verbatim.
- Model timeouts: first token 8 s; 45 s per step (90 s for adjudication). Circuit breaker opens after 5 failures in 60 s or p95 > 3× baseline; half-open probe every 30 s.
- Briefing: editions generated at 05:00 local time and reviewed by 07:00, ready by 06:45 on 99% of days; ≤ 5 stories; ≤ 6 minutes to read.
- Notifications: ≤ 1 routine per day plus ≤ 3 requested follow-ups per day.
- Rate limits: 20 checks/hour anonymous, 60 signed-in. Push back dialogue: ≤ 10 turns.
- Corrections published < 72 h after a validated report (target median < 48 h). Ledger replies published ≤ 5 business days after verification; re-review ≤ 10 business days.
- Ledger: no dimension score before n ≥ 10 analyzed claims. Aggregates use k-anonymity ≥ 50.

### 0.8 Definition of done (every user-facing task)
- [ ] Copy exists in all six locales (no missing keys), reviewed natively for es-ES, fr-FR, de-DE, it-IT and pt-PT.
- [ ] WCAG 2.2 AA: axe clean, keyboard and screen-reader tested, targets ≥ 24×24 px, contrast ≥ 4.5:1, respects `prefers-reduced-motion`.
- [ ] Works at mobile (< 640 px), tablet (640–1024 px) and desktop (> 1024 px), including German/French text expansion.
- [ ] Unit tests and a Playwright E2E path. LLM-touching changes pass the eval release gate (block 22).
- [ ] No PII in logs, URLs or model requests. No third-party scripts.
- [ ] Observability: OpenTelemetry spans and cost tracking where models are called.

---

## 1. Milestones and exit criteria

- [ ] **M0: Foundations complete [P0].** Legal entity exists; name cleared; methodology v1, taxonomy v1 and place list published; gold set v1 (500 claims, 6 languages) ready; panel recruited; DPIA signed off; translators and native reviewers contracted; repo, infra and CI running with an empty localized shell deployed.
- [ ] **M1: Closed beta [P1].** F1, F2 (Global + ES + US + 2–3 Spanish regions), F4 (side-by-side, quiz ES/US, steelman, Push back), read-only F3 (parties + national leaders), F5, F6 core and F7 (all six languages) live for invited users. Eval gates are green, the first symmetry report is published internally, and SLOs have been met for 2 weeks.
- [ ] **M2: Public launch [P2].** Full Ledger with reply and appeals; regional actors; community review (invite-only); prediction tracker; prebunk lessons; UK/FR/DE/IT/PT/MX country editions; all Spanish regions and the largest US states; email digest and RSS; first public symmetry audit; first RCT running.
- [ ] **M3: Expansion [P3].** Browser extension, debate maps, common-ground rooms pilot, FR/DE/IT/PT regional editions, municipal-scope pilot, institutional licences, external audit published.

---

## 2. Organization, legal and governance
- [ ] 2.1 [P0] Choose the legal home (Spain *fundación*, Dutch *stichting* or Ireland) with counsel, weighing defamation exposure and funding access; incorporate.
- [ ] 2.2 [P0] Write and publish the funding policy: no donor > 10% of the annual budget; no party, government or platform-company money; donors > €1,000 published; no model vendor > 50% of adjudication volume.
- [ ] 2.3 [P0] Name clearance: registrar checks for parallaxa.app/.eu/.es/.com/.org (fallbacks getparallaxa.app, parallaxa.eu); EUIPO, OEPM and USPTO knockout searches in Classes 9, 38, 41 and 42; counsel clearance opinion; register the chosen domains and file the trademark.
- [ ] 2.4 [P0] DPIA covering profiling of public figures, Art. 9 data (political self-placement, topic/place preferences), AI processing and EU residency; legitimate-interest assessment for the Ledger.
- [ ] 2.5 [P0] DPAs with Vercel, Neon, Venice, AI Gateway upstream providers, Resend, the search API provider and the KV provider; record of processing activities.
- [ ] 2.6 [P0] Legal opinion on GDPR Art. 85 journalistic exemption, Spanish LO 1/1982 (honour) and LO 2/1984 (rectification), criminal defamation exposure, and the equivalent regimes in FR/DE/IT/PT/UK for when those editions launch [P2].
- [ ] 2.7 [P0] EU AI Act Art. 50 compliance plan: AI-interaction disclosure and machine-readable marking of AI-generated content.
- [ ] 2.8 [P1] DSA readiness review (point of contact, terms) and check for small-enterprise exemptions; full notice-and-action when user content is hosted [P2] (needs: 25).
- [ ] 2.9 [P0] Terms of service, privacy policy, cookie statement (cookieless; essential cookies only) and AI disclosure, drafted in English and Spanish and then legally translated into fr-FR, de-DE, it-IT and pt-PT, with the governing version stated.
- [ ] 2.10 [P1] Media liability insurance in place before any public Ledger profile.
- [ ] 2.11 [P0] Recruit the cross-partisan review panel: ≥ 9 paid, rotating members balanced across left, centre and right (Spain, US, LatAm, plus FR/DE/IT/PT/UK members before their editions launch); publish bios; panel charter (decisions need one member from each bloc; conflicts-of-interest rules).
- [ ] 2.12 [P0] Sign academic partners for the gold set, perceived-slant panels, RCTs and audits; agree data-sharing and publication terms (all results published, including nulls).
- [ ] 2.13 [P1] Rectification and right-of-reply procedure meeting LO 2/1984 deadlines, documented for staff and published in all six languages.
- [ ] 2.14 [P2] External annual audit contract with a university team from another country.
- [ ] 2.15 [P0] Hire or contract the minimal team (4–6: engineering, editorial, ops) plus native reviewers for the five non-English languages.

## 3. Methodology and editorial standards (published under CC BY 4.0)
- [ ] 3.1 [P0] Claim types and definitions: Fact, Value, Prediction, Attribution, Framing.
- [ ] 3.2 [P0] Evidence grades and definitions: Well supported · Mostly supported · Mixed/contested · Missing context · Mostly unsupported · Contradicted by evidence · Not checkable (yet). Confidence levels High/Medium/Low, with reason templates.
- [ ] 3.3 [P0] Source tiers T1–T4 with examples per launch country (statistics offices, courts, legislation, peer review, wires, outlets across the spectrum); the "≥ 2 independent sources, ≥ 1 T1/T2" rule.
- [ ] 3.4 [P0] Manipulation-technique catalogue (cherry-picked window, base-rate neglect, misleading axis, correlation→causation, out-of-context clip, AI-generated media), with examples drawn equally from all sides.
- [ ] 3.5 [P0] Mirror-test protocol: how to build the structurally equivalent opposite-side claim, the parity tolerance (±0.1 ordinal), and logging and publication.
- [ ] 3.6 [P0] Briefing selection rules (cross-outlet salience on both sides, virality of contested claims, upcoming decisions) and "outside your filters" salience rules.
- [ ] 3.7 [P0] Ledger rubric v1: seven dimensions, minimum samples, reach weighting, confidence, conduct-only phrasing rules, positive signals; legal review (needs: 2.6).
- [ ] 3.8 [P0] Corrections policy (versioning, public diff, reasons, 72 h SLA) and appeals policy (two stages).
- [ ] 3.9 [P0] Topic taxonomy v1: ~20 topics and ~150 subtopics with neutral names in all six languages, country-specific subtopics mapped to neutral parents; panel review; versioning rules.
- [ ] 3.10 [P0] Place list: ISO 3166-1 countries and ISO 3166-2 first-level regions for launch countries; official local names; time zones; coverage-level criteria (Full / Partial / Limited) and the threshold for a regional edition.
- [ ] 3.11 [P0] Left/right labelling rules per country for the side-by-side card (e.g., Spain "izquierda/derecha" plus party families; no logos or party colours).
- [ ] 3.12 [P0] Gold set v1: 500 claims balanced by side, country and language, graded by fact-checkers of different orientations plus academics; each claim professionally translated into the other five languages (grows to ≥ 1,000 by P2; needs: 2.12).
- [ ] 3.13 [P0] Publish methodology v1 in the public repo (`/methodology`) and in the Trust Center in all six languages.

## 4. Languages and localization (F7)
### 4.A Engineering
- [ ] 4.1 [P0] Install and configure next-intl with locales `en, es-ES, fr-FR, de-DE, it-IT, pt-PT`; URL prefixes `/en /es /fr /de /it /pt`; default and fallback `en`.
- [ ] 4.2 [P0] Locale negotiation in Routing Middleware, in order: URL prefix → `NEXT_LOCALE` cookie or account setting → `Accept-Language` parsed by q-value with primary-subtag matching (`es-*`→`es-ES`, `pt-*`→`pt-PT`, `fr-*`→`fr-FR`, `de-*`→`de-DE`, `it-*`→`it-IT`, `en-*`→`en`) → `en`. Never use IP. Redirect `/` to the resolved prefix (302, `Vary: Accept-Language, Cookie`).
- [ ] 4.3 [P0] Unit tests for negotiation: `es-MX,es;q=0.9`→es-ES; `pt-BR`→pt-PT; `ca,es;q=0.8,en;q=0.5`→es-ES; `de-CH`→de-DE; `ja,zh`→en; empty header→en; cookie overrides header; URL overrides cookie.
- [ ] 4.4 [P0] Language switcher (header menu, settings, onboarding). Each language is shown in its own name with no flags. It persists to the cookie (anonymous) or account (signed in) and keeps the current path.
- [ ] 4.5 [P0] Message catalog structure (per-feature namespaces), ICU plurals/select, typed keys (generated TypeScript types). English is the source.
- [ ] 4.6 [P0] CI checks: missing keys, unused keys, ICU syntax, placeholder parity across locales; fails the build on any error.
- [ ] 4.7 [P0] Pseudo-locale (accented, +40% length) for development and visual tests; Playwright snapshot tests in pseudo, de-DE and fr-FR at all breakpoints.
- [ ] 4.8 [P0] Formatting helpers on `Intl` (dates, relative time, numbers, percentages, currency, lists) per locale; device time zone; never hand-formatted strings.
- [ ] 4.9 [P0] `lang` attribute on `<html>` and on every mixed-language fragment (original-language quotes, source titles); `hyphens: auto`; layout tolerates ~35% expansion; logical CSS properties (RTL-ready).
- [ ] 4.10 [P1] SEO: locale-prefixed public URLs, `hreflang` alternates for all six plus `x-default`→`/en`, localized `<title>`, meta description and Open Graph, localized sitemaps.
- [ ] 4.11 [P1] Localized PWA manifests per language (`lang`, `description`, shortcuts, `start_url` with prefix); serve the manifest that matches the active locale (needs: 20.1).
- [ ] 4.12 [P1] Localized emails (Resend templates) and push notification payloads rendered in the recipient's saved language.
- [ ] 4.13 [P1] Localized share cards (OG images) in the sharer's language.
- [ ] 4.14 [P1] es-ES lexicon linter for UI catalogs and sampled model output: flag Latin American-only terms and forms ("ustedes" as informal plural, "computadora", "celular", "carro", "manejar" for driving, etc.); runs in CI and in the nightly eval.
- [ ] 4.15 [P1] Translation management workflow: export new and changed keys → professional translation → native review → import via PR; *decide* git-only vs TMS (see 0.4); translation memory and glossary enforcement.

### 4.B Language content and operations
- [ ] 4.16 [P0] Style guide per language: tone (curious, plain, non-humiliating), form of address (es-ES "tú"/"vosotros", fr-FR "vous", de-DE "du", it-IT "tu", pt-PT "tu"), English spelling convention, number style, quotation marks, gender-inclusive language policy.
- [ ] 4.17 [P0] Glossaries per language: grade names, claim types, technique names, Ledger dimensions, neutral political vocabulary per country, institution names (e.g., "Congreso de los Diputados", "comunidad autónoma").
- [ ] 4.18 [P0] Finalize native copywriting of the tagline in FR/DE/IT/PT (drafts are in the PRD 3.1).
- [ ] 4.19 [P1] Translate and natively review all UI copy, onboarding, Trust Center, methodology, legal texts, emails and notifications in five languages.
- [ ] 4.20 [P1] Native reviewer rota per language integrated into the review console (needs: 21) for briefings, Ledger text and sampled analyses.

## 5. Repository, tooling and CI/CD
- [ ] 5.1 [P0] Scaffold Next.js (App Router, TS strict, `src/` layout), pnpm, Node LTS pinned (`.nvmrc`, `engines`).
- [ ] 5.2 [P0] ESLint, Prettier, typecheck, import boundaries (`app/`, `features/*`, `lib/*`, `server/*`), conventional commits.
- [ ] 5.3 [P0] Vitest with coverage; Playwright projects for mobile, tablet and desktop in Chromium, WebKit and Firefox; axe-core integration.
- [ ] 5.4 [P0] GitHub Actions: lint, typecheck, unit, i18n checks (4.6), E2E on preview URL, axe, LLM eval gate on prompt-touching PRs (22.6), OSV scan, SBOM generation.
- [ ] 5.5 [P0] Renovate config, pnpm lockfile enforcement, dependency review.
- [ ] 5.6 [P0] Licences: AGPL-3.0 for code, CC BY 4.0 for `/methodology` and `/prompts`; `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`.
- [ ] 5.7 [P0] Env var schema with Zod (fail fast on boot); `.env.example` with names only; secrets never committed.
- [ ] 5.8 [P0] `CLAUDE.md`/`AGENTS.md` for the repo: stack, commands, non-negotiable rules (0.3), locale rules (0.5).
- [ ] 5.9 [P0] Seed and fixture scripts: places, topics, sample analyses in six languages, demo actors (fictional) for previews and tests.

## 6. Infrastructure and platform (Vercel + Neon)
- [ ] 6.1 [P0] Create the Vercel project (Pro), link the repo, pin functions to `fra1`, enable Fluid compute; set up production and preview environments.
- [ ] 6.2 [P0] Provision Neon via Vercel Marketplace in the EU (AWS Frankfurt): Free plan for prototyping, Launch for production; branch per preview deployment, auto-deleted on PR close; production minimum 0.25 CU, autoscaling max 2 CU; scale-to-zero only for previews.
- [ ] 6.3 [P0] Enable pgvector; configure the pooled connection string for functions; `@neondatabase/serverless` (HTTP for one-shot queries, WebSocket for transactions).
- [ ] 6.4 [P0] Vercel Blob store (private, signed URLs) for screenshots and source snapshots.
- [ ] 6.5 [P0] Edge Config: feature flags, model routing table, circuit-breaker overrides, kill switches (per feature and per locale).
- [ ] 6.6 [P0] Marketplace Redis/KV for circuit-breaker state, rate counters and short-lived caches.
- [ ] 6.7 [P0] Vercel Workflow for the analysis pipeline and Queues for retrieval fan-out; verify availability in region and plan, otherwise implement a Postgres job table plus cron drain.
- [ ] 6.8 [P0] Cron jobs (`vercel.json`): edition generation per place at 05:00 local, nightly evals, 1-minute model health checks, cache warmers, retention purge, corrections RSS rebuild, symmetry-report aggregation.
- [ ] 6.9 [P1] Vercel Firewall/WAF rules and rate limits on `/api/check`, `/api/dialogue`, `/api/rate`; BotID on write and LLM-triggering endpoints; attack challenge mode runbook.
- [ ] 6.10 [P0] Security headers: strict nonce-based CSP, HSTS preload, `frame-ancestors 'none'`, Referrer-Policy, Permissions-Policy.
- [ ] 6.11 [P1] Rolling Releases and an instant-rollback runbook; production promotion requires the eval gate to be green.
- [ ] 6.12 [P0] Custom domains (needs: 2.3), with locale-prefix routing working on them.

## 7. Data model and database
- [ ] 7.1 [P0] Drizzle schema and migrations for: `users`, `user_political_self_id` (separate table, separate key), `user_preferences` (encrypted), `subscriptions`, `places`, `topics`, `claims` (with `embedding vector(1024)`), `claim_places`, `claim_topics`, `analyses` (versioned, immutable), `analysis_renderings` (per language), `analysis_sources`, `sources`, `outlets`, `actors`, `actor_places`, `actor_claims`, `actor_dimension_scores`, `actor_replies`, `appeals`, `corrections`, `briefing_editions`, `edition_stories`, `quiz_items` (+ translations), `quiz_responses` (no user_id), `error_reports`, `review_tasks`, `audit_log`, `llm_calls`, `jobs` (if the Workflow fallback is used).
- [ ] 7.2 [P0] Row-Level Security on user-owned rows; DB roles (app, reviewer, admin, analytics read-only).
- [ ] 7.3 [P0] Application-level AES-256-GCM encryption helpers with key IDs and rotation: separate key classes for political self-ID, preferences and push subscriptions.
- [ ] 7.4 [P0] pgvector indexes (HNSW) for the claim semantic cache and source dedup; text-hash unique index.
- [ ] 7.5 [P0] Content-addressed cache keys: claim hash + model set + prompt version (+ language for renderings).
- [ ] 7.6 [P0] Seed places (ISO 3166-1/2 with names in six languages plus local official names, time zones, coverage level) and topics (taxonomy v1) (needs: 3.9, 3.10).
- [ ] 7.7 [P1] Retention jobs: daily-salted IP hashes deleted after 7 days; logs after 30 days; account-linked query text de-linked after 90 days.
- [ ] 7.8 [P1] Backups and restore drill (Neon point-in-time restore); old snapshots archived to Blob.

## 8. Design system and app shell
- [ ] 8.1 [P0] Design tokens: paper `#F7F5F0`, ink `#1C1F24`, ochre accent `#C98A1B`, monochrome intensity scale; no red/blue/purple/green/orange/teal as semantic colours; editorial type scale with full Latin Extended coverage (ç, ß, ã, õ, ñ, à, è…).
- [ ] 8.2 [P0] Verdict chip: one distinct shape per grade + word label + monochrome intensity (never colour-only), in all six languages.
- [ ] 8.3 [P0] Core components: input box (text/URL/image/voice), cards, tier badges, confidence indicator, model-agreement indicator, banners ("Models disagree", "Backup provider", "Stale data"), side sheet, tabs, disclosure/accordion, toasts, empty states.
- [ ] 8.4 [P0] App shell: header with scope chip and language menu; bottom nav on mobile (Check · Today · Ledger · More); two-pane on tablet landscape; three columns on desktop (claims · evidence · sources); keyboard shortcuts (`/` focus input, `j/k` navigate).
- [ ] 8.5 [P0] Motion that respects `prefers-reduced-motion`; plain-language mode (CEFR B1) toggle wiring.
- [ ] 8.6 [P0] Accessibility baseline: focus styles, skip links, landmarks, live regions for streaming results, form errors.
- [ ] 8.7 [P1] Storybook (or equivalent) with locale and viewport toolbars, including the pseudo-locale.

## 9. Accounts, auth and privacy center
- [ ] 9.1 [P0] *Decide* Auth.js vs Neon Auth (verify passkeys, magic links, EU data, RLS integration).
- [ ] 9.2 [P1] Anonymous-first: every core feature works without an account; local history and preferences in IndexedDB.
- [ ] 9.3 [P1] Sign-in with passkeys + email magic links (Resend, localized); optional Google/Apple OAuth, never required.
- [ ] 9.4 [P1] Account sync of preferences, follows and history (encrypted, 7.3); merge local → account on first sign-in.
- [ ] 9.5 [P1] Privacy center: export (JSON), delete account (hard delete with confirmation), withdraw consents, view what is stored.
- [ ] 9.6 [P1] Optional political self-placement: explicit Art. 9 consent screen, separate encrypted table, aggregate use only (k ≥ 50), deletable at any time; never joined with preferences or behaviour.
- [ ] 9.7 [P1] Per-user quotas and per-IP-hash quotas for anonymous use (20 checks/hour anonymous, 60 signed-in).

## 10. AI provider layer (Venice primary, AI Gateway fallback)
- [ ] 10.1 [P0] Venice client through the AI SDK OpenAI-compatible provider (`https://api.venice.ai/api/v1`), with `json_schema` structured output and Zod validation.
- [ ] 10.2 [P0] Model role routing table in Edge Config: decomposition/classification (small Private), query planning/reading (mid Private, no tools), Adjudicator A (US frontier, Anonymized, public content only), Adjudicator B (Chinese or European open-weight, Private), reconciler/writer (rotating third model), renderer per language, Push back (Private).
- [ ] 10.3 [P0] Privacy-tier enforcement: steps touching user-submitted text may only use Private/TEE models; unit tests prove it.
- [ ] 10.4 [P0] Prompt registry: versioned prompts in `/prompts` (CC BY 4.0), per-language variants and few-shot examples for the six languages, content hash recorded on every call.
- [ ] 10.5 [P0] Error-class handling: 429 → honour reset header, retry once with jitter, else fallback; 5xx/timeout → retry once (250 ms→1 s), then fallback; 4xx schema → one repair prompt, no fallback; 401/402 → immediate fallback and page on-call; content refusal → alternate Venice model, then fallback.
- [ ] 10.6 [P0] Timeouts: first token 8 s, 45 s per step, 90 s for adjudication.
- [ ] 10.7 [P0] Per-model circuit breaker (state in KV, overrides in Edge Config): opens after 5 failures in 60 s or p95 > 3× baseline; half-open probe every 30 s; manual override.
- [ ] 10.8 [P0] AI Gateway fallback with a static model mapping (same family and origin; otherwise a different origin, flagged) that preserves multi-origin adjudication; zero-data-retention routing for user-text steps.
- [ ] 10.9 [P1] Health-check cron (1 min) with a tiny completion per critical model, feeding the breaker and the public status page.
- [ ] 10.10 [P0] `llm_calls` logging: provider, model, step, tokens, cost, latency, error class; OpenTelemetry spans. Never send user identifiers to providers.
- [ ] 10.11 [P1] Spend controls: app-level daily spend ceiling, Gateway budget alerts; during fallback only Check and Briefing run (dialogue pauses with a friendly localized message).
- [ ] 10.12 [P0] Contract tests for the Venice and Gateway adapters (recorded fixtures).

## 11. Retrieval, sources and sandboxed fetching
- [ ] 11.1 [P0] Sandboxed fetcher on Vercel Sandbox: egress allow-list, private-IP and SSRF blocking, size and time limits, HTML and PDF rendering, OCR for images (all six languages).
- [ ] 11.2 [P0] Prompt-injection defences: retrieved text wrapped in inert data blocks, separate tool-less "reader" calls, hidden text and HTML comments stripped, schema validation; retrieved content can never change instructions, tools or fetched URLs.
- [ ] 11.3 [P0] Venice web search with results returned as documents (primary).
- [ ] 11.4 [P1] *Decide* and integrate a secondary search API (Brave / Exa / Tavily) for diversity and cross-checks.
- [ ] 11.5 [P1] Primary-data connectors: Eurostat, INE, OECD, World Bank, BOE/EUR-Lex, US Census/BLS, CIS barometers, CENDOJ, parliamentary records, Wikidata (entity resolution only).
- [ ] 11.6 [P2] Connectors for new country editions: ONS/UK Parliament, INSEE/Légifrance, Destatis/Bundestag, ISTAT/Normattiva, INE-PT/DRE, INEGI/DOF, plus regional statistics offices for regional editions.
- [ ] 11.7 [P0] Source snapshotting to Blob (dated, hashed) for every cited page; respect robots.txt; snapshots private; only short quotes displayed.
- [ ] 11.8 [P0] Outlet registry: type, country, language. **No** left/right bias scores.
- [ ] 11.9 [P0] Retrieval that is aware of place and language: per-claim query plans use place tags to pick authoritative local sources and search in the claim's language plus English; deliberately retrieve outlets from both sides when coverage diverges.

## 12. Truth-seeking pipeline (F1 engine)
- [ ] 12.1 [P0] Workflow skeleton: each stage is a durable, retryable step with persisted state and OpenTelemetry spans; progress events streamed to the UI.
- [ ] 12.2 [P1] Stage 1, ingest and normalize: URL fetch (11.1), text extraction and OCR, source-language detection, canonicalization, hashing; exact and semantic cache hit (≥ 0.92) → reuse with "previously analyzed on <date>, refresh?".
- [ ] 12.3 [P1] Stage 2, claim decomposition into atomic claims typed Fact / Value / Prediction / Attribution / Framing.
- [ ] 12.4 [P1] Stage 2b, place and topic tagging (ISO codes + 1–3 taxonomy topics, with confidence; low confidence falls back to the parent).
- [ ] 12.5 [P1] Stage 3, retrieval with the tier plan (T1–T4) and the "≥ 2 independent sources, ≥ 1 T1/T2" rule.
- [ ] 12.6 [P1] Stage 4, evidence grading with confidence and a reason.
- [ ] 12.7 [P1] Stage 5, manipulation-technique detection (probability language for AI-generated media, never certainty).
- [ ] 12.8 [P1] Stage 6, multi-model adjudication: two models of different origin grade independently, a third reconciles; disagreement above threshold → "Models disagree" banner, both rationales, and a human review task.
- [ ] 12.9 [P1] Stage 7, mirror test for contested political claims; results logged per analysis and aggregated for audits.
- [ ] 12.10 [P1] Stage 8, composition into a **language-neutral structured analysis** (summary points, true/missing/wrong, each side's correct points only with evidence, sources, reasoning trace, model and prompt versions, timestamp).
- [ ] 12.11 [P1] Stage 8b, native rendering per language from the structured analysis (per-language prompts and style guides). Cached per (analysis version, language) and rendered on first request. Never changes grades, numbers or sources. Quotes stay in the original language with a labelled translation.
- [ ] 12.12 [P1] Cross-language consistency check on 100% of renderings (a second model verifies meaning, grades and numbers against the structured analysis); failures re-render once, then go to native review.
- [ ] 12.13 [P1] Verbatim quote verification (string match against the snapshot); unverified quotes are removed. Unsupported claims are auto-downgraded to "Not checkable".
- [ ] 12.14 [P1] Disclosure flags: model disagreement, fallback provider used, stale data (> 12 months), human-reviewed yes/no, AI-assisted badge (AI Act).
- [ ] 12.15 [P1] Versioning and corrections: analyses are immutable; a correction creates a new version with a public diff and reason; feeds the corrections log and RSS.
- [ ] 12.16 [P1] Values handling: Value claims are never graded; they route to the steelman composer ("Values question: here are the strongest arguments").
- [ ] 12.17 [P1] Performance work to hit p50 < 25 s cached-similar and p95 time-to-first-result < 20 s (streaming partial results, parallel retrieval, small models for early stages).

## 13. Check experience (F1 UI)
- [ ] 13.1 [P1] Home: one large input ("Paste something you saw, or ask a question"), with paste/URL/image upload/voice (speech-to-text in six languages), "Today's Parallax" card, updates on follows, recent checks.
- [ ] 13.2 [P1] Share-target handling (`/check` receives POSTed text, URLs and images from the OS share sheet).
- [ ] 13.3 [P1] Streaming progress view with honest stage labels.
- [ ] 13.4 [P1] Result screen: verdict chip, 3-line summary, true/missing/wrong, "Each side gets right" (may be empty), sources with tier badges and verified quotes (original + labelled translation), model agreement, disclosure banners, collapsed reasoning trace, model and prompt versions.
- [ ] 13.5 [P1] Progressive disclosure: headline → summary → evidence → reasoning → raw sources.
- [ ] 13.6 [P1] "Report an error" flow (creates `error_reports`, which feeds the review queue and the 72 h SLA clock).
- [ ] 13.7 [P1] "Re-run with other models": choose an alternative model mix and show the diff against the original.
- [ ] 13.8 [P1] Version history with public diffs.
- [ ] 13.9 [P1] Follow this analysis (notifies on correction, update or resolution).
- [ ] 13.10 [P1] Share card (claim + evidence, never a "FALSE" stamp over a face), localized.
- [ ] 13.11 [P1] Public, cacheable analysis pages per language (ISR / `use cache`, tag revalidation on new versions).

## 14. Push back dialogue
- [ ] 14.1 [P1] User-initiated chat from any result: accuracy-first prompt, no persuasion goal, every factual statement cited, concedes where the user is right, max 10 turns.
- [ ] 14.2 [P1] Replies in the user's message language if supported, otherwise the UI language; Private models only.
- [ ] 14.3 [P1] Guardrails: stays on the claim, refuses to tell users how to vote, handles abuse calmly; pauses with a localized message during fallback.
- [ ] 14.4 [P1] Eval set for dialogue accuracy and tone in all six languages.

## 15. Places, topics and personalization (F6)
- [ ] 15.1 [P1] Preferences model (local IndexedDB for anonymous users, encrypted sync when signed in): up to 5 places with home flag and Focus/Include mode, Global on/off, topic states (Follow/Neutral/Mute), follows, briefing settings, channels, quiet hours, pause.
- [ ] 15.2 [P1] Default suggestion: home country from browser locale region subtag and coarse IP country (suggestion only, never stored) + Global; user confirms. No Geolocation API.
- [ ] 15.3 [P1] Place picker: search and browse country → region, coverage level shown, local official names.
- [ ] 15.4 [P1] Topic picker: two-level list with Follow/Neutral/Mute, search, "skip keeps everything neutral".
- [ ] 15.5 [P1] Header scope chip: session-only quick switch without changing saved preferences.
- [ ] 15.6 [P1] "Your Parallaxa" screen with a live preview ("With these settings, today's briefing would be…").
- [ ] 15.7 [P1] Filtering engine (pure, client-side capable): applies place and topic filters to editions, Ledger lists and quiz items; never touches Check results or analysis content.
- [ ] 15.8 [P1] "Why am I seeing this?" explanation on every briefing card and alert.
- [ ] 15.9 [P1] "Outside your filters" slot: on by default, labelled, can be switched off, with a reminder every 90 days when off.
- [ ] 15.10 [P1] Coverage honesty: fallback from region to country to Global with localized disclosure text.
- [ ] 15.11 [P1] Subscriptions: follow topics, places, analyses (P1), actors (P2); in-app and push channels (P1); weekly email digest (P2); RSS per topic and place without an account (P2).
- [ ] 15.12 [P1] Notification budget enforcement: ≤ 1 routine per day, ≤ 3 requested follow-ups per day, quiet hours, pause.
- [ ] 15.13 [P1] Automated test: analyses, grades and side-by-side cards are byte-identical across preference profiles.
- [ ] 15.14 [P2] On-device topic suggestions (computed locally, shown as suggestions that need acceptance).

## 16. Daily Parallax (F2)
- [ ] 16.1 [P1] Edition model: one Global, one per supported country, one per supported region; a ranked pool of 5–10 candidate stories per edition by the published selection rules.
- [ ] 16.2 [P1] Edition generation cron at 05:00 local per place: candidate discovery, analysis via the pipeline, card composition (what happened, place, topic, what's disputed, each side right/wrong, one perception-gap fact).
- [ ] 16.3 [P1] Review flow: editor plus at least one cross-partisan reviewer before 07:00 (P1 minimum: one human, always disclosed); native-language spot review of renderings.
- [ ] 16.4 [P1] Deterministic personal assembly (no model call): match places, weight followed topics, drop muted ones, add the outside-filters slot, apply the length (3/5) and depth (Quick/Standard) settings; runs client-side for anonymous users and server-side for push and email.
- [ ] 16.5 [P1] Briefing UI: ≤ 5 cards, swipe on mobile and arrow keys on desktop, the "You're up to date. See you tomorrow." end state, and no feed below.
- [ ] 16.6 [P1] Delivery at the user's chosen time and days via push; offline reading of the last 3 briefings.
- [ ] 16.7 [P1] Weekly symmetry audit per edition (whose claims were checked and why), published in the Trust Center.
- [ ] 16.8 [P1] Pilot editions: Global, Spain, US, and 2–3 Spanish autonomous communities.
- [ ] 16.9 [P2] All Spanish autonomous communities and the largest US states (as review capacity allows); UK, France, Germany, Italy, Portugal and Mexico country editions.
- [ ] 16.10 [P3] Regional editions for France, Germany, Italy and Portugal.

## 17. Actor Ledger (F3)
- [ ] 17.1 [P1] Actor model and admin: types (politician, party, government/country, public figure, influencer ≥ 100k reach, company, entrepreneur, media outlet), places, verified contact. Private individuals are never profiled.
- [ ] 17.2 [P1] Link analyzed claims to actors (`actor_claims`) with reach weighting.
- [ ] 17.3 [P1] Dimension scoring jobs: factual reliability (n ≥ 10), correction behaviour, data integrity, integrity record (final rulings only), influence-operation links (sourced, with confidence), civility of conduct; prediction calibration (Brier score) in P2. Sample size and confidence on each; no overall score.
- [ ] 17.4 [P1] Actor page: dimension tiles with n and confidence, analyzed claims, positive conduct, actor reply, appeal status; conduct-only phrasing in all six languages (natively and legally reviewed).
- [ ] 17.5 [P1] Read-only launch scope: parties and national leaders in Spain and the US; legal review of the first 100 profiles (needs: 2.6, 2.10).
- [ ] 17.6 [P1] Filters by country, region and topic.
- [ ] 17.7 [P2] Right of reply: verified-contact "Respond" channel, ≤ 300 words + links, published within 5 business days; a rebuttal with new evidence triggers re-review within 10 business days.
- [ ] 17.8 [P2] Appeals: stage 1 editorial re-review by a different reviewer and model pair; stage 2 panel decision published with reasons.
- [ ] 17.9 [P2] Statutory rectification workflow (LO 2/1984 deadlines) and equivalents for new countries.
- [ ] 17.10 [P2] Regional actors (regional presidents, governments, parliaments, regional outlets) and actors for the new country editions.
- [ ] 17.11 [P2] Follow actors (new analyses, replies, appeal results).

## 18. Depolarization features (F4)
- [ ] 18.1 [P1] Side-by-side card: "What [left/progressive] voices get right · What [right/conservative] voices get right · What the evidence says"; labels per country (3.11); sections may be empty; no logos or party colours.
- [ ] 18.2 [P1] Perception-gap quiz: slider guess → reveal the real survey value with source and margin of error → reflection prompt; published surveys only (More in Common, CIS, Pew, Eurobarometer, regional institutes such as CEO); question wording in the user's language with a link to the original; items matched to the home place and followed topics; regional items only with adequate samples.
- [ ] 18.3 [P1] Quiz content for Spain and the US (P1); UK, FR, DE, IT, PT and MX (P2).
- [ ] 18.4 [P1] Anonymous quiz responses (no user_id) for aggregate before/after error measurement.
- [ ] 18.5 [P1] Steelman composer for value questions (the strongest version of each position, written to be endorsed by its holders); cross-partisan rater validation and bridging score in P2.
- [ ] 18.6 [P1] Moral reframing hints (why the fact matters across care, fairness, liberty, loyalty and authority) without changing the fact.

## 19. Trust Center and transparency (F5)
- [ ] 19.1 [P1] Trust Center pages in six languages: methodology, grades, tiers, selection rules, rubric, prompts (linked to the repo), model list and roles, funding and donors, panel bios, legal entity.
- [ ] 19.2 [P1] Per-analysis provenance: model IDs, provider (Venice or fallback), prompt hash, human-review status.
- [ ] 19.3 [P1] Public corrections log with diffs and reasons; RSS feed per language.
- [ ] 19.4 [P1] Symmetry and audit reports: mirror-test aggregates, story mix per edition, Ledger outcomes by party family, with raw data downloads (quarterly from P2).
- [ ] 19.5 [P1] Public status page (model health, fallback in use, incidents).
- [ ] 19.6 [P1] Eval results page (accuracy, calibration, parity, language parity) updated on every release.
- [ ] 19.7 [P2] External audit publication.

## 20. PWA, offline and notifications
- [ ] 20.1 [P1] Manifest: name, short_name "Parallaxa", icons 192/512 + maskable, `display: standalone`, `share_target` (POST text/url/images → `/check`), one per language (4.11).
- [ ] 20.2 [P1] Service worker (Serwist): precache the shell; network-first for API; stale-while-revalidate for briefings; offline reading of the last 3 briefings and saved checks; background-sync queue for offline checks.
- [ ] 20.3 [P1] Web Push (VAPID): opt-in after the second meaningful session, never on the first visit; on iOS only inside the installed app (iOS/iPadOS 16.4+); subscriptions encrypted at rest; payloads localized.
- [ ] 20.4 [P1] Install reminders: only after ≥ 2 visits on different days and ≥ 1 completed check or briefing; in-page bottom banner, never a modal; `beforeinstallprompt` on Android and desktop; illustrated 3-step iOS sheet; max once per 14 days; stop after 2 dismissals; never during a check or quiz; manual Install in settings.
- [ ] 20.5 [P1] Onboarding (≤ 60 s, skippable, no sign-up): detected language with switcher → three panels → place picker → optional topic picker → demo (each side one right, one wrong) → "Don't trust us? Good." hook.

## 21. Editorial and review console (internal)
- [ ] 21.1 [P1] Roles and permissions: editor, reviewer, native language reviewer, panel member, legal, admin; every action written to `audit_log`.
- [ ] 21.2 [P1] Queues: model disagreements, briefing editions, Ledger entries, error reports (72 h SLA timer), appeals, replies, failed consistency checks, 2% cross-partisan sampling of outputs.
- [ ] 21.3 [P1] Review UI: side-by-side model rationales, sources and snapshots, renderings in all six languages next to the structured analysis, approve / edit / escalate / correct.
- [ ] 21.4 [P1] Panel workflows: votes requiring one member from each bloc, decisions published with reasons.
- [ ] 21.5 [P1] Reviewer scheduling for the 05:00–07:00 briefing window per time zone and language.

## 22. Evaluation and quality gates
- [ ] 22.1 [P0] Eval harness: run the pipeline on the gold set and compute grade accuracy, macro-F1, calibration (ECE), citation precision and source-tier quality.
- [ ] 22.2 [P1] Even-handedness suite: mirror pairs (parity ±0.1), refusal symmetry, outcome reporting by side.
- [ ] 22.3 [P1] Language parity suite: the same claims in six languages; ≥ 98% cross-language grade agreement; native fluency and terminology ratings ≥ 4.5/5 (es-ES raters for Spanish); es-ES lexicon check (4.14).
- [ ] 22.4 [P1] Tag accuracy evals: country ≥ 95%, region and topic ≥ 90%.
- [ ] 22.5 [P1] Nightly regression on the gold set, with alerts.
- [ ] 22.6 [P1] Release gate in CI: no prompt or model change ships if accuracy drops > 1 point or any symmetry or language-parity metric regresses beyond tolerance.
- [ ] 22.7 [P2] Perceived-slant panels (Westwood-style) stratified by ideology in ES, US, UK and MX, then FR, DE, IT and PT; goal: no significant perceived slant on ≥ 80% of topics.
- [ ] 22.8 [P1] Hallucination tests: quote verification coverage, "Not checkable" downgrade behaviour, prompt-injection red-team set.

## 23. Security and abuse prevention
- [ ] 23.1 [P1] Rate limits and quotas (WAF + app level), BotID on expensive and write routes, account age and reputation signals.
- [ ] 23.2 [P1] Anomaly detection for rating bursts, coordinated reports and brigading on errors and appeals.
- [ ] 23.3 [P1] Secrets: environment-scoped Vercel env vars, quarterly rotation runbook, no secrets in client bundles (CI check).
- [ ] 23.4 [P1] Abuse reporting channel; no bulk API in the MVP.
- [ ] 23.5 [P1] Third-party penetration test before public launch (focus: SSRF, prompt injection, auth, RLS); fix all high and critical findings.
- [ ] 23.6 [P1] Incident response plan (security, model outage, viral error, legal notice) with on-call rotation.

## 24. Observability, cost control and operations
- [ ] 24.1 [P0] OpenTelemetry traces per pipeline step (model, latency, tokens, cost); Vercel Observability dashboards.
- [ ] 24.2 [P1] Speed Insights and cookieless Web Analytics (no third-party pixels).
- [ ] 24.3 [P1] SLO monitoring and alerts: 99.5% Check availability, p95 time-to-first-result < 20 s, briefing ready by 06:45 local on 99% of days.
- [ ] 24.4 [P1] Cost dashboard: cost per fresh analysis (target $0.08–$0.15), cache-hit rate (30% → 70%), rendering cost per language, briefing cost per edition, daily spend vs ceiling.
- [ ] 24.5 [P1] Guardrail alarms: average session > 15 minutes; < 60% of users keep "outside your filters" on; topic diversity below the edition baseline; > 10% manual switches away from the detected language.
- [ ] 24.6 [P1] Runbooks: Venice outage, Gateway fallback, briefing late, viral error correction, rollback.

## 25. Research and experimentation
- [ ] 25.1 [P1] Opt-in research consent flow (localized), ethics review with academic partners.
- [ ] 25.2 [P1] A/B bucketing in middleware (cookie, no PII).
- [ ] 25.3 [P1] Instruments: feeling thermometer (affective polarization), perception-gap error, "I felt respected / calmer", "briefing relevant to me", trust by self-placed ideology (opt-in), in six languages with validated translations.
- [ ] 25.4 [P2] First pre-registered RCT (2- and 8-week follow-ups), benchmarked against the megastudy's best treatments; publish all results, including nulls.

## 26. Community review (bridging) [P2]
- [ ] 26.1 [P2] Invite-only reviewer program with reputation.
- [ ] 26.2 [P2] Bridging-based rating algorithm (ratings count when people who usually disagree agree), with brigading defences.
- [ ] 26.3 [P2] Ratings feed into the human review queues, never directly into grades.
- [ ] 26.4 [P2] DSA notice-and-action, statements of reasons and point of contact for hosted user content (needs: 2.8).

## 27. Phase 2 and 3 features
- [ ] 27.1 [P2] Prediction tracker: capture resolvable predictions, resolution rules, Brier scores, feed into the Ledger calibration dimension.
- [ ] 27.2 [P2] Prebunk micro-lessons on manipulation techniques, with examples balanced across sides, in six languages.
- [ ] 27.3 [P2] Weekly email digest and RSS per topic and place (15.11).
- [ ] 27.4 [P3] Browser extension (context at the moment of exposure; same privacy rules).
- [ ] 27.5 [P3] Debate maps for deep divers.
- [ ] 27.6 [P3] Common-ground rooms pilot (Habermas-style AI mediation, moderated).
- [ ] 27.7 [P3] Personal "bias mirror" (on-device only).
- [ ] 27.8 [P3] Municipal scope pilot (decide after evaluating source and review cost).
- [ ] 27.9 [P3] Institutional licences (newsrooms, schools, researchers) with citable exports.
- [ ] 27.10 [P3] Evaluate further languages (e.g., Spain's co-official languages Catalan, Basque and Galician; Dutch; Polish) against reviewer capacity.

## 28. Launch readiness
- [ ] 28.1 [P1] Closed beta: invite list balanced across left, centre and right in each language; feedback channel; weekly review of metrics and errors.
- [ ] 28.2 [P1] Content seeding: a symmetric showcase of examples (each side right and wrong) in every language for the landing page and onboarding.
- [ ] 28.3 [P2] Launch partners and creators from across the spectrum in each launch country.
- [ ] 28.4 [P2] Public launch checklist: legal sign-offs (2.6, 2.9, 2.10), pen test fixed (23.5), eval gates green, SLOs met for 2 weeks, first symmetry audit published, panel active, support rota staffed in six languages.
- [ ] 28.5 [P2] Post-launch review at 30 days: metrics vs targets (PRD 10), honest public report.

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
