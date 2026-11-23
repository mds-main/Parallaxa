/**
 * Application configuration: everything the operator can change in the admin console (PRD F8).
 * Versioned in Postgres (config_versions), published to Edge Config, read by the pipeline.
 */
import { z } from 'zod';

export const PRIVACY_TIERS = ['private', 'anonymized'] as const;
export type PrivacyTier = (typeof PRIVACY_TIERS)[number];

const localized = z.record(z.string(), z.string());

export const harnessSchema = z.object({
  webSearch: z.enum(['off', 'auto', 'on']).default('on'),
  scraping: z.boolean().default(true),
  citations: z.boolean().default(true),
  /** Only applied when the model reports supportsXSearch (Grok). */
  xSearch: z.boolean().default(true),
  reasoningEffort: z.string().optional(),
  maxToolCalls: z.number().int().min(1).max(40).default(12),
  maxWebSearches: z.number().int().min(0).max(20).default(4),
  maxXSearches: z.number().int().min(0).max(20).default(3),
  maxScrapes: z.number().int().min(0).max(20).default(5),
  timeLimitSec: z.number().int().min(20).max(600).default(90),
  costCapUsd: z.number().min(0.01).max(10).default(0.4),
  temperature: z.number().min(0).max(2).optional(),
});
export type HarnessSettings = z.infer<typeof harnessSchema>;

export const slotSchema = z.object({
  id: z.string().regex(/^[A-Z0-9-]{1,8}$/),
  label: localized,
  perceivedLeaning: z.enum(['right', 'left', 'none']),
  origin: z.string().length(2),
  model: z.string().min(1),
  allowedPrivacy: z.array(z.enum(PRIVACY_TIERS)).min(1),
  enabled: z.boolean().default(true),
  harness: harnessSchema,
  /** Keywords that mark conflict-of-interest topics for this model family. */
  coiTopics: z.array(z.string()).default([]),
  /** AI Gateway model for this slot. Empty = automatic: the Gateway's twin of `model`, else the vendor default. */
  fallbackModel: z.string().default(''),
  /** Candidate running in shadow mode next to this slot (results stored, never published). */
  shadowModel: z.string().optional(),
  shadowRemaining: z.number().int().min(0).optional(),
});
export type SlotConfig = z.infer<typeof slotSchema>;

export const rolesSchema = z.object({
  canonicalize: z.string(),
  decompose: z.string(),
  tag: z.string(),
  reader: z.string(),
  renderer: z.string(),
  checker: z.string(),
  pushBack: z.string(),
  embedding: z.string(),
  /** Vision-capable Private model that transcribes text from screenshots. */
  vision: z.string().default('qwen-3-8-27b'),
  /** 'rotate' cycles the writer among enabled perspective slots. */
  writer: z.string().default('rotate'),
  /**
   * Private Venice model that takes over a supporting step (splitting claims, tagging, planning research,
   * checking translations, push back) when the step's own model fails or times out.
   */
  backup: z.string().default('z-ai-glm-5-3-flash'),
});
export type RolesConfig = z.infer<typeof rolesSchema>;

export const pipelineSchema = z.object({
  cacheSimilarity: z.number().min(0.8).max(0.99).default(0.92),
  minSources: z.number().int().min(1).max(5).default(2),
  staleDataMonths: z.number().int().min(1).max(60).default(12),
  aggregationRule: z.enum(['median', 'majority', 'unanimous']).default('median'),
  disagreementSteps: z.number().int().min(1).max(5).default(2),
  humanReviewOnDisagreement: z.boolean().default(true),
  humanReviewSampleRate: z.number().min(0).max(0.2).default(0.02),
  mirrorTestEnabled: z.boolean().default(true),
  maxClaimsPerCheck: z.number().int().min(1).max(10).default(5),
  promptVersion: z.string().default('v1'),
});

export const limitsSchema = z.object({
  dailySpendCeilingUsd: z.number().min(1).max(100_000).default(150),
  spendAlertPercent: z.number().int().min(10).max(100).default(80),
  checksPerHourAnonymous: z.number().int().min(1).max(500).default(20),
  checksPerHourSignedIn: z.number().int().min(1).max(1000).default(60),
  dialogueMaxTurns: z.number().int().min(1).max(30).default(10),
  breakerFailures: z.number().int().min(1).max(50).default(5),
  breakerWindowSec: z.number().int().min(10).max(600).default(60),
  breakerLatencyMultiplier: z.number().min(1.5).max(10).default(3),
  breakerProbeSec: z.number().int().min(5).max(300).default(30),
  timeoutFirstTokenSec: z.number().int().min(2).max(60).default(8),
  timeoutStepSec: z.number().int().min(10).max(300).default(45),
});

/** AI vendors. Venice is the default primary; Vercel AI Gateway the default backup. Switchable in Admin › Models. */
export const PROVIDERS = ['venice', 'gateway'] as const;
export type ProviderId = (typeof PROVIDERS)[number];

export const routingSchema = z.object({
  /** Vendor tried first for every model call. */
  primary: z.enum(PROVIDERS).default('venice'),
  /** Try the other vendor when the primary fails. Calls that carry the user's own words never leave Venice. */
  fallback: z.boolean().default(true),
});
export type RoutingConfig = z.infer<typeof routingSchema>;

/**
 * Search engines for investigations (Admin › Investigation › Search engines). Tried in order: the primary,
 * then each backup, skipping engines without a key. `combine` queries the first two together and merges them.
 */
export const SEARCH_ENGINES = ['exa', 'brave', 'venice-exa', 'venice-brave'] as const;
export type SearchEngineId = (typeof SEARCH_ENGINES)[number];

export const searchSchema = z.object({
  primary: z.enum(SEARCH_ENGINES).default('exa'),
  fallbacks: z.array(z.enum(SEARCH_ENGINES)).max(3).default(['brave', 'venice-exa', 'venice-brave']),
  /** Query the first two available engines together and merge their results: more varied sources, about twice the search cost. */
  combine: z.boolean().default(false),
  /** Research before the perspective models start: standard = 4 planned searches and 4 pages read; deep = 6 and 8. */
  depth: z.enum(['standard', 'deep']).default('deep'),
});
export type SearchConfig = z.infer<typeof searchSchema>;

export const killSwitchesSchema = z.object({
  check: z.boolean().default(true),
  pushBack: z.boolean().default(true),
  briefing: z.boolean().default(true),
  ledger: z.boolean().default(true),
  quiz: z.boolean().default(true),
});

export const contentSchema = z.object({
  languages: z.record(z.string(), z.boolean()).default({}),
  editionPlaces: z.array(z.string()).default(['GLOBAL', 'ES', 'US', 'ES-MD', 'ES-AN', 'ES-CT']),
  briefingStories: z.number().int().min(3).max(5).default(5),
  outsideFiltersDefault: z.boolean().default(true),
  notificationsRoutinePerDay: z.number().int().min(0).max(3).default(1),
  followUpsPerDay: z.number().int().min(0).max(10).default(3),
  quizCountries: z.array(z.string()).default(['ES', 'US']),
  maintenanceBanner: localized.default({}),
});

export const alertsSchema = z.object({
  sloP95Seconds: z.number().int().min(5).max(120).default(20),
  errorRatePercent: z.number().min(1).max(50).default(5),
  onFallback: z.boolean().default(true),
  onEvalRegression: z.boolean().default(true),
  onLateBriefing: z.boolean().default(true),
  onLoginLockout: z.boolean().default(true),
});

/**
 * Fills sections added after a version was saved: `routing` (carrying over the old `limits.fallbackEnabled`)
 * and `search` (defaults).
 */
function migrateLegacy(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const out: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  if (!('routing' in out)) {
    const legacy = (out as { limits?: { fallbackEnabled?: unknown } }).limits?.fallbackEnabled;
    out.routing = { primary: 'venice', fallback: legacy !== false };
  }
  if (!('search' in out)) out.search = {};
  return out;
}

export const appConfigSchema = z.preprocess(
  migrateLegacy,
  z.object({
    slots: z.array(slotSchema).min(1).max(5),
    roles: rolesSchema,
    routing: routingSchema,
    search: searchSchema,
    pipeline: pipelineSchema,
    limits: limitsSchema,
    killSwitches: killSwitchesSchema,
    content: contentSchema,
    alerts: alertsSchema,
  }),
);
export type AppConfig = z.infer<typeof appConfigSchema>;

const COI = {
  xai: ['xAI', 'Grok', 'X Corp', 'Twitter', 'Tesla', 'SpaceX', 'Neuralink', 'Elon Musk'],
  openai: ['OpenAI', 'ChatGPT', 'Microsoft', 'Sam Altman'],
  china: ['China', 'CCP', 'Chinese Communist Party', 'Xi Jinping', 'Taiwan', 'Tibet', 'Xinjiang', 'Uyghur', 'Hong Kong', 'Tiananmen', 'DeepSeek'],
};

/** Default configuration (PRD 9.4). Model IDs are a snapshot of Venice's Nov 2026 catalog. */
export function defaultConfig(): AppConfig {
  return appConfigSchema.parse({
    slots: [
      {
        id: 'US-R',
        label: { en: 'US model, perceived as right-leaning', 'es-ES': 'Modelo de EE. UU., percibido como de derechas' },
        perceivedLeaning: 'right',
        origin: 'US',
        model: 'grok-4-7',
        allowedPrivacy: ['private', 'anonymized'],
        harness: {},
        coiTopics: COI.xai,
      },
      {
        id: 'US-L',
        label: { en: 'US model, perceived as left-leaning', 'es-ES': 'Modelo de EE. UU., percibido como de izquierdas' },
        perceivedLeaning: 'left',
        origin: 'US',
        model: 'openai-gpt-62-sol',
        allowedPrivacy: ['private', 'anonymized'],
        harness: { xSearch: false },
        coiTopics: COI.openai,
      },
      {
        id: 'CN',
        label: { en: 'Chinese model', 'es-ES': 'Modelo chino' },
        perceivedLeaning: 'none',
        origin: 'CN',
        model: 'deepseek-v4-pro',
        allowedPrivacy: ['private', 'anonymized'],
        harness: { xSearch: false },
        coiTopics: COI.china,
      },
    ],
    roles: {
      canonicalize: 'deepseek-v4-flash',
      decompose: 'deepseek-v4-flash',
      tag: 'z-ai-glm-5-3-flash',
      reader: 'z-ai-glm-5-3-flash',
      renderer: 'z-ai-glm-5-3',
      checker: 'deepseek-v4-flash',
      pushBack: 'kimi-k3',
      embedding: 'text-embedding-bge-m3',
      vision: 'qwen-3-8-27b',
      writer: 'rotate',
      backup: 'z-ai-glm-5-3-flash',
    },
    routing: {},
    search: {},
    pipeline: {},
    limits: {},
    killSwitches: {},
    content: {},
    alerts: {},
  });
}
