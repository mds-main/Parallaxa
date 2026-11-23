# PRD.md — Parallaxa: a calm, open, cross-partisan reality check

Parallaxa should be built as an open, model-plural, evidence-first web app/PWA that earns trust from distrustful people by applying one published standard to every side and showing all its work. It combines on-demand claim checks with a short daily briefing, an actor "conduct ledger," and research-backed depolarization tools. It should treat "the truth is not always in the center" as a hard rule and reject engagement optimization outright.

## TL;DR

- **What to build:** a Next.js PWA on Vercel + Neon Postgres. The core is a transparent truth-seeking pipeline: claim decomposition, primary sources first, graded evidence, and facts kept separate from values and predictions. It is surfaced through three entry points: **Check** (reactive: paste, share or ask), **Daily Parallax** (proactive: a finite briefing of at most five stories), and **Ledger** (behaviour-based actor track records with right of reply). Venice AI is the primary model provider and Vercel AI Gateway is a circuit-broken fallback.
- **Made for each person:** every user chooses *where* they care about (global, one or more countries, or a region within a country) and *what* they care about (topics to follow or mute, actors and stories to follow), plus how much, when and how they want it. Personalization narrows by **place and topic only, never by side**: every story still shows every side, and Check is never filtered (F6).
- **Three AI perspectives, swappable:** every claim is investigated independently by at least three models chosen for their different perceived leanings and origins: a US model perceived as right-leaning (e.g., xAI Grok), a US model perceived as left-leaning (e.g., OpenAI GPT, Claude or Gemini) and a Chinese model (e.g., DeepSeek or Kimi). Each runs the same neutral prompts with a full investigation harness on Venice (web search, scraping, primary-data tools, and X search on Grok), and a published rule combines their verdicts. An operator **admin console** (F8) swaps models, tunes settings and monitors the main metrics without a deploy.
- **Speaks your language:** launches in **English (`en`) and Spanish from Spain (`es-ES`, not Latin American Spanish)**. The language is picked automatically from the browser's language settings and falls back to English when neither matches. Users can change it at any time, and AI output is written natively in each language, not machine-translated after the fact. Everything is built so more languages can be added later as configuration and content work, with no core code changes (F7).
- **Why this design:** the evidence says facts *can* move people. Corrections rarely backfire (Wood & Porter 2019; Nyhan 2021). Tailored AI dialogues cut belief in participants' chosen conspiracy theory by 16.8 points more than a control, roughly a 20% reduction, and the effect held for at least two months (Costello, Pennycook & Rand, *Science* 385, eadq1814, 2024). Brief interventions also reduce partisan animosity (23 of 25 in the Stanford megastudy, *Science* 2024). But messenger distrust is the binding constraint: users of all parties perceive mainstream LLMs as left-leaning (Westwood, Grimmer & Hall 2025). So trust has to be *engineered*: several models of different national origin, published prompts, symmetric "mirror tests," cross-partisan review, and visible uncertainty.
- **What to expect honestly:** an app cannot "fix" polarization. Realistic goals are measurable gains in calibration, smaller perception gaps, and lower animosity among users, plus a reputation for being *right against both sides when warranted*. The name "Parallaxa" was chosen because parallax is how you measure true position by looking from two viewpoints. It does not say "truth" or "fact-check," and it reads naturally in English, Spanish and most other European languages. Domain and trademark availability could **not** be fully verified and must be cleared before launch.

---

## 1. Problem statement (evidence-based)

### 1.1 What polarization is, and what is actually broken
- **Ideological polarization** means policy positions drifting apart. **Affective polarization** means disliking and distrusting the other side's *people*. Most of the damage comes from the second, plus **false polarization**: believing the other side is more extreme than it is.
- **Perception gaps are large and fixable.** More in Common's *Perception Gap* study (Yudkin, Hawkins & Dixon, June 2019) found that, on average, US partisans believe 55% of their opponents' views are extreme when only about 30% are. Democrats estimated 53% of Republicans held extreme views (actual 34%); Republicans estimated 56% of Democrats did (actual 29%). The gap is largest among the most politically active "wings," and it widens with heavier news consumption.\[1\]\[2\]
- **Spain/Europe:** In comparative work across 20 democracies, Gidron et al. (2020) identified Spain as the most affectively polarized country. Torcal & Comellas (2022) document peaks around the 2008 and 2015 general elections.\[3\] A 2025 study in *Papers* finds that *misperceived* ideological distance feeds animosity in Spain, the same mechanism More in Common found in the US.\[4\]
- **Social media's causal role is contested, not proven.** In the 2020 Meta election studies, a chronological feed (Guess et al., *Science* 2023) changed what users saw: time on platform fell and exposure to untrustworthy content *rose*, but affective and issue polarization did not change significantly over three months.\[5\]\[6\] Cutting exposure to like-minded sources (Nyhan et al., *Nature* 2023) also left polarization unchanged.\[7\] A Science eLetter by Bagchi et al. (UMass Amherst, September 2024) notes that Meta introduced 63 "break-glass" changes to Facebook's algorithmic feed during the experiment, which altered the control condition. **Implication:** ranking changes alone are no silver bullet; what matters is the content and framing people meet, and who delivers it.\[8\]

### 1.2 How minds handle political information
- **Well established:** motivated reasoning and identity-protective cognition, confirmation bias, naive realism ("I see things as they are; the other side is biased"), the hostile media effect (both sides see neutral coverage as biased against them), reactance (being told what to think triggers resistance), and the illusory truth effect (repetition increases perceived truth).
- **Weaker than popularly believed:** the "backfire effect." Wood & Porter (*Political Behavior* 41:135–163, 2019) ran five experiments with more than 10,100 participants on 52 issues and found no correction capable of triggering backfire. Nyhan (2021, *PNAS*), co-author of the original backfire paper, concludes backfire is rare; the real problem is that corrections *decay* and get drowned out by elite cues.\[9\]\[10\] **Implication:** correct clearly and repeatedly, from trusted-feeling messengers, and give people a reason to come back.

### 1.3 What works (with effect sizes and durability)
| Intervention | Best evidence | Effect | Durability / caveats |
|---|---|---|---|
| Brief depolarization treatments | Voelkel et al., *Science* 2024, n = 32,059, 25 treatments | 23/25 reduced partisan animosity (up to 10.5 pp); 6 reduced support for undemocratic practices (up to 5.8 pp); 5 reduced support for partisan violence (up to 2.8 pp)\[11\] | Effects shrank by 2 weeks; lower animosity did **not** automatically improve democratic attitudes; correcting misperceptions of rivals was among the best for democratic attitudes\[12\] |
| AI evidence dialogues | Costello, Pennycook & Rand, *Science* 2024 (GPT-4 Turbo; N = 2,190 in the preprint, 2,044 on the current *Science* page) | Belief in the chosen conspiracy fell 16.8 points more than control (95% CI 13.8–19.7, d = 1.15), roughly a 20% reduction; spillover to unrelated conspiracies | Persisted at 2 months. *Science* later issued an Editorial Expression of Concern over dataset/reporting inconsistencies; Boissin et al. (*PNAS Nexus* 2025) found the effect even when the AI was perceived as human\[13\]\[14\]\[15\] |
| AI-mediated common ground | Tessler et al. ("Habermas Machine"), *Science* 386, eadq2852 (2024), 5,734 UK participants, mostly in groups of five | AI group statements preferred over human mediators' (>56%), rated more impartial, incorporated minority critiques | Critics: consensus optimization can flatten legitimate dissent and does not evaluate truth\[16\]\[17\] |
| Prebunking / inoculation | Roozenbeek et al., *Science Advances* 2022: ~30,000 participants incl. YouTube field test | Better recognition of manipulation techniques, consistent across liberals and conservatives | Small field effects (Cohen's h ≈ 0.06–0.13); measured ~18–24 h later\[18\]\[19\] |
| Bridging-based crowd context | X Community Notes; Renault et al. 2024; *PNAS* 2025 study of 40,078 posts | Attached notes roughly halve reposts and raise deletion; notes trusted more than bare flags across leanings (Drolsbach et al., *PNAS Nexus* 2024)\[20\]\[21\]\[22\] | Slow (hours, after most spread); many accurate notes never reach "helpful"\[23\]\[24\] |
| Accuracy nudges; deep canvassing, deliberative polling, citizens' assemblies | Pennycook & Rand; field experiments; Fishkin; Irish and French assemblies | Small gains in sharing discernment; attitude change via respectful, sustained conversation | Modest effects; labour-intensive; online scaling unproven |

### 1.4 The AI paradox: powerful persuasion, contested trust
- **LLMs persuade, and persuasion can cost accuracy.** Hackenburg et al. (*Science* 2025) tested 19 models on 707 issues: post-training and prompting raised persuasiveness by up to 51% and 27%, driven by information density, and the most persuasive configurations were systematically *less accurate*.\[25\]\[26\] **Implication:** optimize for accuracy and calibration, never persuasion.
- **Perceived bias is the trust bottleneck.** Westwood, Grimmer & Hall (Stanford/Hoover, 2025) collected 180,126 judgments of 24 models on 30 topics. Nearly all models were perceived as left-leaning, including by many Democrats, with OpenAI models perceived as most slanted. Prompting models toward neutrality reduced perceived slant and *increased* willingness to use them.\[27\]\[28\]\[29\] Other 2026 work finds models look progressive on abstract value surveys but closer to centrist on concrete policy trade-offs, so "bias" depends on the instrument.\[30\]
- Distrust also attaches to a model's *origin*: some on the left see Claude/ChatGPT as US/Israeli or corporate instruments; some on the right see them as "woke." Grok/Grokipedia is the mirror image: an AI positioned as the counterweight is immediately distrusted by the other side.\[31\] **Implication:** no single model, vendor, or country can be the messenger.

### 1.5 Bad actors and their tactics
- **FIMI:** The EEAS 4th Report on FIMI Threats (March 2026) recorded 540 incidents in 2025, identifies elections as primary targets of Russian FIMI, notes Russian state-media funding rising to 146.3 billion roubles (about €1.56 billion) in 2026, and documents growing AI use (text generation, deepfakes, voice cloning).\[32\]\[33\]\[34\] Chinese and Iranian operations are documented by EEAS, Stanford Internet Observatory, DFRLab, and Meta/OpenAI/Microsoft threat reports.
- **Domestic tactics (across the spectrum):** rage-farming, astroturfing, cherry-picked time windows and baselines, clipped video, demonizing labels ("fascist," "communist," "traitor"), whataboutism to shield one's own side's corruption, and recasting broadly shared goods as tribal markers.
- **AI-generated content** lowers the cost of all of the above and creates a "liar's dividend": real evidence gets dismissed as fake.\[35\]

### 1.6 Lessons from existing products
| Product | What worked | Shortfall for our goal |
|---|---|---|
| Ground News / AllSides / Ad Fontes | Coverage spread, blind spots | Rate *outlets*, not claims; ratings contested; balance ≠ accuracy |
| Snopes, PolitiFact, Maldita, Newtral | Rigorous, sourced checks | Seen as partisan by the side checked more; top-down verdicts |
| Community Notes | Bridging consensus; cross-side trust | Slow, sparse. Renault, Mosleh & Rand (*PNAS* 2025): Republicans flagged more, so symmetric *rules* do not guarantee symmetric *results*\[36\] |
| Polis / vTaiwan, Kialo | Surface consensus; structured debate | Need facilitation; niche |
| Wikipedia NPOV | Due weight, open history, talk pages | Accused of systemic bias |
| Tangle, The Flip Side, Braver Angels | "Left/right/my take" formats; structured conversation | Human-scaled |
| Grok / Grokipedia | Draws mainstream-AI skeptics | Seen as owner-aligned |
| NewsGuard | Transparent criteria | Accused of partisanship; outlet-level |

**Synthesis:** People trust *processes* they can inspect and *standards* they see applied to opponents and themselves alike. They distrust verdicts from an institution coded to the other team.

---

## 2. Design principles (each tied to evidence)

1. **Truth over balance (non-negotiable).** Symmetric *rules*, not symmetric *outcomes*. If evidence shows one side is wrong more often on an issue, Parallaxa says so; Community Notes data shows even cross-partisan processes yield asymmetric outcomes. *Resolving the tension:* trust comes from (a) one published rubric, (b) visible mirror tests showing the rubric was applied to comparable claims from the other side, and (c) proactively surfacing where each side is *right*. Never from splitting the difference.
2. **Separate facts, values, and predictions.** Empirical claims get evidence grades; value disagreements get steelmanned, never "verified"; predictions get tracked and scored. This avoids the reactance and hostile-media triggers of "fact-checking opinions."
3. **Plural messengers, no single owner.** Every analysis is investigated independently by **at least three models chosen for their different perceived leanings and origins**: a US model widely perceived as right-leaning (e.g., xAI Grok), a US model widely perceived as left-leaning (e.g., OpenAI GPT, Anthropic Claude or Google Gemini), and a Chinese model (e.g., DeepSeek, Kimi, Qwen or GLM), perceived as left-leaning on many social questions and aligned with Chinese government positions by default on China-related topics. All of them get the same published, neutral, accuracy-first instructions and are never asked to argue a side: their different priors check each other. Material disagreements are shown, not hidden. This answers "the AI belongs to the other side." Models can be swapped at any time from the admin console (F8), and the current lineup and its change history are public.
4. **Show the work.** Every conclusion links to sources, quotes, reasoning, confidence, and prompt/model version. Explanations beat bare flags (Community Notes evidence).\[22\]
5. **Affirm before you challenge, truthfully.** Lead with what the user's side gets right *when that is true*, then correct. Never invent agreement. This lowers identity threat.
6. **Correct the picture of "them."** Perception-gap correction was among the most effective megastudy treatments for democratic attitudes.\[12\]
7. **Dialogue, not lecture.** Users can argue back; the AI answers with tailored evidence (the Costello et al. mechanism), bounded by accuracy-first prompts because persuasion-optimized AI loses accuracy.\[37\]
8. **Prebunk techniques, not tribes.** Teach manipulation patterns with examples drawn equally from all sides; effects were consistent across ideologies.\[38\]
9. **Calm by design.** No infinite feed, outrage ranking, streaks, or "dunk" sharing. A finite briefing respects the exhausted majority.\[39\]
10. **Privacy as a trust signal.** No ads, no tracking pixels; political views optional and minimal (GDPR Art. 9).
11. **Accountability for the app itself.** Public corrections log, bias audits, cross-partisan panel, published funding.
12. **Relevant to *you*, without a bubble.** A national briefing that ignores your region, or covers topics you never care about, wastes the limited attention the app asks for. Users choose their places and topics explicitly. Filters work on *where* and *what*, never on *which side* or *which outlets*, so personalization cannot turn into an echo chamber. A small "outside your filters" slot keeps major events visible, and every filter decision is explainable ("Why am I seeing this?").
13. **Native in every language, starting with two.** Trust drops when an app feels foreign or machine-translated. Each supported language (English and Spanish at launch) gets native UI copy, natively generated analyses, native reviewers, its own style guide, and the same quality and even-handedness bar (language parity is a release gate). Starting small keeps that bar affordable; the architecture makes adding languages cheap later.

---

## 3. Name and brand

### 3.1 Recommendation: **Parallaxa**
- **Meaning:** Parallax is how astronomers and surveyors find an object's *true* position by observing it from two viewpoints.\[40\] That is the product thesis: look from both sides to locate reality, which may not sit in the middle.
- **Why non-obvious:** no "truth," "fact," "check," "real," "neutral," or partisan words. It sounds like an observatory, not a referee.
- **Cross-language:** "parallax" (EN), "paralaje" (ES), "parallaxe" (FR), "Parallaxe" (DE), "parallasse" (IT), "paralaxe" (PT). The "-a" ending reads naturally in Spanish, Italian, and Portuguese. The brand name is never translated.
- **Tagline:**
  - **EN:** "See it from both sides. Find where it really stands."
  - **ES (es-ES):** "Míralo desde ambos lados. Descubre dónde está de verdad."
  - Taglines for future languages are written by native copywriters when each language is added.

### 3.2 Availability: what was and was not verified
| Candidate | Findings | Status |
|---|---|---|
| **Parallaxa** (recommended) | "Parallaxa Labs" (an OBS/VTuber plugin) claims the name as a trademark in its README; a wallpaper app and small design/photo sites use similar strings.\[41\]\[42\]\[43\]\[44\] No news/civic/AI conflict found. | **parallaxa.app NOT verified** (WHOIS/RDAP lookups were blocked during research); trademark registers not directly searched; moderate risk in Classes 9/42 |
| Triangula | triangula.com is **registered and live**: Triangula AS (Oslo), AI gunshot-location software | Rejected\[45\]\[46\] |
| Alidade | **Alidade AI** (Seattle, 2025), an "AI platform for gathering intelligence on the messaging landscape"; several USPTO ALIDADE filings | Rejected\[47\]\[48\]\[49\] |
| Mirador | Spanish news app "elMirador.app" already on the App Store; EU and US "MIRADOR" registrations exist | Rejected\[50\]\[51\]\[52\] |

**Required before launch:** (1) registrar check for parallaxa.app, .eu, .es, .com, .org (fallbacks: getparallaxa.app, parallaxa.eu); (2) EUIPO/OEPM/USPTO knockout search in Classes 9, 38, 41, 42; (3) counsel clearance opinion. Final availability can only be confirmed at registration time.

### 3.3 Visual identity (non-partisan by construction)
- **Avoid as primary/semantic colours:** red and blue (US parties; PP blue and PSOE red in Spain), purple (Podemos), green (Vox; Greens across Europe), orange (Ciudadanos) and teal (Reform UK). Never colour-code "left" and "right."
- **Palette:** warm neutral base (paper #F7F5F0, ink #1C1F24) with one **ochre/amber accent (#C98A1B)**. Evidence grades use **shape + label + monochrome intensity**, not traffic-light red/green.
- **Tone of voice:** curious, plain, non-humiliating, dry rather than snarky. Talk about *claims*, never mock *people*: "This claim is not supported by the data, because…", never "FALSE!!". The same tone holds in every language, set in a per-language style guide that native reviewers validate. Form of address: "tú"/"vosotros" in es-ES (Spain usage, never Latin American "ustedes"-as-informal, voseo forms or vocabulary) and a direct "you" in English. Each future language sets its form of address in its own style guide.

---

## 4. Users, jobs-to-be-done, non-goals

### 4.1 Personas
| Persona | Core need | Trust barrier |
|---|---|---|
| **Lucía, 34, Madrid: "exhausted majority"**, moderate, tired of shouting | "Tell me what's actually going on in 5 minutes" | Assumes every source has an agenda |
| **Marc, 27, Barcelona: committed progressive**, active on social media | "Check whether this viral claim is real before I share it" | Sees mainstream AI and fact-checkers as captured by capital/US interests |
| **Javier, 52, Valencia: committed conservative**, reads alternative media | "Show me what the media hides" | Sees fact-checkers and AI as "woke" |
| **Ana: journalist/researcher** | Citable, exportable evidence and actor histories | Needs methodology and reproducibility |

The same archetypes apply in the Americas (e.g., Ohio, Mexico City).

### 4.2 Jobs-to-be-done
1. "When I see a viral claim, help me know quickly whether it's true and *what's missing*, without making me feel stupid."
2. "When I wake up, give me a short, finite, calm view of what matters and where each side is right or wrong."
3. "When someone influential claims credibility, show me their track record on *both* honesty and good conduct."
4. "When I argue with family, help me understand the strongest version of their view, and mine."
5. "Show me I'm not being manipulated by *this app* either."
6. "Focus on the places I live in or care about (my region, my country, or the whole world) and on the topics I follow, and leave out what I don't."
7. "Tell me when something I'm following changes (a story I checked, a politician I watch, a topic I care about), without nagging me."

### 4.3 Non-goals
- Not a social network: no comment section, no follower counts.
- Never says whom to vote for.
- No verdicts on pure value questions (abortion, monarchy vs republic, immigration levels as such); it maps arguments and facts *within* them.
- No engagement maximization, infinite scroll, outrage ranking, or ads.
- Does not moderate or remove content on other sites.
- No personalization by ideology: users can never filter by "side," hide one side's arguments, or pick outlets by political lean. Interests are never inferred silently from behaviour (MVP uses only explicit choices).

---

## 5. Interaction models: evaluation and recommendation

| Model | Strengths | Risks | Decision |
|---|---|---|---|
| **Reactive "Check"** (paste text, URL, image, or share) | Meets users at moment of exposure | Users only check what they already doubt | **MVP core** |
| **Proactive "Daily Parallax"** (07:00 local) | Habit without addiction; prebunks before narratives harden | Story selection can look biased | **MVP core**, published selection rules + weekly symmetry audit |
| **Actor Ledger** | Serves "uncover bad actors / signal good actors" | Defamation; brigading | **MVP (limited)**; full rubric Phase 2 |
| **"What each side gets right / wrong"** | Affirm-then-correct | False balance if forced | **MVP**; sections may be empty |
| **Steelman view** | Reduces naive realism | Can legitimize falsehoods | **MVP**, value questions only |
| **Perception-gap quiz** | Among strongest evidence-based depolarizers | Needs per-country survey data | **MVP** (US + Spain) |
| **"Push back" dialogue** | Durable belief change via tailored evidence | Persuasion–accuracy trade-off | **MVP**, accuracy-first, user-initiated |
| **Prebunk micro-lessons** | Works across ideologies | Modest effects | **Phase 2** |
| **Prediction tracker & calibration** | Objective accountability | Resolution disputes | **Phase 2** |
| **Bridging-ranked community review** | Cross-partisan legitimacy; catches errors | Brigading; slowness | **Phase 2**, invite-only first |
| **Personal "bias mirror"** | Self-insight without shaming | Privacy | **Phase 3**, on-device only |
| **Browser extension, debate maps** | Context at exposure; structure for deep divers | Maintenance, effort | Share target in MVP; both **Phase 3** |
| **Common-ground rooms** (Habermas-style) | Strong consensus evidence | Moderation burden | **Phase 3 pilot** |
| **Notifications** | Retention | Annoyance | Opt-in, max 1/day + requested follow-ups |
| **Place & topic personalization** (global / country / region; follow & mute topics, actors, stories) | Relevance; respects limited attention; serves regional politics, which national coverage misses | Filter bubbles; thin regional sources; preferences can reveal political interest | **MVP core** (global + country + region filtering; regional editions where coverage allows), side-neutral by construction, local-first storage |
| **English + Spanish (es-ES) at launch, built for more** | Covers both launch markets (Spain, US); native feel builds trust; low translation and review cost | Translation errors; Spanish speakers outside Spain may notice Spain usage | **MVP core**, language-neutral analyses rendered natively, parity release gate, language registry for future additions |

**Recommendation:** MVP = **Check + Daily Parallax + Side-by-side card + Push back + Perception-gap quiz + limited Ledger + Trust Center + place & topic personalization + English and Spanish + operator admin console**, as a PWA with share target. Reactive checks earn credibility claim by claim; the briefing builds a healthy habit; the Ledger and quiz are where accountability and depolarization value compound.

---

## 6. Feature specifications

### 6.1 F1: Truth-seeking pipeline (the engine)
**User story:** As any user, I paste a claim, link, screenshot, or video URL and get a clear, sourced assessment in under 60 seconds (p50 under 25 s for cached-similar claims).

**Pipeline stages (each a durable workflow step):**
1. **Ingest & normalize:** fetch URL (sandboxed), extract text/OCR, detect the source language (any language can be *checked*; output is in the user's language), canonicalize, hash for cache (exact + pgvector similarity ≥ 0.92 → reuse with "previously analyzed on <date>, refresh?").
2. **Claim decomposition:** split into atomic claims classified as **Fact**, **Value**, **Prediction**, **Attribution** ("X said Y"), or **Framing** (loaded language, selective statistics). A Private model also rewrites each atomic claim as a neutral, self-contained public statement with personal data removed. This canonical claim is the only user-derived text an Anonymized model ever sees.
2b. **Place & topic tagging:** tag each claim with the places it concerns (ISO 3166-1 country and ISO 3166-2 region codes, or "global/multi-country") and with 1–3 topics from the published taxonomy (F6). Tags drive briefings, filters, subscriptions and regional context in retrieval ("which statistics office is authoritative here?"). Tagging is a small-model step with a confidence score; low-confidence tags fall back to the parent place or topic.
3. **Retrieval (primary-source first):** per-claim query plan with source tiers:
   - T1: primary data and documents (INE, Eurostat, BLS, Census, OECD, WHO; court rulings; legislation; full transcripts/videos; peer-reviewed papers).
   - T2: systematic reviews, reputable research institutes, wire services.
   - T3: established news outlets across the spectrum.
   - T4: everything else (context only).
   ≥ 2 independent sources are required for any supported/contradicted grade; outlets from both sides are retrieved deliberately when coverage diverges. The result is a **shared evidence pool**, the common starting point for every perspective model in stage 6.
4. **Evidence grading:** **Well supported · Mostly supported · Mixed/contested · Missing context · Mostly unsupported · Contradicted by evidence · Not checkable (yet)**, with confidence High/Medium/Low and a reason ("only one primary source," "data revised in 2026").
5. **Manipulation-technique detection:** cherry-picked window, base-rate neglect, misleading chart axis, correlation→causation, out-of-context quote/clip, AI-generated media (probability language, never certainty).
6. **Independent investigation and multi-model adjudication:**
   - **Independent investigation:** each perspective slot (at least three: US-R, US-L, CN; see 9.4) investigates the claim on its own, using the same investigation harness. It starts from the shared evidence pool and may run its own web searches, scrape pages, query primary-data connectors and, if its model supports it, search X. It returns a structured verdict (grade, confidence, reasoning, cited sources) without seeing the other slots' verdicts.
   - **Pooled sources:** sources any slot discovers are snapshotted, quote-verified and added to the pool. Verdicts that rest on unverifiable sources are downgraded.
   - **Combining verdicts:** verdicts are combined by a **published rule, not by another model**. The median grade wins, and confidence drops as verdicts spread.
   - **Disagreement:** a spread of ≥ 2 grade steps (configurable), or a split between "supported" and "contradicted", triggers the "Models disagree" banner, shows every slot's rationale and sends the analysis to human review.
   - **Refusals** count as abstentions and are logged for refusal-symmetry audits.
   - **Conflicts of interest:** on a slot's conflict-of-interest topics (e.g., xAI and Elon Musk for Grok; OpenAI and Microsoft for GPT; China, the CCP, Taiwan, Tibet, Xinjiang, Hong Kong and Tiananmen for Chinese models), that slot's verdict is shown but left out of the aggregate. If fewer than two verdicts remain, a human must review before publication.
7. **Symmetry ("mirror") test:** for contested political claims, generate the structurally equivalent claim from the opposite side and check the rubric scores it consistently. Results are logged and published in aggregate.
8. **Composition:** plain summary (≤ 80 words), "What's true / missing / wrong," "What each side gets right" (only with evidence), sources with quotes ≤ 25 words, collapsed reasoning trace, model+prompt version, timestamp. The analysis itself is stored as a **language-neutral structured object** (claims, grades, confidence, source IDs, reasoning steps). The prose is then **rendered natively** in the requested language from that object, using per-language prompts and style guides, cached per (analysis version, language). Rendering never changes grades, confidence or sources. Quotes stay in the source's original language, followed by a translation labelled as such.
9. **Versioning & corrections:** analyses are immutable and versioned; corrections create a new version with a public diff and reason; the corrections log is public and RSS-able.

**Acceptance criteria:**
- 100% of graded Fact claims show ≥ 2 sources, ≥ 1 from T1/T2, or state "no primary source available."
- Every quote is verified verbatim in the fetched source (string match), else removed.
- Values are never graded true/false; UI shows "Values question: here are the strongest arguments."
- Model disagreement, fallback provider use, and stale data (> 12 months) are always disclosed.
- Corrections published within 72 h of a validated error report.
- Every analysis can be read in every supported language (English and Spanish at launch), with identical grades, confidence, sources and side-by-side structure in each. Translations of quotes are always labelled, and the original is one tap away.

### 6.2 F2: Daily Parallax (proactive)
- **Editions, then assembly.** Stories are produced in shared, human-reviewed **editions**: one Global edition, one per supported country, and one per supported region where coverage allows (F6). Each edition holds a ranked pool of 5–10 candidate stories chosen by **published rules**: cross-outlet salience on both sides, virality of contested claims, upcoming decisions. Each user's briefing of 3–5 stories is then **assembled** from the editions that match their places, weighted by followed topics and minus muted ones, with the "outside your filters" slot. Assembly is deterministic, rule-based and needs no model call, so personalization adds almost no cost and no per-user AI output.
- **Fallbacks:** if a user's regional edition has fewer than 2 qualifying stories, the briefing fills from the parent country, then Global, and says so.
- A weekly **symmetry audit** per edition reports whose claims were checked and why.
- Each card: what happened, where (place tag), topic, what's disputed, where each side is right/wrong, one perception-gap fact, "Why am I seeing this?"; ≤ 6 minutes total (≈ 3 in Quick depth).
- It ends: "You're up to date. See you tomorrow." No feed below.
- Editions are generated by cron at 05:00 in the place's local time and reviewed by an editor plus at least one cross-partisan reviewer before 07:00 (Phase 1: one human minimum; always disclosed). Delivery time per user follows their settings.

### 6.3 F3: Actor Ledger (accountability + recognizing good actors)
**Scope:** politicians, parties, governments/countries, public figures, influencers (≥ 100k followers or demonstrable reach), companies, entrepreneurs, media outlets.

**Rubric: behaviour-based, evidence-linked, identical for all.**
| Dimension | Measured by | Positive signals |
|---|---|---|
| Factual reliability | Share of analyzed public claims graded Contradicted/Mostly unsupported, reach-weighted; n ≥ 10 before any score | Well-supported claims; voluntary corrections |
| Correction behaviour | Retraction after evidence; time to correct | Public retractions, apologies |
| Data integrity | Misleading statistics, manipulated media | Sharing full data, citing primary sources |
| Prediction calibration (Phase 2) | Brier score on resolvable forecasts | Good calibration |
| Integrity record | Final court rulings, audit findings, regulator sanctions; **never** unproven allegations | Transparency disclosures, cross-party cooperation |
| Influence-operation links | EEAS, platform takedown or court attributions, with source and confidence | Funding/sponsorship disclosure |
| Civility of conduct | Documented dehumanizing language or incitement (quoted, linked) | Documented good-faith engagement with opponents |

- **No single "good/bad" score.** Each dimension shows sample size and confidence; comparisons only within type.
- **Browse and follow by place and topic:** the Ledger can be filtered by country, region (regional presidents, governments and parliaments; regional outlets) and topic ("who makes claims about Housing in Catalunya?"). Users can follow actors to hear about new analyses, replies and appeal results.
- **Language rules:** describe conduct, not character: "7 of 12 analyzed claims were contradicted by evidence," never "liar" or "corrupt" unless quoting a final court ruling.
- **Right of reply:** verified-contact "Respond" channel; replies (≤ 300 words + links) published alongside the record within 5 business days of verification. A rebuttal with new evidence triggers re-review within 10 business days.
- **Appeals:** (1) editorial re-review by a different reviewer and model pair; (2) cross-partisan panel decision, published with reasons.
- **Legal safeguards (EU/Spain):**
  - Verifiable, sourced facts only; no crime allegations without final judgment; pending cases labelled "pending, not proven."
  - Spanish law protects honour (Ley Orgánica 1/1982) and grants a statutory right of rectification (Ley Orgánica 2/1984); build a rectification workflow meeting its deadlines. Criminal defamation (calumnia/injurias) makes diligently verified reporting essential.
  - GDPR: profiles of natural persons rely on legitimate interest and journalistic/expression exemptions (Art. 85 as implemented nationally); DPIA and legitimate-interest assessment; private individuals never profiled.
  - DSA: if user content is hosted (Phase 2), implement notice-and-action, statements of reasons, and a point of contact; check small-enterprise exemptions with counsel.
  - EU AI Act Art. 50: tell users they are interacting with AI and mark AI-generated content; every analysis carries an "AI-assisted, human-reviewed: yes/no" badge.
  - Media liability insurance and legal review of the rubric and first 100 profiles before public launch.

### 6.4 F4: Depolarization mechanics
- **Side-by-side card:** "What [Left/Progressive] voices get right · What [Right/Conservative] voices get right · What the evidence says." Labels adapt per country (in Spain "izquierda/derecha" plus party families; never logos or party colours). Sections can be empty; no fabricated balance.
- **Perception-gap quiz:** "What % of [other side] do you think support X?" → real survey value with source and margin of error → reflection prompt. Published surveys only (More in Common, CIS, Pew, Eurobarometer, plus regional institutes such as CEO in Catalonia where they exist). Survey question wording is shown in the user's language with a link to the original wording. Items match the user's home place and followed topics; regional items are used only when published regional samples have an adequate margin of error, otherwise country items are shown.
- **Steelman:** for value questions, the strongest version of each position, written to be endorsed by its holders; Phase 2 validation by cross-partisan raters (bridging score).
- **Moral reframing hints:** explain why a fact matters across moral foundations (fairness, care, liberty, loyalty, authority) without changing the fact.
- **"Push back" dialogue:** the AI responds with evidence and concedes where the user is right. No persuasion goals, max 10 turns, accuracy-first prompt, every factual statement cited.
- **Non-humiliating tone:** "here's what the evidence shows," never "you were wrong." Share cards show claim and evidence, never a red "FALSE" stamp over someone's face.

### 6.5 F5: Trust Center (trust architecture)
- **Model lineup:** a public page lists the current model in each perspective slot and utility role, with the full change history (date, old → new model, reason) and the post-swap eval results.
- **Open methodology and prompts:** rubric, source tiers, selection rules, grade definitions, and all prompt versions in a public Git repository (AGPL-3.0 code; CC BY 4.0 methodology). Each analysis shows model IDs, provider (Venice or fallback), and prompt hash; "Re-run this analysis" with a different model mix shows the diff.
- **Audits:** quarterly political-symmetry audit (mirror tests, story mix, Ledger outcomes by party family) with raw data; annual external audit by a university team from another country.
- **Cross-partisan review panel:** ≥ 9 paid, rotating members balanced across left, centre, and right, recruited with academic partners (Spain, US, LatAm), bios published. Decisions require at least one member from each bloc.
- **Independence & funding:** non-profit foundation (Spanish *fundación* or Dutch *stichting*); no donor > 10% of annual budget; no party, government, or platform-company funding; donors above €1,000 published; no model vendor > 50% of adjudication volume.

### 6.6 F6: Personalization by place and topic ("Your Parallaxa")
**User story:** As any user, I tell Parallaxa *where* and *what* I care about, so the briefing, Ledger, quiz and alerts focus on that, and I can change it in one tap at any time.

**Geographic scope**
- **Levels:** **Global**, **Country** (ISO 3166-1), **Region** (ISO 3166-2 first-level subdivision: Spanish autonomous communities, US states, UK nations, Mexican states, German Länder, etc.). Nothing finer than region in MVP (no cities, no GPS). Municipal scope is a Phase 3 open question.
- **Multiple places:** up to 5 places, mixing levels (e.g., "Andalucía + Spain + Global", or "Spain + Mexico" for someone with family in both). One place is marked **home** and is used for perception-gap data and local context.
- **Mode per place:** **Focus** (only this place) or **Include** (this place alongside the others). Global can be on or off. Default suggestion: home country + global, from browser locale and coarse IP country. The suggestion is shown to the user to confirm, and the IP is never stored or used beyond that suggestion. The browser Geolocation API is never used.
- **Coverage honesty:** each place shows a coverage level (Full · Partial · Limited) based on primary-data connectors, regional outlets across the spectrum, and reviewer capacity. When regional coverage is thin, the app says so and fills from the parent country, labelled "Not enough regional coverage today; showing Spain-wide stories."
- **Quick switcher:** a scope chip in the header ("Andalucía · Spain · Global ▾") changes the view for this session without changing saved preferences.

**Topics**
- **Published two-level taxonomy** (~20 topics, ~150 subtopics, versioned in the public repo, translated in every locale). Examples: Economy & jobs, Housing, Health, Pensions & welfare, Immigration, Climate & energy, Education, Justice & corruption, Elections & democracy, Territorial organization, Foreign affairs & war, Security & crime, Technology & AI, Science, Equality & rights, Media & information, Agriculture & rural life. Country-specific subtopics are allowed (e.g., "Regional financing" in Spain), each mapped to a neutral parent topic.
- **Topic names are neutral and descriptive** ("Immigration," not "Invasion" or "Open borders"). The cross-partisan panel reviews the taxonomy, and changes go through the corrections log.
- **Follow / Neutral / Mute** per topic or subtopic. Followed topics get priority; muted topics are left out of the briefing and alerts. Muting is never applied to Check results or to search.

**Following and subscriptions**
- **Follow targets:** topics, places, Ledger actors, and individual stories or analyses (to hear when a check is updated, corrected or resolved).
- **Channels (all opt-in):** the Daily Parallax (default), Web Push, a weekly email digest (Phase 2), and per-topic and per-place **RSS feeds** that need no account.
- **Notification budget:** at most 1 routine notification per day in total (the briefing), plus follow-ups the user explicitly asked for (e.g., "this check was corrected," "this actor replied"), capped at 3 per day. Users can set quiet hours and pause everything for a set time.

**Briefing and reading settings**
- Length (3 or 5 stories), delivery time, days of the week (e.g., weekdays only), depth (Quick ~3 min / Standard ~6 min), and plain-language mode. Content is always shown in the user's chosen language whatever the place (an English speaker following Spain reads Spain's edition in English). Users can optionally show sources' original-language text alongside.
- The settings stay calm by design: no "more stories" option beyond 5, and no endless feed.

**Guardrails against bubbles and manipulation**
- **No side filters.** Personalization never removes a side, an outlet, or the "What each side gets right" card. It narrows *where* and *what*, never *who is right*.
- **Outside your filters:** by default, 1 briefing slot is reserved for a major story outside the user's places or topics, chosen by published salience rules. Users can turn it off, and the app reminds them once every 90 days that it is off.
- **Explicit choices only in MVP.** No behavioural inference of interests. Phase 2 may *suggest* topics computed on-device, shown as suggestions the user must accept.
- **"Why am I seeing this?"** on every briefing card and alert names the matching place, topic or follow ("You follow Housing · Comunidad de Madrid").
- **Same content for everyone:** analyses, grades and side-by-side cards are identical whatever a user's preferences. Personalization changes *selection and order*, never *what an analysis says*.

**Privacy**
- Anonymous users' preferences live only on the device (IndexedDB). Signing in syncs them, encrypted at application level with the same key class as political self-placement, because topic and place choices can reveal political opinions (GDPR Art. 9).
- Preferences are never sent to model providers, never used for profiling, and appear in analytics only as k-anonymous aggregates (k ≥ 50). Export and delete are included in the self-service data tools.

**Acceptance criteria:**
- Users can set Global, any supported country, or any ISO 3166-2 region of a supported country in ≤ 3 taps, and change it from the header in 1 tap.
- 100% of analyses and briefing stories carry place and topic tags. A tag-accuracy eval on the gold set reaches ≥ 95% for country and ≥ 90% for region and topic.
- Muted topics never appear in the briefing or in alerts except through the "outside your filters" slot, which is labelled as such.
- Check results, grades and side-by-side cards are byte-identical across preference profiles (automated test).
- A user with no account and no preferences gets a sensible default (home country + global) and can use every feature.

### 6.7 F7: Languages and localization
**User story:** As any user, I open Parallaxa and, if my language is supported, it already speaks it and reads naturally. If my browser language isn't supported, I get English and can switch in one tap.

**Launch languages: two, done well.**
| Language | Locale | Notes |
|---|---|---|
| English | `en` | One English locale for every `en-*` browser; the style guide fixes one spelling convention. Source language for UI copy and the fallback for anything unmatched |
| Spanish | `es-ES` | **Spain Spanish only.** No Latin American variant (`es-419`, `es-MX`, etc.); every `es-*` browser gets `es-ES`. Vocabulary, form of address ("tú", "vosotros"), and number/date formats follow Spain |

Starting with two languages keeps translation, native review and evaluation costs small while the method is proven. Everything is built so that **adding a language is configuration and content work, not an engineering project** (see "Built for more languages" below). Likely next candidates are French, German, Italian and Portuguese, each added alongside its country edition.

**Choosing the language (in priority order):**
1. A locale in the URL path (`/en`, `/es`), e.g. from a shared link, a search result or a bookmark.
2. The user's explicit choice: a saved setting (account) or a `NEXT_LOCALE` cookie (anonymous). An explicit choice always wins over detection.
3. **Browser settings:** the `Accept-Language` header, read in order of the user's preference (q-values). Each entry is matched on its primary language subtag against the *enabled* languages (`es-MX` → `es-ES`, `en-GB` → `en`). The first supported language wins, so "Catalan, Spanish, English" gets `es-ES` and "French, English" gets `en`.
4. **Fallback:** English (`en`) when nothing matches.
- Detection runs only when no URL locale or saved choice exists, and it never uses IP address or place settings: language and place are independent (an English speaker living in Spain can follow Andalucía in English).
- The installed PWA opens in the last chosen language. The language switcher lives in the header menu, in Settings and in onboarding. Each language is shown by its own name ("English", "Español"), never by a flag.

**What is localized:**
- **All UI copy** in ICU message catalogs (plurals, gender, select), with English as the source language and professional translation plus native Spain-Spanish review. No hard-coded strings; the automated checks fail on missing or unused keys.
- **AI output:** analyses, briefings, Push back dialogue, steelmen, Ledger texts and quiz explanations are **rendered natively** in each language from language-neutral structured data (F1 stage 8), with per-language prompts and few-shot examples. Push back replies in the language the user writes in, if supported, otherwise in the UI language.
- **Editorial and reference content:** topic taxonomy, place names (CLDR/ISO names; regions also shown in their official local form where it differs, e.g. "Catalunya"), grade names and definitions, methodology, Trust Center, corrections log, audits, onboarding, emails, push notifications, share cards and RSS feeds.
- **Legal texts:** terms, privacy policy, AI disclosures and rectification and reply procedures in English and Spanish, legally reviewed. The governing version is stated on each page.
- **Formats:** dates, times, numbers, currencies, percentages and lists via `Intl` APIs for the active locale; time zones follow the user's device.
- **Input:** Check accepts text, images (OCR) and voice in English and Spanish. Content in any other language can still be checked, with the result shown in the UI language.

**Quality and review:**
- **Style guides and glossaries for English and Spanish** (grade names, technique names, neutral political vocabulary per country). The Spanish glossary uses Spain's terms ("autonomía", "Congreso de los Diputados", "ordenador"), never Latin American alternatives.
- **Native Spain-Spanish reviewers** take part in briefing and Ledger review. Every Ledger text and every legally sensitive phrase is reviewed natively before publication. For other AI-rendered prose, automated cross-language consistency checks (a second model confirms that meaning, grades and numbers match the structured analysis) run on 100% of output, plus sampled native review.
- **Language parity** is an even-handedness requirement: the same gold-set claims must get the same grades whatever the input and output language (9.6).

**Built for more languages:**
- **One language registry** in code is the single source of truth for each language: BCP 47 tag, URL prefix, matching rule, native name, text direction, `Intl` locale and an enabled flag. Routing, detection, the switcher, `hreflang`, sitemaps, manifests, emails, automated checks, prompt loading and evals all read from it. No list of locales is hard-coded anywhere else (enforced by a lint rule).
- **No language enums in the database:** language columns store BCP 47 tags validated against the registry, so a new language needs no migration.
- **One folder per language** for UI messages (`messages/<lang>/`), prompts and few-shot examples (`prompts/<lang>/`), and style guides and glossaries (`methodology/<lang>/`).
- **Language-neutral analyses** (F1 stage 8): a new language needs a renderer prompt and review, not re-analysis. Existing analyses render in the new language on first request.
- **A feature flag per language** (Edge Config) allows a staged rollout (staff → beta → everyone) without a redeploy. A language cannot be enabled until its catalogs are complete and its parity and fluency evals pass.
- **Automated checks loop over the registry**, so tests, i18n checks and parity evals cover a new language automatically.
- **Layout ready for other languages:** the UI tolerates ~40% text expansion (tested with a pseudo-locale, so German or French would fit without a redesign), uses `hyphens: auto` and correct `lang` attributes (including on original-language quotes), logical CSS properties with `dir` taken from the registry (RTL-ready), and a font stack with full Latin Extended coverage.
- **Adding a language (playbook in the repo, `docs/adding-a-language.md`):**
  1. Add a disabled registry entry.
  2. Translate and natively review the UI catalogs, taxonomy, place and grade names, Trust Center, methodology and legal texts.
  3. Write the style guide and glossary.
  4. Add renderer prompts and few-shot examples.
  5. Translate the gold set and pass the parity and fluency evals.
  6. Recruit native reviewers.
  7. Enable for staff, then beta, then everyone.

  Target: a new language in ≤ 6 weeks of content work with no changes to core code.

**SEO and sharing:**
- Locale-prefixed URLs for all public pages, `hreflang` alternates for every enabled language plus `x-default` → English (generated from the registry), localized `<title>` and Open Graph metadata, and share cards rendered in the sharer's language.

**Acceptance criteria:**
- A first visit with `Accept-Language: es-MX,es;q=0.9` renders `es-ES`; `es-419` renders `es-ES`; `ca,es;q=0.8,en;q=0.5` renders `es-ES`; `en-GB` renders `en`; `fr-FR,de;q=0.8` renders `en`; no header renders `en`.
- An explicit language choice persists across visits, reloads and the installed PWA, and overrides browser detection.
- 0 missing message keys in `en` and `es-ES` in the automated checks. Pseudo-locale text-expansion snapshot tests pass at every breakpoint.
- Spanish UI copy and output pass an es-ES lexicon check (no Latin American-only terms or forms such as "ustedes" for informal plural, "computadora", "celular", "carro").
- Gold-set grade agreement between English and Spanish ≥ 98% for the same claim and evidence.
- An automated dry run that adds the pseudo-locale as a test language needs no changes outside the registry, `messages/`, `prompts/` and `methodology/` folders.

### 6.8 F8: Admin console
**User story:** As the operator, I sign in to one simple, friendly admin site. There I can see at a glance how Parallaxa is doing, swap the AI models, and adjust any important setting safely, with no code, terminal or deploy.

**Access and security**
- **Where:** `/admin` in the same Next.js app. It is not linked from the public app, and is served with `noindex`.
- **Credentials:** sign-in uses the `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables (Vercel, "sensitive" type, with different values for Preview and Production).
- **Protections:**
  - **Login:** a login form, not browser basic auth. Credentials are compared in constant time.
  - **Session:** a signed, `HttpOnly`, `Secure`, `SameSite=Strict` cookie (signed with `ADMIN_SESSION_SECRET`). It expires after 8 hours, or 30 minutes idle, and is revocable through a session table.
  - **Lockout:** 5 failed attempts in 15 minutes from one IP hash triggers a 15-minute lockout and an alert email. BotID and a WAF rule protect the login route.
  - **Every request checked:** CSRF protection on every change. Every admin page, API route and server action checks the session itself, not only the middleware.
  - **Optional IP allowlist:** `ADMIN_IP_ALLOWLIST`.
  - **Strong password:** at least 20 random characters, checked at boot. If `ADMIN_PASSWORD` is missing or weak, the admin site stays disabled rather than open. Rotated quarterly.
- **No personal data:** the console shows only aggregate data. No individual user can be looked up.
- **One shared login for now:** a single operator login is a deliberate MVP simplification. Named admin accounts with passkeys and roles come in Phase 2. The editorial review console already uses individual accounts, because reviews and panel decisions need named accountability.

**Design principles: very user-friendly**
- **Plain language:** every setting has a plain-language label, a one-line explanation and its safe range. Sensible defaults, with "Reset to default".
- **No JSON editing:** forms are generated from one typed settings schema (type, range, default, help text, whether a change needs a test run). New settings appear automatically with validation, and nobody ever edits JSON.
- **Save bar:** pending changes are summarized in plain words (e.g., "Switch US-L from GPT-6.2 Sol to Claude Sonnet 5.5 · est. cost +12% · affects Check and Briefing"). A short reason is required before applying.
- **Impact preview:** before saving, it shows the estimated cost per analysis and per month, the latency and the features affected.
- **Undo and rollback:** one click back to any earlier configuration version.
- **Typed confirmation** for production-wide actions (kill switches, turning fallback off).
- **Accessible everywhere:** status shown with icons and words, never colour alone; works on phone, tablet and desktop; keyboard accessible; English and Spanish.

**Sections**
1. **Overview (home): "Is everything OK?"**
   - System status: Venice, whether the fallback is active, circuit breakers.
   - Today's checks, cache-hit rate, p50/p95 time to result, error rate.
   - Spend today against the daily ceiling.
   - Today's briefing editions (ready / in review / late).
   - Review queues and the corrections SLA.
   - Model agreement rate, latest eval scores, open alerts.

   Each card links to its detail page.
2. **Models:**
   - **Cards:** one card per perspective slot (US-R, US-L, CN, plus any extra slots) and per utility role. Each shows the model, vendor and origin, privacy tier, harness badges (tool calling · structured output · web search · X search), price, p95 latency, refusal rate, agreement with the other slots and circuit-breaker state.
   - **"Change model":** opens a picker of live Venice models that meet the harness requirements, filterable by vendor, origin, price and context length. Incompatible models are greyed out with the reason.
   - **Then:** Test (harness check with side-by-side sample output) → optional Shadow → Activate, or Emergency swap.
   - **Rules:** the lineup rules (≥ 3 slots, ≥ 2 origins, ≥ 3 vendors) are enforced with a clear explanation. Change history comes with rollback.
3. **Investigation settings (per slot):**
   - Search: web search (off/auto/on), web scraping, citations, and X search (shown only for models that support it).
   - Model: reasoning effort (only the options that model supports), temperature.
   - Budgets: max tool calls, searches and scraped URLs; time limit; cost cap per investigation.
   - Conflict-of-interest topics.

   Venice's own system prompt is locked off.
4. **Pipeline:**
   - Thresholds: cache similarity (default 0.92), minimum sources (2), stale data (12 months).
   - Combining verdicts: aggregation rule (median by default) and disagreement threshold in grade steps.
   - Checks: human-review triggers, mirror test on/off by topic, writer rotation.
   - Prompts: the prompt version in use (read-only; prompts change only through the public repo and the eval gate).
5. **Reliability and limits:**
   - Failures: circuit-breaker thresholds, timeouts, AI Gateway fallback mapping per slot, fallback on/off per feature.
   - Spending: daily spend ceiling and alert levels.
   - Usage: per-user quotas and rate limits.
   - Kill switches (Check, Push back, Briefing, Ledger, Quiz) and maintenance banner text.
6. **Content:** enabled languages (language-registry flags), enabled places and editions with coverage levels, briefing timing, notification limits, the "outside your filters" default, quiz on/off per country.
7. **Metrics** (charts with date range and CSV export):
   - **Truth:** gold-set accuracy, calibration, citation precision, nightly trend.
   - **Even-handedness:** mirror parity, refusal symmetry by slot, grade distribution by the side a claim came from.
   - **Models:** agreement matrix between slots, per-slot grade distribution, latency, cost, refusals, conflict-of-interest exclusions.
   - **Operations:** SLOs, errors, fallback use, breaker events, briefing punctuality.
   - **Usage:** checks, briefings opened, quiz completions, languages, places and topics (aggregate, cookieless, k ≥ 50).
   - **Wellbeing and relevance:** survey results.
   - **Guardrails:** session-length alarm, "outside your filters" opt-out rate, language-switch rate.
   - **Costs:** by day, feature, slot, model and search type, against budget.
8. **Alerts:** thresholds and email recipients for spend, SLO breaches, fallback activation, eval regressions, late briefings and login lockouts.
9. **Audit log:** every change with time, IP hash, before/after diff and reason. Each entry has a revert button, and the log can be exported.

**Acceptance criteria:**
- Without a valid session, every `/admin` page and admin API redirects to login or returns 401 (automated test over all admin routes). A missing or weak `ADMIN_PASSWORD` disables the admin site.
- A model swap takes ≤ 5 clicks from the Models page and reaches new analyses within ~10 s, with no deploy.
- Only models that meet the harness requirements and pass the harness check can be activated. The X search toggle appears only for models that support it.
- Every change is versioned, has a reason, is audit-logged, can be undone in one click, and shows on the public Trust Center lineup page when it touches models.
- In usability testing, a first-time operator completes "swap the CN model", "lower the daily spend ceiling" and "find yesterday's p95 time to result" without help.

---

## 7. Safeguards against our own failure modes

| Failure mode | Safeguards |
|---|---|
| **Hallucination** | Retrieval-grounded generation only; verbatim quote verification; unsupported claims auto-downgraded to "Not checkable"; nightly gold-set regression |
| **Model political bias** | Multi-origin ensemble; mirror tests; neutrality prompts (shown to cut perceived slant); bias eval suite (9.6); human cross-partisan sampling of 2% of outputs |
| **False balance** | Grades from evidence, not side counts; "each side right" sections may be empty; auditors also flag artificial symmetry |
| **Brigading** | Bridging-weighted ratings; rate limits; BotID; account age/reputation; rating-burst anomaly detection |
| **Prompt injection** | Retrieved text in inert data blocks; separate tool-less "reader" calls; strip hidden text/HTML comments; schema validation; retrieved content can never change instructions, tools, or fetched URLs; allow-list fetcher without internal network access |
| **Labelled partisan** | Trust Center, audits, panel, symmetric marketing examples, launch partners from both sides, fast data-backed responses |
| **Model swap degrades quality or balance** | Harness check, optional shadow mode, automatic post-swap gold-set eval with one-click rollback; lineup invariants (≥ 3 slots, ≥ 2 origins, ≥ 3 vendors); public change history |
| **Admin credentials compromised** | Strong env-var password checked at boot, lockout and alerts, BotID/WAF, short signed sessions, optional IP allowlist, full audit log; the console holds no personal data |
| **Misuse** | Private individuals never profiled; per-user quotas; no bulk API in MVP; abuse reporting |
| **Funder capture / over-reliance** | Per-donor cap and panel veto on conflicts; always show sources and teach techniques so users need us less |

---

## 8. UX/UI requirements

### 8.1 Principles
- **Tremendously simple:** one primary action per screen. Home has one large input: "Paste something you saw, or ask a question."
- **Progressive disclosure:** headline → three-line summary → evidence → reasoning trace → raw sources.
- **Calm aesthetics:** generous whitespace, editorial typography, subtle motion (respects `prefers-reduced-motion`).
- **Accessibility:** WCAG 2.2 AA: contrast ≥ 4.5:1, visible focus, targets ≥ 24×24 px, full keyboard and screen-reader support, no colour-only meaning, captions, plain-language mode (B1).
- **Internationalisation:** next-intl with ICU messages; two languages at launch: `en` and `es-ES` (Spain Spanish, no Latin American variant), driven by a single language registry so more can be added without code changes. Language picked from browser settings with English as fallback; model outputs rendered natively per locale, not translated afterwards; localized formats; RTL-ready architecture. Full spec in F7 (6.7).

### 8.2 Key screens
1. **Home:** scope chip and language menu in the header (e.g., "Andalucía · Spain · Global ▾"), input (text, URL, image, voice), "Today's Parallax" card, updates on things you follow, recent checks (local unless signed in).
2. **Result:** verdict chip (shape + words), 3-line summary, true/missing/wrong, "Each side gets right," sources with tier badges, model agreement, Push back, Report an error, Re-run with other models, version history.
3. **Daily Parallax:** ≤ 5 cards (swipe on mobile, arrow keys on desktop); "You're up to date" end state.
4. **Actor page:** dimension tiles with n and confidence, analyzed claims, positive conduct, actor's reply, appeal status.
5. **Perception-gap quiz:** slider guess → reveal → source.
6. **Your Parallaxa:** places (search or browse country → region, coverage level shown), topics (follow / neutral / mute on a two-level list), followed actors and stories, briefing settings, channels and notification budget, and a live preview: "With these settings, today's briefing would be…".
7. **Trust Center** and **Settings/Privacy** (language, notifications, export/delete, optional political self-placement with explicit consent, aggregate use only).

### 8.3 Responsive layouts
- **Mobile (< 640 px):** single column, bottom nav (Check · Today · Ledger · More), thumb-reachable actions.
- **Tablet (640–1024 px):** two-pane in landscape; sources in a side sheet.
- **Desktop (> 1024 px):** three columns (claims · evidence · sources); shortcuts (`/` focus input, `j/k` navigate).

### 8.4 Onboarding (≤ 60 seconds, skippable, no sign-up)
The language is already detected from the browser and shown at the top with a one-tap switcher. Three panels ("We check claims from every side with the same rules, and show our work"); a **place picker** (pre-filled with the suggested home country + Global; add a region or other countries, or keep it global); an optional **topic picker** (follow or mute, no political identity question; "skip" keeps everything neutral); a demo where *each* side had one claim right and one wrong, and the hook: "Don't trust us? Good. Open the Trust Center or re-run any answer with a different AI."

### 8.5 PWA
- **Manifest:** name, short_name "Parallaxa", icons 192/512 + maskable, `display: standalone`, `share_target` (POST text/url/images) → `/check`. One manifest per language (localized `description`, `lang`, shortcuts), with `start_url` set to the user's chosen language.
- **Service worker** (Serwist or equivalent): precache shell; network-first for API; stale-while-revalidate for the briefing; offline reading of the last 3 briefings and saved checks; background-sync queue for offline checks.
- **Web Push:** VAPID; opt-in after the second meaningful session, never on first visit. **iOS:** web push works only for Home-Screen PWAs (iOS/iPadOS 16.4+), so prompt only inside the installed app.
- **Install reminders:**
  - Only after ≥ 2 visits on different days **and** ≥ 1 completed check or briefing.
  - In-page bottom banner, never a modal. Android/desktop use `beforeinstallprompt`; iOS Safari gets a 3-step illustrated "Share → Add to Home Screen" sheet.
  - Max once per 14 days; after 2 dismissals stop permanently (manual "Install" stays in settings); never during a check or quiz.
  - Copy: "Get the morning briefing on your home screen: faster, works offline. Not now / Install."

---

## 9. Technical architecture

### 9.1 Overview
- **Framework:** Next.js (App Router, RSC, TypeScript strict) on **Vercel Pro** (Hobby is non-commercial with tight allowances).
- **Compute:** Vercel Functions on **Fluid compute** (Node.js). Active CPU pricing bills CPU only while code runs: $0.128 per Active CPU-hour and $0.0106 per GB-hour of provisioned memory in the base US region, higher elsewhere.\[53\]\[54\] This suits I/O-bound LLM orchestration, since waiting on model calls bills no CPU.\[54\]\[55\] Pin functions to **fra1 (Frankfurt)** to colocate with Neon EU and keep personal data in the EU.
- **Durable pipelines:** **Vercel Workflow** for the multi-step analysis (retries, step persistence, resumable) and **Vercel Queues** (beta at time of writing, priced per API operation) for retrieval fan-out.\[56\] If unavailable in region/plan, use a Postgres job table + cron drain.
- **Cron Jobs:** briefing edition generation per place (05:00 in the place's local time), nightly evals, health checks, cache warmers, retention purge.
- **Caching:** ISR/`use cache` for public analysis, actor, and briefing-edition pages (tag revalidation on new versions); results content-addressed (claim hash + model set + prompt version); edge caching for anonymous traffic. Personal briefings are **assembled on the client** from cached editions using the locally stored preferences, so anonymous personalization never sends preferences to the server and every edition stays cacheable. Signed-in assembly for push and email runs server-side in a function, never in an LLM call.
- **Routing Middleware:** locale negotiation (URL prefix → saved choice/cookie → `Accept-Language` primary-subtag match → `en`; F7), A/B bucketing (cookie, no PII), bot checks on expensive routes.
- **Storage:** **Vercel Blob** for screenshots and archived source snapshots (private, signed URLs). **Edge Config** for feature flags, model routing table, circuit-breaker overrides, kill switches.
- **Security edge:** **Vercel Firewall/WAF** custom rules + rate limiting on `/api/check`, `/api/dialogue`, `/api/rate`; **BotID** on write and LLM-triggering endpoints; attack challenge mode on demand.
- **Observability:** Vercel Observability, **Speed Insights**, cookieless **Web Analytics**; OpenTelemetry traces per pipeline step (model, latency, tokens, cost).
- **AI:** **AI SDK** (`generateObject`/`streamText` with Zod schemas), OpenAI-compatible provider pointed at Venice; **AI Gateway** as fallback.
- **Sandbox:** **Vercel Sandbox** for isolated fetching/rendering of untrusted pages and recomputing statistics from source data.
- **Admin console (F8):** an `/admin` route group in the same app, server-rendered, behind its own env-var login. It writes versioned configuration to Postgres and publishes the active version to Edge Config through the Vercel API (token scoped to that Edge Config only). It reads the live Venice model catalog and the aggregate metrics tables.
- **Avoid:** Edge runtime for pipeline functions; client-side model calls; third-party analytics/ad pixels; storing political self-ID alongside behaviour data; single-model lock-in.

### 9.2 Data layer: Neon Postgres
- **Provisioning:** Vercel Marketplace Neon integration (unified billing, injected env vars, **preview branch per PR**), EU region (AWS Frankfurt).
- **Plan:** Free for prototyping (100 CU-hours/project/month, 0.5 GB), then **Launch** in production ($0.106/CU-hour, $0.35/GB-month, no monthly minimum, up to 7-day restore). Move to **Scale** ($0.222/CU-hour, up to 30-day restore, compliance features) when SLA/SOC 2 needs arise.\[57\]\[58\]\[59\]
- **Features:** serverless driver (`@neondatabase/serverless`: HTTP for one-shot queries, WebSocket for transactions); pooled connection string for functions; scale-to-zero (5-minute idle default) for previews only, production min 0.25 CU; **pgvector** for semantic cache and source dedup; **Row-Level Security** on user-owned rows; **Neon Auth** or Auth.js (verify Neon Auth features at build time).\[58\]
- **Cost controls:** autoscaling max 2 CU initially; preview branches auto-deleted on PR close (extra branches beyond 10 on Launch cost $1.50/branch-month); old snapshots archived to Blob.\[60\]

**Core schema (simplified):**
```
users(id, created_at, locale, auth_provider, email_hash, deleted_at)
user_political_self_id(user_id unique, placement, consent_at, purpose) -- Art.9: separate table, separate key
claims(id, canonical_text, lang, claim_type, text_hash, embedding vector(1024), first_seen_at)
analyses(id, claim_id, version, grade, confidence, summary jsonb, sides jsonb, techniques[],
         models jsonb, provider enum(venice,gateway), prompt_version, mirror_test jsonb, human_reviewed, created_at)
analysis_sources(analysis_id, source_id, tier, quote, quote_verified, stance)
sources(id, url, outlet_id, published_at, snapshot_blob_key, content_hash)
actors(id, type, name, country, public_role, verified_contact)
actor_dimension_scores(actor_id, dimension, value, n, confidence, rubric_version, computed_at)
places(id ISO 3166-1/3166-2 code, parent_id, level enum(global,country,region), names jsonb, timezone, coverage_level, active)
topics(id, parent_id, slug, names jsonb, country_code null, taxonomy_version, active)
claim_places(claim_id, place_id, confidence) / claim_topics(claim_id, topic_id, confidence)
actors(+ home_place_id) / actor_places(actor_id, place_id)
analysis_renderings(analysis_id, version, lang text /* BCP 47, validated against the language registry; no enum */, body jsonb, model, prompt_version, consistency_check jsonb, native_reviewed, created_at)
briefing_editions(id, place_id, date, status, reviewed_by jsonb) -- rendered per language via analysis_renderings / edition_stories(edition_id, analysis_id, rank, salience jsonb)
user_preferences(user_id unique, prefs_ciphertext, key_id, version, updated_at) -- places, topics, briefing settings; encrypted, Art.9 key class
subscriptions(id, user_id, target_type enum(topic,place,actor,analysis), target_id, channel enum(push,email,in_app), created_at)
corrections / actor_claims / actor_replies / appeals / quiz_items(+ place_id, topic_id) / quiz_responses(no user_id) / audit_log
llm_calls(id, analysis_id, provider, model, slot, step, tokens_in, tokens_out, searches jsonb, cost_usd, latency_ms, finish_reason, error_class)
analysis_verdicts(analysis_id, version, slot, model, provider, grade, confidence, abstained, coi_excluded, sources jsonb, tool_calls, cost_usd, latency_ms)
config_versions(id, created_at, reason, config jsonb, status enum(draft,testing,shadow,active,retired), harness_check jsonb, eval_run_id) -- analyses.config_version_id points here
eval_runs(id, config_version_id, kind enum(nightly,harness_check,shadow,post_swap), metrics jsonb, created_at)
admin_sessions(id, created_at, expires_at, last_seen_at, ip_hash, revoked_at)
metrics_daily(date, metric, dims jsonb, value) -- aggregate only, k ≥ 50, feeds the admin console
```

### 9.3 Privacy & data protection (GDPR)
- **Anonymous by default:** checks work without an account; history stays local (IndexedDB). Accounts only for sync, notifications, and community review.
- **Art. 9:** political self-placement is optional, explicit-consent, encrypted with a separate key, used only for aggregate metrics (k-anonymity ≥ 50), withdrawable and deletable anytime.
- **Place & topic preferences:** treated as potentially revealing political opinions. On-device only for anonymous users; encrypted at application level when synced; never joined with political self-placement, never sent to model providers, never used for targeting. Location granularity stops at ISO 3166-2 region; no GPS, no city, and IP is used only for a one-time, unstored country suggestion.
- **Minimisation:** IPs only as daily-salted hashes kept 7 days; no third-party trackers; account-linked query text de-linked after 90 days; logs kept 30 days.
- **Encryption & rights:** TLS; Neon encryption at rest; AES-256-GCM application-level encryption for push subscriptions and self-ID; self-service export/delete; DPIA before launch; EU residency for personal data; DPAs with Vercel, Neon, Venice, Gateway providers; never send user identifiers to model providers.

### 9.4 AI inference: Venice primary, AI Gateway fallback
**Venice facts (from Venice docs and the live `GET /models` catalog, Nov 2026):**
- OpenAI-compatible API at `https://api.venice.ai/api/v1` (chat completions, `response_format: json_schema`, tools).\[61\]
- Several hundred models: xAI Grok, proxied closed models (OpenAI GPT, Anthropic Claude, Google Gemini) and open-weight models (DeepSeek, Qwen, Kimi, GLM). `GET /models` reports each model's capabilities (`supportsFunctionCalling`, `supportsResponseSchema`, `supportsWebSearch`, `supportsXSearch`, reasoning-effort options), context length, privacy tier, offline and deprecation status, and prices. Prompt caching on some models with large discounts on cached input.\[62\]\[63\]\[64\]
- **Privacy tiers:** "Private" models run with contract-enforced zero data retention. "Anonymized" models hide the caller's identity from the upstream provider, but the provider can still see the prompt. TEE and end-to-end-encrypted modes exist for some text models. Venice states it does not store or log prompt/response content for normal inference, but processes metadata.\[65\] In the Nov 2026 catalog, Grok and the Chinese open-weight models (DeepSeek, Kimi, GLM, several Qwen) are listed as Private; OpenAI, Anthropic and Google models are Anonymized. **Policy:** raw user-submitted text (pasted text, screenshots, Push back messages) only ever goes to Private/TEE models. Anonymized models receive only the canonical, PII-free atomic claim written by a Private model in stage 2, plus public sources.
- **Web search:** `venice_parameters.enable_web_search` (`off|auto|on`), `enable_web_citations`, `enable_web_scraping` (URLs in the latest user message), `return_search_results_as_documents`. Supported on every text model. Billed at $0.01 per search-augmented request and $0.01 per scraped URL, on top of tokens. Standalone `/augment/search` is experimental at $0.01/request, using Brave with zero data retention by default.\[61\]\[66\]\[67\]
- **X search:** `venice_parameters.enable_x_search: true` turns on xAI's native web + X (Twitter) search, only on models with `supportsXSearch` (Grok models); other models ignore it. About $0.01 per search.
- **Venice system prompt:** every call sets `include_venice_system_prompt: false`, so only Parallaxa's published prompts apply.
- **Refusals:** a refusal arrives as `finish_reason: "content_filter"` (HTTP 200) or an in-stream `content_blocked_by_provider` error, and is handled explicitly.
- **Rate limits:** per model and tier via `GET /api_keys/rate_limits` (RPM/TPM/RPD). Failed requests limited to 50 per 30 s per model per key; augment endpoints 60 RPM per user; Partner limits negotiated.\[68\]\[69\]

**Perspective slots: who investigates each claim** (changeable at any time in the admin console, F8):
| Slot | Why it is there | Default model (Nov 2026 catalog) | Alternatives | Privacy | X search |
|---|---|---|---|---|---|
| **US-R:** US model, perceived as right-leaning | Counterweight to models perceived as left-leaning | xAI Grok (`grok-4-7`) | Other Grok versions | Private | Yes |
| **US-L:** US model, perceived as left-leaning | Mainstream US frontier model | OpenAI GPT (`openai-gpt-62-sol`) | Anthropic Claude (`claude-sonnet-5-5`), Google Gemini (`gemini-4-carbon`) | Anonymized (canonical claim + public sources only) | No |
| **CN:** Chinese model | Non-US origin with different priors; perceived as left-leaning on many social questions and aligned with Chinese government positions by default on China-related topics | DeepSeek (`deepseek-v4-pro`) | Kimi (`kimi-k3`), GLM (`z-ai-glm-5-3`), Qwen | Private | No |
| Optional extra slots (up to 5 in total) | e.g., a European model once a capable one is available on Venice | — | — | — | — |

- **"Leaning" labels describe how users across the spectrum tend to *perceive* each model family** (Westwood, Grimmer & Hall 2025; see 1.4). They are not instructions. Every slot gets the same neutral, accuracy-first prompts, and no slot is ever told to take a political side. The value comes from different priors checking each other.
- **Invariants the system enforces:** at least 3 active perspective slots; at least 2 countries of origin and at least 3 vendors among them; no vendor above 50% of adjudication volume; a slot cannot be emptied without a replacement.
- **Conflict-of-interest topics per slot** (editable): e.g., xAI, X, Tesla, SpaceX and Elon Musk for Grok; OpenAI, Microsoft and Sam Altman for GPT; Anthropic, Google and Amazon for Claude and Gemini; China, the CCP, Taiwan, Tibet, Xinjiang, Hong Kong and Tiananmen for Chinese models. On these topics the slot's verdict is shown but left out of the aggregate (F1 stage 6).
- Model IDs above are a snapshot. The admin console always reads the live catalog.

**Utility roles** (not perspectives; also changeable in the admin console):
| Role | Default class |
|---|---|
| PII redaction and claim canonicalization, decomposition, classification, place and topic tagging | Small Private model (e.g., `deepseek-v4-flash`, `z-ai-glm-5-3-flash`): cheap, high-volume |
| Query planning, retrieval reading | Mid Private model, tool-less "reader" calls |
| Writer (stage 8 composition) | Rotates among the perspective slots, so no single model's voice dominates |
| Per-language renderer and consistency checker | Mid Private models; the checker comes from a different vendor than the renderer |
| Push back dialogue | Mid/frontier Private model (user text involved) |

**Investigation harness (identical for every perspective slot):**
- An agentic loop built on the AI SDK: the model receives the canonical claim, the shared evidence pool (stage 3) and a fixed toolset, and calls tools until it submits a verdict or reaches its budget.
- **Tools:**
  - **Venice web search** on every slot (`enable_web_search: "on"`, `return_search_results_as_documents: true`, `enable_web_citations: true`).
  - **Venice web scraping** for URLs found in the claim.
  - **xAI X search** (`enable_x_search: true`) on slots whose model has `supportsXSearch` (Grok today). It is used to trace a claim's origin and spread and to see what public accounts actually posted. X results count as T4 context and are never enough evidence for a grade on their own.
  - **Parallaxa function tools:**
    - `search_web`: a secondary search API, for diversity.
    - `fetch_source`: sandboxed fetch plus snapshot.
    - `query_primary_data`: Eurostat, INE, BLS and the other connectors.
    - `verify_quote`.
    - `lookup_entity`: Wikidata.
    - `find_past_analyses`: the internal cache.
  - **`submit_verdict`** via `json_schema` structured output: grade, confidence, reasoning, cited sources.
- **Budgets per slot** (admin-configurable): max tool calls (default 12), web searches (4), X searches (3), scraped URLs (5), time (90 s), and a cost cap per investigation.
- **What a model needs to be selectable:**
  - Capabilities: `supportsFunctionCalling`, `supportsResponseSchema` and `supportsWebSearch`.
  - Status: not offline and not deprecated.
  - Context of at least 128k tokens.
  - A privacy tier allowed for that slot.

  X search is switched on automatically when `supportsXSearch` is true. The admin console checks these flags live and only offers compatible models.
- **Harness check:** before a model goes live, an automated run on 5 gold-set claims confirms that tool calls, search, structured output, citations and (where available) X search work. It shows the output side by side with the current model.
- **One adapter layer** absorbs model-specific quirks (e.g., OpenAI reasoning models rejecting `seed`/`stop`, refusal formats, reasoning-effort options), so prompts stay identical across slots.

**Swapping models at any time:**
- **Versioned configuration:** the configuration is versioned in Postgres (the source of truth) and published to Edge Config for fast reads.
- **Takes effect in seconds:** new analyses use a change within ~10 s and no deploy is needed. In-flight analyses finish with the version they started with. Every analysis records its configuration version and each slot's model.
- **Normal flow in the admin console:** **Choose → Test (harness check) → Shadow (optional: runs alongside the live model on the next N analyses without affecting results) → Activate**. An **emergency swap** skips Shadow but still requires a passing harness check.
- **Post-swap eval:** every activation starts a 50-claim gold-set eval in the background. If accuracy, calibration, mirror parity or language parity regress beyond tolerance, the console warns and offers one-click rollback.
- **Public record:** every change needs a written reason, is audit-logged, and appears on the Trust Center's "Model lineup and change history" page.
- **No silent re-grading:** past analyses keep their grades. Users can choose "Re-run with current models" to see a diff.

**Fallback design:**
- **Error classes → action:**
  - 429: honour reset header, retry once with jitter, else fallback.\[69\]
  - 5xx/timeout: retry once (backoff 250 ms→1 s), then fallback.
  - 4xx schema/validation: repair prompt once; no fallback.
  - 401/402 (auth/credits): immediate fallback + page on-call.
  - Content refusal: for perspective slots, record an abstention (no substitute, because refusal patterns are audited); for utility roles, alternate Venice model, then fallback.
- **Timeouts:** first token 8 s; 45 s per step (90 s for adjudication).
- **Circuit breaker** (per model; state in a Marketplace KV store, overrides in Edge Config): opens after 5 failures in 60 s or p95 latency > 3× baseline; half-open probe every 30 s; manual override.
- **Health checks:** 1-minute cron pings a tiny completion per critical model, feeding the breaker and a public status page.
- **Model mapping:** each slot maps to the nearest AI Gateway model of the *same family and origin* (e.g., Grok → xAI, GPT → OpenAI, DeepSeek → DeepSeek). If none exists, a different model of the same origin is used and flagged, so the three-perspective lineup survives an outage. Venice-native web search and X search are not available on the fallback path, so investigations use Parallaxa's own search and fetch tools, and the analysis discloses it. The mapping is editable in the admin console.
- **Disclosure:** fallback analyses show "Generated via backup provider (Vercel AI Gateway) during a Venice outage"; `llm_calls.provider` records it.
- **Cost caps:** Gateway budget alerts are soft caps, so also enforce an app-level daily spend ceiling; fallback limited to Check and Briefing (dialogue pauses with a friendly message); per-user quotas. Gateway charges provider list price with no token markup; "Fallback to Vercel Keys" is on by default, and turning it off adds a $0.20 per 1,000 BYOK request fee. Enable Gateway zero-data-retention routing for steps containing user text (check current fees).\[70\]\[71\]\[72\]

### 9.5 Retrieval layer
- **Primary:** Venice web search with results returned as documents (single privacy posture).\[61\] **Secondary:** an independent search API (e.g., Brave Search API, Exa, or Tavily) for diversity and cross-checks.
- **Primary-data connectors:** Eurostat, INE, OECD, World Bank, BOE/EUR-Lex, US Census/BLS, CIS barometers, CENDOJ, parliamentary records, Wikidata (entity resolution only).
- **Source handling:** outlet metadata (type, country; *not* left/right bias scores); every cited page snapshotted to Blob (dated, hashed) against link rot and stealth edits; robots.txt and copyright respected (snapshots private; only short quotes displayed).

### 9.6 Evaluation & benchmarks
- **Accuracy gold set:** ≥ 1,000 claims balanced across left/right origin, countries and both launch languages (each claim also available as a professionally translated variant in the other language; translated again for each language added later), expert-graded with fact-checkers of *different* orientations plus academics. Metrics: grade accuracy, macro-F1, calibration (ECE), citation precision, source-tier quality.
- **Even-handedness suite:** (a) mirror pairs with grade parity within ±0.1 on an ordinal scale where evidence is equivalent; (b) Westwood-style perceived-slant panels stratified by ideology in ES/US/UK/MX, with no significant perceived slant on ≥ 80% of topics; (c) refusal symmetry across sides; (d) language parity across all supported languages (same grade for the same claim and evidence whatever the input and output language, ≥ 98% agreement), plus native-speaker fluency and terminology ratings per language (es-ES raters for Spanish).
- **Release gate:** no prompt/model change ships if accuracy drops > 1 point or any symmetry metric regresses beyond tolerance. Eval results published.

### 9.7 Security and testing
- **Auth:** optional passkey accounts for users (no email, no password); nothing identifying is stored. Notifications: Web Push for readers, a Telegram bot for admin alerts; no email anywhere. The **admin console** uses `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars with a signed short-lived session (`ADMIN_SESSION_SECRET`), lockout, BotID, CSRF protection, per-route session checks and an optional IP allowlist (F8). Named admin accounts with passkeys and roles in Phase 2.
- **Abuse prevention:** BotID; WAF rate limits (e.g., 20 checks/hour anonymous, 60 signed-in); reviewer reputation.
- **Secrets & headers:** environment-scoped Vercel env vars, quarterly rotation; strict nonce-based CSP, HSTS preload, `frame-ancestors 'none'`; pnpm lockfile, dependency audit (`pnpm audit:deps`); all URL fetching inside Sandbox with egress allow-list and private-IP blocking (SSRF).
- **Testing:** Vitest unit tests; contract tests for Venice/Gateway adapters; Playwright E2E on mobile/tablet/desktop; axe in the end-to-end suite; LLM evals (`pnpm eval`) before every prompt or model change. No hosted CI: the full suite runs locally with `pnpm verify` before pushing. **Preview Deployments** per PR with their own anonymized Neon branch; **Rolling Releases**; instant rollback.
- **SLOs:** 99.5% Check availability; p95 time-to-first-result < 20 s; briefing ready by 06:45 local on 99% of days.

---

## 10. Success metrics (truth and depolarization, never engagement)

| Category | Metric | Target (year 1) |
|---|---|---|
| Truth | Gold-set grade accuracy | ≥ 90% |
| Truth | Calibration (ECE) | ≤ 0.05 |
| Truth | Verified-citation precision | ≥ 99% |
| Truth | Validated errors per 1,000 analyses; median time to correction | < 5; < 48 h |
| Even-handedness | Mirror-pair grade parity | within ±0.1 |
| Trust | Trust score by self-placed ideology (opt-in survey) | Left–right gap ≤ 10 points |
| Reach balance | Usage share by self-placed ideology vs population | Neither wing < 60% of its population share |
| Depolarization | Affective polarization (feeling thermometer), users vs control, at 2 and 8 weeks | Significant reduction; report effect sizes honestly, including nulls |
| Depolarization | Perception-gap error before vs after quiz | ≥ 30% reduction in absolute error |
| Wellbeing | "I felt respected" / "I felt calmer" | ≥ 80% |
| Relevance | "Today's briefing was relevant to me" (opt-in micro-survey) | ≥ 75% |
| Language quality | Cross-language grade agreement on the gold set; native fluency rating per language | ≥ 98%; ≥ 4.5/5 in every language |
| Language quality | Users who manually switch away from the detected language | < 10% (higher suggests detection or translation problems) |
| Relevance | Users who set at least one place or topic beyond the default | ≥ 40% |
| Relevance | Briefings that needed a regional→country fallback, per region | Published; < 20% for regions marked Full coverage |
| Anti-bubble guardrail | Users keeping "outside your filters" on; topic diversity of briefings seen | Alarm if < 60% keep it on, or if a cohort's median topic diversity falls below the edition baseline |

**Explicitly excluded as goals:** time-on-site, daily sessions, shares, streaks. They are guardrails only (alarm if average session exceeds 15 minutes). **Experimentation:** pre-registered RCTs with academic partners, opt-in research consent, ethics review, all results published including nulls, benchmarked against the megastudy's best performers.

---

## 11. Cost estimate (indicative, USD/month)

Assumptions: a fresh analysis runs three independent investigations (US-R, US-L, CN), each about 40k input + 4k output tokens with 3–4 searches (plus 1–2 X searches on the Grok slot), plus small-model steps and the writer. With the default lineup (Grok 4.7, GPT-6.2 Sol, DeepSeek V4 Pro at Nov 2026 Venice prices) that is roughly **$0.35–$0.50 per fresh analysis**, or **$0.20–$0.30** with an economy lineup (smaller variants such as Grok 4.3, GPT-6.1 Terra, DeepSeek V4 Flash) and tighter search budgets for simple factual claims. Prompt caching of the shared evidence pool lowers this further. The blended cost assumed below falls from ~$0.45 (pilot) to ~$0.30 (scale) as caching and economy routing grow. Cache-hit rate rises from 30% to 70% with scale. Briefings cost about $10/day per edition (country or Global) and about $4/day per regional edition, since regional editions reuse country analyses. Personal assembly is rule-based, so the number of users does not change briefing cost. Pilot assumes ~5 editions; Growth ~25 (e.g., Spain's 17 autonomous communities added); Scale ~80. The binding constraint for regional editions is **human review capacity**, not model cost. Rendering an analysis into another language costs about $0.005–$0.01 (small structured-to-prose step, cached per version and language, done on first request), so the second language adds only a few percent to LLM spend, and each future language a similar amount. Professional UI translation and native Spanish review (about €10k–€20k/year) are excluded below, like other staff costs.

| Tier | MAU | Fresh analyses/mo | LLM + search | Vercel (Pro + usage) | Neon | Other | Total |
|---|---|---|---|---|---|---|---|
| Pilot | 2,000 | 6,000 | ~$4,200 | ~$100 | ~$20 (Launch) | ~$50 | **~$4,400** |
| Growth | 50,000 | 60,000 | ~$25,000 | ~$400 | ~$150 | ~$300 | **~$26,000** |
| Scale | 500,000 | 300,000 | ~$102,000 | ~$2,500 | ~$800 (Scale) | ~$1,500 | **~$107,000** |

Levers, all adjustable live in the admin console with a cost preview: model choice per slot (default vs economy variants), search and tool-call budgets, semantic caching, prompt caching, small models for utility steps, briefing reuse, per-user quotas and the daily spend ceiling. Excluded: staff, legal, insurance, panel stipends, audits, likely the largest real costs (estimate €300k–€600k/year for a minimal team of 4–6 plus panel and legal).

---

## 12. Roadmap

| Phase | Timing | Scope |
|---|---|---|
| **0. Foundations** | Months 0–2 | Legal entity & funding policy, name clearance, methodology v1, gold set v1 (500 claims, with place and topic tags), panel recruited, DPIA, topic taxonomy v1 reviewed by the panel, place list (ISO 3166-1/2) and coverage-level criteria for launch countries, style guides and glossaries for English and Spanish, Spanish translator and native reviewers contracted, admin console skeleton (login, model slots, harness check) |
| **1. MVP (closed beta)** | Months 2–5 | Check, Daily Parallax (Global + Spain + US editions), side-by-side card, Push back, perception-gap quiz (ES/US), Trust Center, PWA + share target, read-only Ledger (parties + national leaders), Venice + fallback. **Your Parallaxa:** global/country/region scope, follow/mute topics, follow stories, briefing settings, region filtering of tagged stories, regional editions for 2–3 pilot Spanish autonomous communities. **English and Spanish** (`en`, `es-ES`) with browser-based detection, English fallback, and the language registry ready for more. **Three perspective slots** (US-R, US-L, CN) with the investigation harness; **admin console** (models, investigation and pipeline settings, limits, metrics, alerts, audit log) |
| **2. Public launch** | Months 5–9 | Full Ledger with reply and appeals, regional actors, invite-only bridging community review, prediction tracker, prebunk lessons, country editions for the UK and Mexico (content in English and Spanish), first symmetry audit, first RCT. Regional editions for all Spanish autonomous communities and the largest US states (as review capacity allows), follow actors, weekly email digest, RSS per topic/place, on-device topic suggestions, named admin accounts with passkeys and roles |
| **3. Expansion** | Months 9–18 | Browser extension, debate maps, common-ground rooms pilot, new languages added through the language playbook (candidates: French, German, Italian, Portuguese), each with its country edition, municipal scope pilot, institutional licences, external audit |

---

## 13. Risks and mitigations

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| Labelled partisan at launch | High / High | Symmetric showcase examples, panel, published audits, endorsements from both sides |
| Defamation claims | Medium / High | Conduct-only language, final rulings only, right of reply, legal review, insurance |
| Model error goes viral | Medium / High | Human review on briefing and Ledger, fast corrections, "Models disagree" banners |
| Low adoption by the wings | High / High | Start with distrustful-but-curious users; partner with creators across the spectrum; publish usage balance |
| Effects fade (as in research) | High / Medium | Daily habit, spaced repetition of perception-gap facts, honest reporting |
| State-actor attacks or Venice outage | Medium / High | BotID, WAF, bridging weights, anomaly detection; Gateway fallback, quotas, spend ceilings |
| A model vendor changes behaviour, price or availability, or a model's slant shifts | Medium / Medium | Swappable slots, harness check and post-swap eval, AI Gateway fallback mapping, per-slot refusal and agreement monitoring in the admin console |
| Leaning labels for model slots are read as Parallaxa endorsing a political frame | Medium / Medium | Labels describe published *perceptions*, not instructions; identical neutral prompts for every slot; methodology page explains the design |
| Personalization becomes a filter bubble | Medium / High | Place/topic filters only, never side or outlet; "outside your filters" slot on by default; identical analyses for everyone; diversity guardrail metric |
| Thin or one-sided regional coverage | High / Medium | Coverage levels shown; fallback to country with disclosure; regional editions launched only after symmetry and source checks pass; regional reviewers on the panel |
| A translation changes meaning (wrong nuance, grade or number) | Medium / High | Language-neutral analyses; rendering cannot change grades or numbers; automated cross-language consistency checks; native review of Ledger and legal text; language-parity release gate |
| Defamation exposure differs by language and country | Medium / High | Per-language legal review of Ledger phrasing and grade names; conduct-only wording in every glossary |
| Preferences leak political interest | Low / High | Local-first storage, application-level encryption, no provider exposure, k-anonymous aggregates only |

---

## 14. Caveats and open questions
- **Evidence limits:** most depolarization effects are small and fade within weeks; the Costello et al. study carries an Editorial Expression of Concern; social media's causal role remains disputed.\[14\] Parallaxa should present itself as one helpful tool, not a cure.
- **Volatile details:** the default model IDs in 9.4 are a snapshot of Venice's Nov 2026 catalog (the admin console reads the live catalog); Venice models/prices, Vercel Queues/Workflow beta status, Neon Auth, and AI Gateway fees change frequently; re-verify at build time. Some figures come from third-party captures of official pages and are marked as such.
- **Name:** parallaxa.app availability and trademark clearance remain unverified.
- **Open questions:** Which legal home (Spain, Netherlands, Ireland) best balances defamation exposure and funding? How are left/right labels defined in multiparty systems? Should the panel have veto power over Ledger entries, or only appeals? What minimum human-review capacity is needed before a public Ledger? Which academic partners will co-own the RCT and audit program? What coverage threshold qualifies a region for its own edition, and in which order should regions launch? Should users be allowed to turn off the "outside your filters" slot permanently? Is municipal scope worth its source and review cost? Should Spain's co-official languages (Catalan, Basque, Galician) be added after launch, given the Spanish regional editions? Which English spelling convention should the style guide fix? Which language should be added first after launch, and what usage or partner signal triggers it?

## Fuentes

1. [Political polarization and the nation’s ‘perception gap’ — Granite State News Collaborative](https://www.collaborativenh.org/know-your-vote-articles/2024/10/14/9p6fi0ylic9l2ruzue8pbpqsiip3hg)
2. [Why Your Political Opponents Might Not Be as Extreme as You Think - Intellectual Takeout](https://intellectualtakeout.org/2026/08/political-opponents-not-as-extreme/)
3. [(PDF) Affective Polarisation in Times of Political Instability and Conflict. Spain from a Comparative Perspective](https://www.researchgate.net/publication/359876689_Affective_Polarisation_in_Times_of_Political_Instability_and_Conflict_Spain_from_a_Comparative_Perspective)
4. [Far away? How misperceived polarization fuels affective ...](https://ddd.uab.cat/pub/papers/papers_a2025v110n3/papers_a2025v110n3pe3363.pdf)
5. [How do social media feed algorithms affect attitudes and behavior in an election campaign?](https://www.science.org/doi/10.1126/science.abp9364)
6. [First Findings Shed Light on Role of Social Media Algorithms in 2020 Election](https://moody.utexas.edu/news/socialmediainelections)
7. [Academic Appointments](https://profiles.stanford.edu/hunt-allcott)
8. [First Four Papers from US 2020 Facebook & Instagram Research Election Study Published in Science and Nature](https://csmapnyu.org/impact/news/first-four-papers-from-us-2020-facebook-instagram-research-election-study-published-in-science-and-nature)
9. [Why “backﬁre effects” do not explain the durability of political misperceptions](https://bpb-us-e1.wpmucdn.com/sites.dartmouth.edu/dist/5/2293/files/2021/04/pnas-not-backfire.pdf)
10. [Blog #0196: Storytelling in a Post-Truth World](https://matthewsinclair.com/blog/0196-storytelling-in-a-post-truth-world)
11. [Megastudy testing 25 treatments to reduce antidemocratic attitudes and partisan animosity](https://bpb-us-w2.wpmucdn.com/web.sas.upenn.edu/dist/9/244/files/2024/10/science.adh4764.pdf)
12. [2024-Voelkel-et-al-Science.pdf](http://www.intergroupneurosciencelaboratory.com/s/2024-Voelkel-et-al-Science.pdf)
13. [Durably reducing conspiracy beliefs through dialogues with AI](https://www.science.org/doi/10.1126/science.adq1814)
14. [Editorial Expression of Concern on 2024 Research Article “Durably reducing conspiracy beliefs through dialogues with AI”](https://www.eurekalert.org/news-releases/1131247)
15. [Large language models can effectively convince people to believe conspiracies](https://arxiv.org/pdf/2601.05050)
16. [Can AI Mediation Improve Democratic Deliberation?](https://knightcolumbia.org/content/can-ai-mediation-improve-democratic-deliberation)
17. [Accountable Human-AI Deliberation with LLMs: Scaling Collective Intelligence through Symbiotic Scaffolding](https://arxiv.org/pdf/2605.26940)
18. [Experiment on YouTube reveals potential to 'inoculate' millions of users against misinformation](https://phys.org/news/2022-08-youtube-reveals-potential-inoculate-millions.html)
19. [Roozenbeek et al., Sci. Adv. 8, eabo6254 (2022) 24 August 2022](https://moodle2.units.it/pluginfile.php/745151/mod_resource/content/0/Roozenbeek,%20vander%20Linden,%20Goldberg,%20Rathje,%20Lewandowsky%202021.pdf)
20. [RESEARCH ARTICLE POLITICAL SCIENCES COMPUTER SCIENCES OPEN ACCESS](https://www.pnas.org/doi/pdf/10.1073/pnas.2503413122)
21. [COLLABORATIVELY ADDING CONTEXT TO SOCIAL MEDIA POSTS REDUCES THE SHARING OF](https://arxiv.org/pdf/2404.02803)
22. [Community notes increase trust in fact-checking on social media](https://academic.oup.com/pnasnexus/article/3/7/pgae217/7686087)
23. [Crowdsourcing Contextual Information (Community Notes)](https://www.prosocialdesign.org/library/crowdsourcing-contextual-information-community-notes)
24. [Community Notes: Crowd Participation and Dependence on Professional Fact-Checking Across Languages](https://arxiv.org/pdf/2512.19947)
25. [The levers of political persuasion with conversational artificial intelligence](https://www.researchgate.net/publication/398350199_The_levers_of_political_persuasion_with_conversational_artificial_intelligence)
26. [The levers of political persuasion with conversational artificial intelligence - ADS](https://ui.adsabs.harvard.edu/abs/2025Sci...390a3884H/abstract)
27. [Study finds perceived political bias in popular AI models](https://news.stanford.edu/stories/2025/05/ai-models-llms-chatgpt-claude-gemini-partisan-bias-research-study)
28. [Hoover study: AI models seen as left-leaning](https://www.linkedin.com/posts/hoover-institution-at-stanford-university_ai-bias-leans-left-in-most-instances-study-activity-7329199081753370624-yUVX)
29. [AI Chatbots Are Liberal-Left ‘Biased’](https://etcjournal.com/2026/06/24/ai-chatbots-are-liberal-left-biased/)
30. [Progressive in Principle, Centrist in Practice: LLM Political Bias Is Instrument-Dependent](https://arxiv.org/html/2606.00048)
31. [Automation as Consensus. Grok may be the first LLM specifically…](https://medium.com/@outofbag/automation-as-consensus-dc68d4999e53)
32. [4th EEAS Report on Foreign Information Manipulation and Interference Threats - EUvsDisinfo](https://euvsdisinfo.eu/eeas-4th-fimi-threat-report-march-2026/)
33. [ENISA Threat Landscape 2026 SEPTEMBER 2026 TLP:CLEAR ENISA Threat Landscape](https://www.enisa.europa.eu/sites/default/files/2026-09/ENISA%20Threat%20Landscape%202026_Final.pdf)
34. [FIMI Threats Explained: EEAS 2026 Infographic Insights](https://behorizon.org/dismantling-the-fimi-house-of-cards/)
35. [AI, Elections, and the Liar’s Dividend - by Bob Bauer](https://www.execfunctions.org/p/ai-elections-and-the-liars-dividend)
36. [PNAS 2025 Vol. 122 No. 25 e2502053122](https://www.pnas.org/doi/pdf/10.1073/pnas.2502053122)
37. [The Levers of Political Persuasion with Conversational AI](https://arxiv.org/pdf/2507.13919v1)
38. [August: Misinformation media release](https://www.bristol.ac.uk/news/2022/august/misinformation-media-release.html)
39. [Polarization Statistics 2026 — How Divided Are We? - Mindfuse](https://mindfuse.io/polarization-statistics)
40. [Parallax (disambiguation)](<https://en.wikipedia.org/wiki/Parallax_(disambiguation)>)
41. [GitHub - parallaxa-labs/parallaxa · GitHub](https://github.com/parallaxa-labs/parallaxa)
42. [Parallaxa](https://www.facebook.com/parallaxadesign/)
43. [Parallaxa: 4K Live Wallpaper for Android - Free App Download](https://www.appbrain.com/app/parallaxa-4k-live-wallpaper/com.parallax.live.wallpaper)
44. [Photography Travel Blog](https://parallaxaview.com/)
45. [Next Generation Gunshot Positioning System](https://triangula.com/)
46. [Triangula 2026 Company Profile: Valuation, Funding & Investors](https://pitchbook.com/profiles/company/226309-60)
47. [Alidade AI company information, funding & investors](https://app.dealroom.co/companies/alidade_ai)
48. [Alidade AI](https://www.alidade-ai.com/)
49. [ALIDADE - Concentus Assessment Solutions, Inc. Trademark Registration](https://uspto.report/TM/77498487)
50. [MIRADOR Trademark of Zhejiang Zhengte Co., Ltd.. Application Number: 018174466 :: Trademark Elite Trademarks](https://www.trademarkelite.com/europe/trademark/trademark-detail/018174466/MIRADOR)
51. [MIRADOR - DCiii, LLC Trademark Registration](https://uspto.report/TM/87502806)
52. [elMirador.app App - App Store](https://apps.apple.com/us/app/elmirador-app/id6805145214)
53. [Vercel Pricing 2026: Pro vs Enterprise Cost](https://tutorsbot.com/blog/vercel-pricing-2026-pro-enterprise-cost)
54. [Vercel vs Webflow Cloud](https://vercel-docs.vercel.sh/kb/guide/vercel-vs-webflow-cloud)
55. [Fluid compute pricing](https://vercel.com/docs/functions/usage-and-pricing)
56. [Vercel Pricing: Hobby, Pro, Enterprise & the Fluid Compute Reset](https://www.usagepricing.com/blueprint/vercel)
57. [Neon plans - Neon Docs](https://neon.com/docs/introduction/plans)
58. [Neon Serverless Postgres Pricing 2026: Complete Breakdown &…](https://vela.run/articles/neon-serverless-postgres-pricing-2026/)
59. [Neon Review 2026: Serverless Postgres, Pricing and Limits](https://scored.tools/blog/neon-review-2026/)
60. [Neon Pricing: Postgres Compute, Storage, Plans](https://oceanlab.in/pricing/neon)
61. [API Reference](https://docs.venice.ai/api-reference/api-spec)
62. [Venice API Docs](https://docs.venice.ai/)
63. [GPT-6.1 Terra API: Pricing and Specs](https://docs.venice.ai/models/gpt-6-1-terra)
64. [Venice Review (2026): Pricing, Pros and Cons](https://www.subconscious.dev/providers/venice)
65. <https://docs.venice.ai/overview/privacy>
66. [Web Search](https://docs.venice.ai/api-reference/endpoint/augment/search)
67. [Venice Pricing](https://www.usagepricing.com/blueprint/venice)
68. [Changelog - Venice API Docs](https://docs.venice.ai/changelog)
69. <https://docs.venice.ai/api-reference/rate-limiting>
70. [AI Gateway Pricing](https://vercel.com/docs/ai-gateway/pricing)
71. [Vercel AI Gateway Review: Pricing, ZDR, and Fees](https://folding-sky.com/blog/vercel-ai-gateway-hundreds-ai-models-zero-data-retention)
72. [Model bill with no owner: AI Gateway costs](https://mindcat.ai/blog/vercel-ai-gateway-cost-residency)
