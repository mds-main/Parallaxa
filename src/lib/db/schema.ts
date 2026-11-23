/**
 * Database schema (PRD 9.2, TODO 7.1). Shared by Neon (production) and PGlite (local/tests).
 * Enumerations are stored as text and validated in TypeScript so new values need no migration.
 * Language columns are BCP 47 tags validated against the language registry (TODO 4.12).
 */
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type {
  ClaimType,
  Confidence,
  Grade,
  StructuredAnalysis,
  RenderedAnalysis,
  SlotId,
  VerdictSource,
  MirrorTest,
  AnalysisProgress,
} from '../domain/types';
import type { AppConfig } from '../config/schema';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const createdAt = () => ts('created_at').notNull().defaultNow();

// ── Users and preferences ─────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: createdAt(),
  locale: text('locale').notNull(),
  emailHash: text('email_hash').unique(),
  authProvider: text('auth_provider'),
  deletedAt: ts('deleted_at'),
});

/** Art. 9 data: separate table, separate key, aggregate use only. */
export const userPoliticalSelfId = pgTable('user_political_self_id', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  placementCiphertext: text('placement_ciphertext').notNull(),
  keyId: text('key_id').notNull(),
  consentAt: ts('consent_at').notNull(),
  purpose: text('purpose').notNull(),
});

export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  prefsCiphertext: text('prefs_ciphertext').notNull(),
  keyId: text('key_id').notNull(),
  version: integer('version').notNull().default(1),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetType: text('target_type').$type<'topic' | 'place' | 'actor' | 'analysis'>().notNull(),
  targetId: text('target_id').notNull(),
  channel: text('channel').$type<'push' | 'email' | 'in_app'>().notNull(),
  pushEndpointCiphertext: text('push_endpoint_ciphertext'),
  lang: text('lang').notNull(),
  /** Delivery settings for push: local time (HH:MM), IANA time zone, weekdays only. */
  settings: jsonb('settings').$type<{ time?: string; timezone?: string; days?: 'everyday' | 'weekdays' }>(),
  lastSentAt: ts('last_sent_at'),
  createdAt: createdAt(),
});

// ── Places and topics (F6) ────────────────────────────────────────────────────
export const places = pgTable('places', {
  id: text('id').primaryKey(), // 'GLOBAL', ISO 3166-1 ('ES') or ISO 3166-2 ('ES-AN')
  parentId: text('parent_id'),
  level: text('level').$type<'global' | 'country' | 'region'>().notNull(),
  names: jsonb('names').$type<Record<string, string>>().notNull(),
  localName: text('local_name'),
  timezone: text('timezone').notNull(),
  coverageLevel: text('coverage_level').$type<'full' | 'partial' | 'limited'>().notNull(),
  hasEdition: boolean('has_edition').notNull().default(false),
  active: boolean('active').notNull().default(true),
});

export const topics = pgTable('topics', {
  id: text('id').primaryKey(), // slug, e.g. 'housing' or 'housing.rent'
  parentId: text('parent_id'),
  names: jsonb('names').$type<Record<string, string>>().notNull(),
  countryCode: text('country_code'),
  taxonomyVersion: integer('taxonomy_version').notNull().default(1),
  active: boolean('active').notNull().default(true),
});

// ── Claims, analyses and sources (F1) ─────────────────────────────────────────
export const claims = pgTable(
  'claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    canonicalText: text('canonical_text').notNull(),
    lang: text('lang').notNull(),
    claimType: text('claim_type').$type<ClaimType>().notNull(),
    textHash: text('text_hash').notNull(),
    // Embedding as float4[]; similarity is computed in the app at pilot scale (upgrade path: pgvector).
    embedding: real('embedding').array(),
    firstSeenAt: createdAt(),
  },
  (t) => [uniqueIndex('claims_text_hash_idx').on(t.textHash)],
);

export const analyses = pgTable(
  'analyses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    claimId: uuid('claim_id').references(() => claims.id),
    version: integer('version').notNull().default(1),
    status: text('status').$type<'queued' | 'running' | 'review' | 'published' | 'failed'>().notNull(),
    inputKind: text('input_kind').$type<'text' | 'url' | 'image'>().notNull(),
    inputLang: text('input_lang'),
    grade: text('grade').$type<Grade>(),
    confidence: text('confidence').$type<Confidence>(),
    structured: jsonb('structured').$type<StructuredAnalysis>(),
    models: jsonb('models').$type<Record<string, string>>(),
    provider: text('provider').$type<'venice' | 'gateway' | 'demo'>(),
    promptVersion: text('prompt_version'),
    configVersionId: integer('config_version_id'),
    mirrorTest: jsonb('mirror_test').$type<MirrorTest>(),
    disagreement: boolean('disagreement').notNull().default(false),
    humanReviewed: boolean('human_reviewed').notNull().default(false),
    progress: jsonb('progress').$type<AnalysisProgress>(),
    error: text('error'),
    costUsd: doublePrecision('cost_usd'),
    createdAt: createdAt(),
    publishedAt: ts('published_at'),
  },
  (t) => [index('analyses_status_idx').on(t.status), index('analyses_created_idx').on(t.createdAt)],
);

export const analysisRenderings = pgTable(
  'analysis_renderings',
  {
    analysisId: uuid('analysis_id').notNull().references(() => analyses.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    lang: text('lang').notNull(),
    body: jsonb('body').$type<RenderedAnalysis>().notNull(),
    model: text('model'),
    promptVersion: text('prompt_version'),
    consistencyCheck: jsonb('consistency_check').$type<{ ok: boolean; notes?: string }>(),
    nativeReviewed: boolean('native_reviewed').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.analysisId, t.version, t.lang] })],
);

export const analysisVerdicts = pgTable(
  'analysis_verdicts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    analysisId: uuid('analysis_id').notNull().references(() => analyses.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    slot: text('slot').$type<SlotId>().notNull(),
    model: text('model').notNull(),
    provider: text('provider').notNull(),
    grade: text('grade').$type<Grade>(),
    confidence: text('confidence').$type<Confidence>(),
    abstained: boolean('abstained').notNull().default(false),
    coiExcluded: boolean('coi_excluded').notNull().default(false),
    shadow: boolean('shadow').notNull().default(false),
    reasoning: text('reasoning'),
    sources: jsonb('sources').$type<VerdictSource[]>(),
    toolCalls: integer('tool_calls').notNull().default(0),
    searches: jsonb('searches').$type<{ web: number; x: number; scrape: number }>(),
    costUsd: doublePrecision('cost_usd'),
    latencyMs: integer('latency_ms'),
    createdAt: createdAt(),
  },
  (t) => [index('verdicts_analysis_idx').on(t.analysisId)],
);

export const outlets = pgTable('outlets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  domain: text('domain').notNull().unique(),
  type: text('type').notNull(),
  country: text('country'),
  lang: text('lang'),
});

export const sources = pgTable('sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull(),
  title: text('title'),
  outletId: uuid('outlet_id').references(() => outlets.id),
  tier: integer('tier').notNull(),
  lang: text('lang'),
  publishedAt: ts('published_at'),
  snapshotKey: text('snapshot_key'),
  contentHash: text('content_hash'),
  createdAt: createdAt(),
});

export const analysisSources = pgTable(
  'analysis_sources',
  {
    analysisId: uuid('analysis_id').notNull().references(() => analyses.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id').notNull().references(() => sources.id),
    tier: integer('tier').notNull(),
    quote: text('quote'),
    quoteVerified: boolean('quote_verified').notNull().default(false),
    stance: text('stance').$type<'supports' | 'contradicts' | 'context'>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.analysisId, t.sourceId] })],
);

export const claimPlaces = pgTable(
  'claim_places',
  {
    analysisId: uuid('analysis_id').notNull().references(() => analyses.id, { onDelete: 'cascade' }),
    placeId: text('place_id').notNull(),
    confidence: real('confidence').notNull(),
  },
  (t) => [primaryKey({ columns: [t.analysisId, t.placeId] })],
);

export const claimTopics = pgTable(
  'claim_topics',
  {
    analysisId: uuid('analysis_id').notNull().references(() => analyses.id, { onDelete: 'cascade' }),
    topicId: text('topic_id').notNull(),
    confidence: real('confidence').notNull(),
  },
  (t) => [primaryKey({ columns: [t.analysisId, t.topicId] })],
);

export const corrections = pgTable('corrections', {
  id: uuid('id').primaryKey().defaultRandom(),
  analysisId: uuid('analysis_id').notNull().references(() => analyses.id),
  fromVersion: integer('from_version').notNull(),
  toVersion: integer('to_version').notNull(),
  reason: jsonb('reason').$type<Record<string, string>>().notNull(),
  diff: jsonb('diff').$type<{ field: string; before: unknown; after: unknown }[]>().notNull(),
  createdAt: createdAt(),
});

export const errorReports = pgTable('error_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  analysisId: uuid('analysis_id').notNull().references(() => analyses.id),
  version: integer('version').notNull(),
  body: text('body').notNull(),
  status: text('status').$type<'open' | 'validated' | 'rejected' | 'corrected'>().notNull().default('open'),
  createdAt: createdAt(),
  resolvedAt: ts('resolved_at'),
});

// ── Actor Ledger (F3) ─────────────────────────────────────────────────────────
export const actors = pgTable('actors', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  type: text('type')
    .$type<'politician' | 'party' | 'government' | 'public_figure' | 'influencer' | 'company' | 'entrepreneur' | 'media'>()
    .notNull(),
  name: text('name').notNull(),
  country: text('country').notNull(),
  homePlaceId: text('home_place_id'),
  publicRole: jsonb('public_role').$type<Record<string, string>>(),
  partyFamily: text('party_family'),
  verifiedContact: boolean('verified_contact').notNull().default(false),
  published: boolean('published').notNull().default(false),
  createdAt: createdAt(),
});

export const actorClaims = pgTable(
  'actor_claims',
  {
    actorId: uuid('actor_id').notNull().references(() => actors.id, { onDelete: 'cascade' }),
    analysisId: uuid('analysis_id').notNull().references(() => analyses.id, { onDelete: 'cascade' }),
    reach: integer('reach').notNull().default(1),
    saidAt: ts('said_at'),
  },
  (t) => [primaryKey({ columns: [t.actorId, t.analysisId] })],
);

export const actorDimensionScores = pgTable(
  'actor_dimension_scores',
  {
    actorId: uuid('actor_id').notNull().references(() => actors.id, { onDelete: 'cascade' }),
    dimension: text('dimension').notNull(),
    value: real('value'),
    n: integer('n').notNull(),
    confidence: text('confidence').$type<Confidence>(),
    rubricVersion: text('rubric_version').notNull(),
    computedAt: ts('computed_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.actorId, t.dimension] })],
);

export const actorReplies = pgTable('actor_replies', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').notNull().references(() => actors.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  links: jsonb('links').$type<string[]>().notNull().default([]),
  status: text('status').$type<'submitted' | 'published' | 'rejected'>().notNull().default('submitted'),
  submittedAt: createdAt(),
  publishedAt: ts('published_at'),
});

export const appeals = pgTable('appeals', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => actors.id),
  analysisId: uuid('analysis_id').references(() => analyses.id),
  stage: integer('stage').notNull().default(1),
  status: text('status').$type<'open' | 'upheld' | 'changed'>().notNull().default('open'),
  reason: text('reason').notNull(),
  decision: text('decision'),
  createdAt: createdAt(),
});

// ── Daily Parallax (F2) ───────────────────────────────────────────────────────
export const briefingEditions = pgTable(
  'briefing_editions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    placeId: text('place_id').notNull(),
    date: text('date').notNull(), // YYYY-MM-DD in the place's time zone
    status: text('status').$type<'draft' | 'in_review' | 'published' | 'late'>().notNull(),
    reviewedBy: jsonb('reviewed_by').$type<string[]>().notNull().default([]),
    createdAt: createdAt(),
    publishedAt: ts('published_at'),
  },
  (t) => [uniqueIndex('edition_place_date_idx').on(t.placeId, t.date)],
);

export const editionStories = pgTable(
  'edition_stories',
  {
    editionId: uuid('edition_id').notNull().references(() => briefingEditions.id, { onDelete: 'cascade' }),
    analysisId: uuid('analysis_id').notNull().references(() => analyses.id),
    rank: integer('rank').notNull(),
    topicId: text('topic_id').notNull(),
    salience: real('salience').notNull(),
    headline: jsonb('headline').$type<Record<string, string>>().notNull(),
    perceptionFact: jsonb('perception_fact').$type<Record<string, string>>(),
  },
  (t) => [primaryKey({ columns: [t.editionId, t.analysisId] })],
);

// ── Perception-gap quiz (F4) ──────────────────────────────────────────────────
export const quizItems = pgTable('quiz_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  placeId: text('place_id').notNull(),
  topicId: text('topic_id').notNull(),
  question: jsonb('question').$type<Record<string, string>>().notNull(),
  trueValue: real('true_value').notNull(),
  margin: real('margin').notNull(),
  sourceName: text('source_name').notNull(),
  sourceUrl: text('source_url').notNull(),
  originalWording: text('original_wording').notNull(),
  year: integer('year').notNull(),
  active: boolean('active').notNull().default(true),
});

/** No user id: responses are anonymous and used only in aggregate. */
export const quizResponses = pgTable('quiz_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  quizItemId: uuid('quiz_item_id').notNull().references(() => quizItems.id),
  guess: real('guess').notNull(),
  createdAt: createdAt(),
});

// ── Review, audit, telemetry ──────────────────────────────────────────────────
export const reviewTasks = pgTable('review_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind')
    .$type<'disagreement' | 'briefing' | 'ledger' | 'error_report' | 'appeal' | 'reply' | 'consistency' | 'sample'>()
    .notNull(),
  refId: text('ref_id').notNull(),
  status: text('status').$type<'open' | 'done' | 'escalated'>().notNull().default('open'),
  priority: integer('priority').notNull().default(2),
  dueAt: ts('due_at'),
  notes: text('notes'),
  resolvedBy: text('resolved_by'),
  createdAt: createdAt(),
  resolvedAt: ts('resolved_at'),
});

export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    at: createdAt(),
    actor: text('actor').notNull(),
    action: text('action').notNull(),
    target: text('target').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    reason: text('reason'),
    ipHash: text('ip_hash'),
  },
  (t) => [index('audit_at_idx').on(t.at)],
);

export const llmCalls = pgTable(
  'llm_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    analysisId: uuid('analysis_id'),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    slot: text('slot'),
    step: text('step').notNull(),
    tokensIn: integer('tokens_in').notNull().default(0),
    tokensOut: integer('tokens_out').notNull().default(0),
    searches: jsonb('searches').$type<{ web: number; x: number; scrape: number }>(),
    costUsd: doublePrecision('cost_usd').notNull().default(0),
    latencyMs: integer('latency_ms').notNull().default(0),
    finishReason: text('finish_reason'),
    errorClass: text('error_class'),
    /** Served (or attempted) by the backup vendor because the primary failed. */
    fallback: boolean('fallback').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('llm_calls_created_idx').on(t.createdAt)],
);

export const configVersions = pgTable('config_versions', {
  id: serial('id').primaryKey(),
  createdAt: createdAt(),
  reason: text('reason').notNull(),
  config: jsonb('config').$type<AppConfig>().notNull(),
  status: text('status').$type<'draft' | 'testing' | 'shadow' | 'active' | 'retired'>().notNull(),
  harnessCheck: jsonb('harness_check'),
  evalRunId: uuid('eval_run_id'),
  activatedAt: ts('activated_at'),
});

export const evalRuns = pgTable('eval_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  configVersionId: integer('config_version_id'),
  kind: text('kind').$type<'nightly' | 'harness_check' | 'shadow' | 'post_swap'>().notNull(),
  status: text('status').$type<'running' | 'passed' | 'failed'>().notNull(),
  metrics: jsonb('metrics').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
});

export const adminSessions = pgTable('admin_sessions', {
  id: text('id').primaryKey(),
  createdAt: createdAt(),
  expiresAt: ts('expires_at').notNull(),
  lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
  ipHash: text('ip_hash').notNull(),
  revokedAt: ts('revoked_at'),
});

export const adminLoginAttempts = pgTable(
  'admin_login_attempts',
  {
    id: serial('id').primaryKey(),
    ipHash: text('ip_hash').notNull(),
    success: boolean('success').notNull(),
    at: createdAt(),
  },
  (t) => [index('admin_attempts_ip_idx').on(t.ipHash, t.at)],
);

export const metricsDaily = pgTable(
  'metrics_daily',
  {
    date: text('date').notNull(),
    metric: text('metric').notNull(),
    dims: text('dims').notNull().default(''),
    value: doublePrecision('value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.date, t.metric, t.dims] })],
);

/** Aggregate, anonymous usage counters (no user ids, no IPs). */
export const usageEvents = pgTable(
  'usage_events',
  {
    id: serial('id').primaryKey(),
    event: text('event').notNull(),
    lang: text('lang'),
    placeId: text('place_id'),
    topicId: text('topic_id'),
    at: createdAt(),
  },
  (t) => [index('usage_events_at_idx').on(t.at)],
);

export const modelCatalog = pgTable('model_catalog', {
  id: text('id').primaryKey(),
  data: jsonb('data').$type<Record<string, unknown>>().notNull(),
  fetchedAt: ts('fetched_at').notNull().defaultNow(),
});

export const rateCounters = pgTable(
  'rate_counters',
  {
    key: text('key').notNull(),
    windowStart: integer('window_start').notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const alertsLog = pgTable('alerts_log', {
  id: serial('id').primaryKey(),
  kind: text('kind').notNull(),
  message: text('message').notNull(),
  at: createdAt(),
  acknowledgedAt: ts('acknowledged_at'),
});

/** Private, dated, hashed text snapshots of cited pages (TODO 11.7): protects against link rot and stealth edits. */
export const sourceSnapshots = pgTable('source_snapshots', {
  hash: text('hash').primaryKey(),
  url: text('url').notNull(),
  title: text('title'),
  text: text('text').notNull(),
  fetchedAt: ts('fetched_at').notNull().defaultNow(),
});

// ── Optional accounts (PRD 9.3: only for sync, notifications and community review) ──
export const userSessions = pgTable('user_sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
  expiresAt: ts('expires_at').notNull(),
  revokedAt: ts('revoked_at'),
});

/** Single-use sign-in links. Only a hash of the token and of the email are stored. */
export const magicLinks = pgTable('magic_links', {
  tokenHash: text('token_hash').primaryKey(),
  emailHash: text('email_hash').notNull(),
  lang: text('lang').notNull(),
  createdAt: createdAt(),
  expiresAt: ts('expires_at').notNull(),
  usedAt: ts('used_at'),
});

export const passkeys = pgTable('passkeys', {
  id: text('id').primaryKey(), // credential id (base64url)
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  publicKey: text('public_key').notNull(), // base64url
  counter: integer('counter').notNull().default(0),
  transports: jsonb('transports').$type<string[]>().notNull().default([]),
  createdAt: createdAt(),
  lastUsedAt: ts('last_used_at'),
});

/** Anonymous opt-in micro-survey answers (PRD 10 wellbeing and relevance metrics). No ids of any kind. */
export const surveyResponses = pgTable(
  'survey_responses',
  {
    id: serial('id').primaryKey(),
    question: text('question').$type<'respected' | 'calmer' | 'relevant'>().notNull(),
    answer: text('answer').notNull(),
    lang: text('lang'),
    at: createdAt(),
  },
  (t) => [index('survey_question_idx').on(t.question, t.at)],
);
