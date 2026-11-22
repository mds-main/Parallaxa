/** Model metadata helpers: vendor/origin inference, harness requirements and lineup rules (PRD 9.4). */
import type { AppConfig, PrivacyTier, SlotConfig } from './schema';

export type CatalogModel = {
  id: string;
  name: string;
  privacy: PrivacyTier;
  offline: boolean;
  deprecated: boolean;
  contextLength: number;
  capabilities: {
    functionCalling: boolean;
    responseSchema: boolean;
    webSearch: boolean;
    xSearch: boolean;
    reasoningEffortOptions: string[];
  };
  pricing: { inputUsdPerM: number; outputUsdPerM: number; cacheInputUsdPerM?: number };
};

const VENDORS: { test: RegExp; vendor: string; origin: string; label: string }[] = [
  { test: /^grok/, vendor: 'xai', origin: 'US', label: 'xAI' },
  { test: /^openai-|^gpt-/, vendor: 'openai', origin: 'US', label: 'OpenAI' },
  { test: /^claude/, vendor: 'anthropic', origin: 'US', label: 'Anthropic' },
  { test: /^gemini|^google-|^gemma/, vendor: 'google', origin: 'US', label: 'Google' },
  { test: /^llama|^muse/, vendor: 'meta', origin: 'US', label: 'Meta' },
  { test: /^nvidia/, vendor: 'nvidia', origin: 'US', label: 'NVIDIA' },
  { test: /^deepseek|^e2ee-deepseek/, vendor: 'deepseek', origin: 'CN', label: 'DeepSeek' },
  { test: /^kimi|^e2ee-kimi/, vendor: 'moonshot', origin: 'CN', label: 'Moonshot (Kimi)' },
  { test: /^qwen|^e2ee-qwen/, vendor: 'alibaba', origin: 'CN', label: 'Alibaba (Qwen)' },
  { test: /^z-ai|^zai-org|^glm|^e2ee-glm/, vendor: 'zhipu', origin: 'CN', label: 'Zhipu (GLM)' },
  { test: /^minimax/, vendor: 'minimax', origin: 'CN', label: 'MiniMax' },
  { test: /^xiaomi/, vendor: 'xiaomi', origin: 'CN', label: 'Xiaomi' },
  { test: /^seed/, vendor: 'bytedance', origin: 'CN', label: 'ByteDance' },
  { test: /^hy\d/, vendor: 'tencent', origin: 'CN', label: 'Tencent' },
  { test: /^mistral/, vendor: 'mistral', origin: 'FR', label: 'Mistral' },
  { test: /^aion/, vendor: 'aionlabs', origin: 'IL', label: 'Aion Labs' },
  { test: /^venice/, vendor: 'venice', origin: 'US', label: 'Venice' },
];

export function modelVendor(modelId: string): { vendor: string; origin: string; label: string } {
  const id = modelId.toLowerCase();
  return VENDORS.find((v) => v.test.test(id)) ?? { vendor: 'unknown', origin: '??', label: 'Unknown' };
}

export type HarnessRequirementResult = { ok: boolean; reasons: string[] };

/** A model is selectable for a slot only if the investigation harness can run on it (PRD 9.4). */
export function checkHarnessRequirements(model: CatalogModel | undefined, slot: Pick<SlotConfig, 'allowedPrivacy'>): HarnessRequirementResult {
  if (!model) return { ok: false, reasons: ['Not in the Venice catalog'] };
  const reasons: string[] = [];
  if (!model.capabilities.functionCalling) reasons.push('No tool calling');
  if (!model.capabilities.responseSchema) reasons.push('No structured output (json_schema)');
  if (!model.capabilities.webSearch) reasons.push('No web search');
  if (model.offline) reasons.push('Offline');
  if (model.deprecated) reasons.push('Deprecated');
  if (model.contextLength < 128_000) reasons.push('Context under 128k tokens');
  if (!slot.allowedPrivacy.includes(model.privacy)) reasons.push(`Privacy tier "${model.privacy}" not allowed for this slot`);
  return { ok: reasons.length === 0, reasons };
}

export type LineupCheck = { ok: boolean; problems: string[] };

/** Lineup invariants (PRD 9.4): ≥ 3 enabled slots, ≥ 2 origins, ≥ 3 vendors, no empty slot. */
export function checkLineup(config: Pick<AppConfig, 'slots'>): LineupCheck {
  const enabled = config.slots.filter((s) => s.enabled);
  const problems: string[] = [];
  if (enabled.length < 3) problems.push('At least 3 perspective slots must be enabled.');
  if (enabled.some((s) => !s.model)) problems.push('Every enabled slot needs a model.');
  const origins = new Set(enabled.map((s) => modelVendor(s.model).origin));
  if (origins.size < 2) problems.push('Slots must come from at least 2 countries of origin.');
  const vendors = new Set(enabled.map((s) => modelVendor(s.model).vendor));
  if (vendors.size < Math.min(3, enabled.length)) problems.push('Slots must come from at least 3 different vendors.');
  const ids = new Set(config.slots.map((s) => s.id));
  if (ids.size !== config.slots.length) problems.push('Slot ids must be unique.');
  return { ok: problems.length === 0, problems };
}

/** Rough per-investigation cost estimate used by the admin impact preview. */
export function estimateInvestigationCost(model: CatalogModel | undefined, harness: SlotConfig['harness']): number {
  if (!model) return 0;
  const inTok = 40_000;
  const outTok = 4_000;
  const tokens = (inTok / 1e6) * model.pricing.inputUsdPerM + (outTok / 1e6) * model.pricing.outputUsdPerM;
  const searches = Math.min(harness.maxWebSearches, 3) * 0.01 + (model.capabilities.xSearch && harness.xSearch ? Math.min(harness.maxXSearches, 2) * 0.01 : 0);
  return Math.round((tokens + searches) * 1000) / 1000;
}
