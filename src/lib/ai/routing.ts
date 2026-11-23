/**
 * Vendor routing (Admin › Models › AI vendors): which provider serves a model call first, and whether
 * the other one is tried when it fails. Pure and client-safe, so the admin console previews exactly
 * what the server will do.
 */
import { modelVendor } from '../config/models';
import type { ProviderId, RoutingConfig } from '../config/schema';

/**
 * Per-vendor default on the AI Gateway, used only when the Gateway has no twin of the exact Venice model.
 * Checked against the Gateway's live model list (Nov 2026: xAI models are listed as "spacexai/…").
 */
export const GATEWAY_EQUIVALENTS: Record<string, string> = {
  xai: 'spacexai/grok-4.7',
  openai: 'openai/gpt-6.2-sol',
  anthropic: 'anthropic/claude-sonnet-5.5',
  google: 'google/gemini-2.5-pro',
  deepseek: 'deepseek/deepseek-v4-pro',
  moonshot: 'moonshotai/kimi-k3',
  alibaba: 'alibaba/qwen3.8-max',
  zhipu: 'zai/glm-5.3',
  mistral: 'mistral/mistral-large-4',
  meta: 'meta/llama-4-maverick',
};

/** Gateway owner prefixes for each vendor family (modelVendor ids). */
const GATEWAY_OWNERS: Record<string, string[]> = {
  xai: ['spacexai', 'xai'],
  openai: ['openai'],
  anthropic: ['anthropic'],
  google: ['google'],
  meta: ['meta'],
  nvidia: ['nvidia'],
  deepseek: ['deepseek'],
  moonshot: ['moonshotai'],
  alibaba: ['alibaba'],
  zhipu: ['zai'],
  minimax: ['minimax'],
  xiaomi: ['xiaomi'],
  bytedance: ['bytedance'],
  mistral: ['mistral'],
};

/** "grok-4-7" and "spacexai/grok-4.7", or "openai-gpt-62-sol" and "openai/gpt-6.2-sol", share a key. */
const modelKey = (id: string) =>
  id.split('/').pop()!.toLowerCase().replace(/^(e2ee-|openai-|z-ai-|zai-org-|google-)/, '').replace(/[^a-z0-9]/g, '');

/** The Gateway's own listing of the same model, if it has one. */
export function matchGatewayModel(veniceModel: string, gatewayIds: readonly string[]): string | undefined {
  const owners = GATEWAY_OWNERS[modelVendor(veniceModel).vendor];
  if (!owners) return undefined;
  const key = modelKey(veniceModel);
  return gatewayIds.find((id) => owners.includes(id.split('/')[0]!) && modelKey(id) === key);
}

/**
 * The AI Gateway model that stands in for a Venice model. With the Gateway's model list (`gatewayIds`):
 * the slot's own choice if it exists there, else the same model, else the vendor default if it exists.
 * Without the list (offline, tests): the slot's choice, else the vendor default.
 */
export function gatewayModelFor(veniceModel: string, override?: string, gatewayIds?: readonly string[] | null): string | undefined {
  const exists = (id: string) => !gatewayIds || gatewayIds.includes(id);
  const own = override?.trim();
  if (own && exists(own)) return own;
  const twin = gatewayIds ? matchGatewayModel(veniceModel, gatewayIds) : undefined;
  if (twin) return twin;
  const fallback = GATEWAY_EQUIVALENTS[modelVendor(veniceModel).vendor];
  return fallback && exists(fallback) ? fallback : undefined;
}

export type RouteStep = { provider: ProviderId; model: string; isFallback: boolean };

export type RouteInput = {
  routing: RoutingConfig;
  /** Venice model id (the id stored in slots and roles). */
  model: string;
  gatewayModel?: string;
  /** The Gateway's current model ids, when known; unknown ids are never sent. */
  gatewayIds?: readonly string[] | null;
  /** The request carries the user's own words: Private (Venice) models only, whatever the routing says. */
  rawUserText?: boolean;
  keys: { venice: boolean; gateway: boolean };
};

/**
 * The ordered list of attempts for one call. Never empty when Venice has a key.
 * - Raw user text stays on Venice (PRD privacy rule: it only reaches Private models).
 * - A provider without a key, or a Venice model with no Gateway equivalent, is skipped.
 */
export function planRoute(input: RouteInput): RouteStep[] {
  const venice = input.keys.venice ? { provider: 'venice' as const, model: input.model } : null;
  if (input.rawUserText) return venice ? [{ ...venice, isFallback: false }] : [];
  const gwModel = gatewayModelFor(input.model, input.gatewayModel, input.gatewayIds);
  const gateway = input.keys.gateway && gwModel ? { provider: 'gateway' as const, model: gwModel } : null;
  const ordered = input.routing.primary === 'gateway' ? [gateway, venice] : [venice, gateway];
  const [first, second] = ordered;
  const steps: RouteStep[] = [];
  if (first) steps.push({ ...first, isFallback: false });
  // The primary can't serve this call (no key or no equivalent model): the other vendor serves it as primary.
  if (!first && second) steps.push({ ...second, isFallback: false });
  else if (first && second && input.routing.fallback) steps.push({ ...second, isFallback: true });
  return steps;
}

export const PROVIDER_NAMES: Record<ProviderId, string> = { venice: 'Venice', gateway: 'Vercel AI Gateway' };
