import { describe, expect, it } from 'vitest';
import { gatewayModelFor, planRoute } from './routing';
import { appConfigSchema, defaultConfig } from '../config/schema';

const both = { venice: true, gateway: true };
const route = (primary: 'venice' | 'gateway', fallback: boolean, extra: Partial<Parameters<typeof planRoute>[0]> = {}) =>
  planRoute({ routing: { primary, fallback }, model: 'grok-4-7', keys: both, ...extra }).map((s) => `${s.provider}:${s.model}${s.isFallback ? ' (backup)' : ''}`);

describe('vendor routing', () => {
  it('defaults to Venice first with the AI Gateway as backup', () => {
    expect(defaultConfig().routing).toEqual({ primary: 'venice', fallback: true });
    expect(route('venice', true)).toEqual(['venice:grok-4-7', 'gateway:spacexai/grok-4.7 (backup)']);
  });

  it('puts the Gateway first when it is the primary, with Venice as backup', () => {
    expect(route('gateway', true)).toEqual(['gateway:spacexai/grok-4.7', 'venice:grok-4-7 (backup)']);
  });

  it('uses one vendor only when the backup is off', () => {
    expect(route('venice', false)).toEqual(['venice:grok-4-7']);
    expect(route('gateway', false)).toEqual(['gateway:spacexai/grok-4.7']);
  });

  it("keeps the user's own words on Venice whatever the routing says", () => {
    expect(route('gateway', true, { rawUserText: true })).toEqual(['venice:grok-4-7']);
    expect(route('gateway', false, { rawUserText: true })).toEqual(['venice:grok-4-7']);
    expect(route('venice', true, { rawUserText: true, keys: { venice: false, gateway: true } })).toEqual([]);
  });

  it("prefers the slot's own Gateway model over the vendor equivalent", () => {
    expect(route('gateway', false, { gatewayModel: 'spacexai/grok-4.5' })).toEqual(['gateway:spacexai/grok-4.5']);
    expect(gatewayModelFor('deepseek-v4-pro')).toBe('deepseek/deepseek-v4-pro');
  });

  it("finds each Venice model's twin in the Gateway's live list, and never sends an id the Gateway doesn't have", () => {
    // A slice of the real list (Nov 2026).
    const ids = ['spacexai/grok-4.5', 'spacexai/grok-4.7', 'openai/gpt-6.1-sol', 'openai/gpt-6.2-sol', 'deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4-pro', 'moonshotai/kimi-k3', 'zai/glm-5.3-flash', 'zai/glm-5.3', 'alibaba/qwen3.8-27b', 'anthropic/claude-sonnet-5.5'];
    const twin: Record<string, string> = {
      'grok-4-7': 'spacexai/grok-4.7',
      'openai-gpt-62-sol': 'openai/gpt-6.2-sol',
      'deepseek-v4-flash': 'deepseek/deepseek-v4-flash',
      'kimi-k3': 'moonshotai/kimi-k3',
      'z-ai-glm-5-3-flash': 'zai/glm-5.3-flash',
      'qwen-3-8-27b': 'alibaba/qwen3.8-27b',
      'claude-sonnet-5-5': 'anthropic/claude-sonnet-5.5',
    };
    for (const [venice, gateway] of Object.entries(twin)) expect(gatewayModelFor(venice, '', ids)).toBe(gateway);
    // A stale saved choice (Grok used to be "xai/grok-4") is ignored in favour of the twin.
    expect(gatewayModelFor('grok-4-7', 'xai/grok-4', ids)).toBe('spacexai/grok-4.7');
    // No twin and the vendor default isn't listed: no Gateway route at all.
    expect(gatewayModelFor('mistral-small-4', '', ids)).toBeUndefined();
    expect(planRoute({ routing: { primary: 'gateway', fallback: true }, model: 'mistral-small-4', gatewayIds: ids, keys: both })).toEqual([{ provider: 'venice', model: 'mistral-small-4', isFallback: false }]);
  });

  it('serves from Venice when the Gateway cannot (no key or no equivalent model)', () => {
    expect(route('gateway', true, { keys: { venice: true, gateway: false } })).toEqual(['venice:grok-4-7']);
    expect(route('gateway', false, { model: 'venice-uncensored' })).toEqual(['venice:venice-uncensored']);
    expect(route('venice', true, { keys: { venice: true, gateway: false } })).toEqual(['venice:grok-4-7']);
  });

  it('carries the old "use AI Gateway when Venice fails" setting into saved versions', () => {
    const legacy = (fallbackEnabled?: boolean) => {
      const { routing: _r, ...rest } = defaultConfig();
      void _r;
      return appConfigSchema.parse({ ...rest, limits: { ...rest.limits, ...(fallbackEnabled === undefined ? {} : { fallbackEnabled }) } }).routing;
    };
    expect(legacy(false)).toEqual({ primary: 'venice', fallback: false });
    expect(legacy(true)).toEqual({ primary: 'venice', fallback: true });
    expect(legacy()).toEqual({ primary: 'venice', fallback: true });
    expect(appConfigSchema.parse({ ...defaultConfig(), routing: { primary: 'gateway', fallback: false } }).routing).toEqual({ primary: 'gateway', fallback: false });
  });
});
