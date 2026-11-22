/**
 * Snapshot of part of Venice's text-model catalog (GET /models, 22 Nov 2026), used offline in demo mode
 * and as a fallback when the catalog endpoint is unreachable. The live catalog always wins when available.
 */
import type { CatalogModel } from '../config/models';

const M = (
  id: string, name: string, privacy: 'private' | 'anonymized', ctx: number,
  caps: { fc?: boolean; js?: boolean; xs?: boolean }, inUsd: number, outUsd: number,
): CatalogModel => ({
  id, name, privacy, offline: false, deprecated: false, contextLength: ctx,
  capabilities: { functionCalling: caps.fc ?? true, responseSchema: caps.js ?? true, webSearch: true, xSearch: caps.xs ?? false, reasoningEffortOptions: [] },
  pricing: { inputUsdPerM: inUsd, outputUsdPerM: outUsd },
});

export const DEMO_CATALOG: CatalogModel[] = [
  M('grok-4-7', 'Grok 4.7', 'private', 500_000, { xs: true }, 2.27, 6.8),
  M('grok-4-3', 'Grok 4.3', 'private', 1_000_000, { xs: true }, 1.42, 2.83),
  M('grok-4-20', 'Grok 4.20', 'private', 2_000_000, { xs: true }, 1.42, 2.83),
  M('openai-gpt-62-sol', 'GPT-6.2 Sol', 'anonymized', 1_050_000, {}, 2, 10),
  M('openai-gpt-61-terra', 'GPT-6.1 Terra', 'anonymized', 1_050_000, {}, 1, 5),
  M('openai-gpt-6-luna', 'GPT-6 Luna', 'anonymized', 1_050_000, {}, 0.1, 0.5),
  M('claude-sonnet-5-5', 'Claude Sonnet 5.5', 'anonymized', 1_000_000, {}, 2, 10),
  M('claude-opus-5-5', 'Claude Opus 5.5', 'anonymized', 1_000_000, {}, 4, 20),
  M('claude-haiku-5-5', 'Claude Haiku 5.5', 'anonymized', 1_000_000, {}, 0.1, 0.5),
  M('gemini-4-carbon', 'Gemini 4 Carbon', 'anonymized', 1_000_000, {}, 2.5, 12.5),
  M('gemini-3-8-flash', 'Gemini 3.8 Flash', 'anonymized', 1_000_000, {}, 0.9375, 4.6875),
  M('deepseek-v4-pro', 'DeepSeek V4 Pro', 'private', 1_000_000, {}, 1.65, 3.301),
  M('deepseek-v4-flash', 'DeepSeek V4 Flash', 'private', 1_000_000, {}, 0.138, 0.275),
  M('kimi-k3', 'Kimi K3', 'private', 1_000_000, {}, 3.75, 18.75),
  M('kimi-k3-1-pro', 'Kimi K3.1 Pro', 'private', 1_000_000, {}, 2, 10),
  M('z-ai-glm-5-3', 'GLM 5.3', 'private', 1_000_000, {}, 1.75, 5.5),
  M('z-ai-glm-5-3-flash', 'GLM 5.3 Flash', 'private', 1_048_576, {}, 0.15, 0.5),
  M('qwen-3-8-27b', 'Qwen 3.8 27B', 'private', 262_144, {}, 0.45, 3.2),
  M('qwen-4-max', 'Qwen 4 Max', 'anonymized', 1_000_000, { js: false }, 1.5, 4.5),
  M('mistral-small-3-2-24b-instruct', 'Mistral Small 3.2 24B', 'private', 256_000, {}, 0.09375, 0.25),
  M('llama-3.3-70b', 'Llama 3.3 70B', 'private', 128_000, { js: false }, 0.7, 2.8),
  M('openai-gpt-oss-120b', 'GPT-OSS 120B', 'private', 128_000, { js: false }, 0.07, 0.3),
  M('minimax-m27', 'MiniMax M2.7', 'private', 198_000, { js: false }, 0.375, 1.5),
];
