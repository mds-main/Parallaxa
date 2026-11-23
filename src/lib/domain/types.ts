/** Core domain types shared by the pipeline, database and UI (PRD 6.1). */

/** Evidence grades, ordered from most to least supported. `not_checkable` sits outside the scale. */
export const GRADES = [
  'well_supported',
  'mostly_supported',
  'missing_context',
  'mixed',
  'mostly_unsupported',
  'contradicted',
  'not_checkable',
] as const;
export type Grade = (typeof GRADES)[number];

/** Ordinal scale used to combine verdicts (higher = better supported). */
export const GRADE_SCALE: Record<Exclude<Grade, 'not_checkable'>, number> = {
  contradicted: 0,
  mostly_unsupported: 1,
  mixed: 2,
  missing_context: 3,
  mostly_supported: 4,
  well_supported: 5,
};

export const CLAIM_TYPES = ['fact', 'value', 'prediction', 'attribution', 'framing'] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

export const CONFIDENCES = ['high', 'medium', 'low'] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const TECHNIQUES = [
  'cherry_picked_window',
  'base_rate_neglect',
  'misleading_axis',
  'correlation_causation',
  'out_of_context',
  'ai_generated_media',
  'loaded_language',
] as const;
export type Technique = (typeof TECHNIQUES)[number];

/** Perspective slot id, e.g. 'US-R', 'US-L', 'CN', or an extra slot id. */
export type SlotId = string;

export type SourceTier = 1 | 2 | 3 | 4;

export type VerdictSource = {
  url: string;
  title: string;
  tier: SourceTier;
  stance: 'supports' | 'contradicts' | 'context';
  quote?: string;
  quoteVerified?: boolean;
  publishedAt?: string;
  lang?: string;
  /** Where it came from: shared pool, a slot's own search, or X search (always T4). */
  origin?: 'pool' | 'web_search' | 'x_search' | 'scrape' | 'primary_data';
  /** SHA-256 of the archived text snapshot (source_snapshots). */
  contentHash?: string;
};

export type AtomicClaim = {
  id: string;
  /** Neutral, self-contained, PII-free statement (the only user-derived text Anonymized models see). */
  canonical: string;
  /** The same PII-free statement in the input's language (non-English inputs), used to search local sources. */
  localized?: string;
  type: ClaimType;
  checkable: boolean;
};

export type SlotVerdict = {
  slot: SlotId;
  model: string;
  provider: 'venice' | 'gateway' | 'demo';
  grade: Grade | null;
  confidence: Confidence | null;
  abstained: boolean;
  coiExcluded: boolean;
  reasoning: string;
  sources: VerdictSource[];
  toolCalls: number;
  searches: { web: number; x: number; scrape: number };
  costUsd: number;
  latencyMs: number;
  budgetReached?: boolean;
};

export type AggregateResult = {
  grade: Grade;
  confidence: Confidence;
  disagreement: boolean;
  needsHumanReview: boolean;
  counted: SlotId[];
  excluded: { slot: SlotId; reason: 'abstained' | 'coi' | 'not_checkable' }[];
  spread: number;
};

/** Language-neutral analysis (English working notes); prose is rendered per language from it. */
export type StructuredAnalysis = {
  input: { kind: 'text' | 'url' | 'image'; excerpt: string };
  claims: AtomicClaim[];
  mainClaimId: string;
  grade: Grade;
  confidence: Confidence;
  confidenceReason: string;
  whatsTrue: string[];
  whatsMissing: string[];
  whatsWrong: string[];
  /** Only filled when evidence supports it. Either side may be empty (no forced balance). */
  sidesRight: { left: string[]; right: string[] };
  techniques: Technique[];
  sources: VerdictSource[];
  reasoning: string[];
  verdicts: SlotVerdict[];
  aggregate: AggregateResult;
  placeTags: { id: string; confidence: number }[];
  topicTags: { id: string; confidence: number }[];
  staleData: boolean;
  valuesQuestion?: { positions: { label: string; steelman: string }[] };
  /** Why the fact matters across moral foundations, without changing the fact (PRD F4). */
  moralFrames?: { foundation: 'care' | 'fairness' | 'liberty' | 'loyalty' | 'authority'; text: string }[];
  disclosures: {
    demoMode: boolean;
    fallbackProvider: boolean;
    modelsDisagree: boolean;
    staleData: boolean;
    humanReviewed: boolean;
    xSearchUsed: boolean;
  };
};

export type RenderedAnalysis = {
  lang: string;
  headline: string;
  summary: string;
  whatsTrue: string[];
  whatsMissing: string[];
  whatsWrong: string[];
  sidesRight: { left: string[]; right: string[] };
  reasoning: string[];
  confidenceReason: string;
  valuesPositions?: { label: string; steelman: string }[];
  moralFrames?: { foundation: string; text: string }[];
};

/** Live analyses store the mirrored claim for audits; graded mirror pairs are checked in the eval suite. */
export type MirrorTest = {
  mirroredClaim: string;
  originalGrade: Grade;
  mirroredGrade?: Grade;
  parity?: boolean;
  note?: string;
};

export type AnalysisProgress = {
  stage: PipelineStage;
  done: PipelineStage[];
  updatedAt: string;
  /** The pipeline is waiting for the reader (only 'place' today: which place the claim is about). */
  question?: 'place';
};

export type ClaimTags = { places: { id: string; confidence: number }[]; topics: { id: string; confidence: number }[]; placeNeeded?: boolean };

/** Saved while a check waits for the reader: everything needed to continue, without the reader's original text. */
export type PendingCheck = {
  ingested: { kind: 'text' | 'url' | 'image'; excerpt: string; lang: string };
  atomic: AtomicClaim[];
  mainId: string;
  tags: ClaimTags;
  lang: string;
  skipCache: boolean;
  /** Places offered first (the tagger's guesses, then countries of the input language). */
  suggestions: string[];
};

export const PIPELINE_STAGES = [
  'ingest',
  'decompose',
  'tag',
  'retrieve',
  'investigate',
  'aggregate',
  'mirror',
  'compose',
  'render',
  'publish',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];
