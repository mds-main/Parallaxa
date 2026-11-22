import { describe, expect, it } from 'vitest';
import { checkHarnessRequirements, checkLineup, modelVendor, type CatalogModel } from './models';
import { defaultConfig } from './schema';

const base: CatalogModel = {
  id: 'grok-4-7', name: 'Grok', privacy: 'private', offline: false, deprecated: false, contextLength: 500_000,
  capabilities: { functionCalling: true, responseSchema: true, webSearch: true, xSearch: true, reasoningEffortOptions: [] },
  pricing: { inputUsdPerM: 2.27, outputUsdPerM: 6.8 },
};

describe('modelVendor', () => {
  it.each([
    ['grok-4-7', 'xai', 'US'], ['openai-gpt-62-sol', 'openai', 'US'], ['claude-sonnet-5-5', 'anthropic', 'US'],
    ['deepseek-v4-pro', 'deepseek', 'CN'], ['kimi-k3', 'moonshot', 'CN'], ['z-ai-glm-5-3', 'zhipu', 'CN'], ['qwen-3-8-27b', 'alibaba', 'CN'],
  ])('%s → %s/%s', (id, vendor, origin) => {
    expect(modelVendor(id)).toMatchObject({ vendor, origin });
  });
});

describe('checkHarnessRequirements', () => {
  it('accepts a capable model', () => expect(checkHarnessRequirements(base, { allowedPrivacy: ['private'] }).ok).toBe(true));
  it('rejects missing tool calling, schema, offline, small context and wrong privacy', () => {
    const bad = { ...base, privacy: 'anonymized' as const, offline: true, contextLength: 64_000, capabilities: { ...base.capabilities, functionCalling: false, responseSchema: false } };
    const r = checkHarnessRequirements(bad, { allowedPrivacy: ['private'] });
    expect(r.ok).toBe(false);
    expect(r.reasons).toHaveLength(5);
  });
});

describe('checkLineup', () => {
  it('default lineup passes', () => expect(checkLineup(defaultConfig()).ok).toBe(true));
  it('rejects two slots', () => {
    const c = defaultConfig();
    c.slots[2]!.enabled = false;
    expect(checkLineup(c).ok).toBe(false);
  });
  it('rejects a single-origin lineup', () => {
    const c = defaultConfig();
    c.slots[2]!.model = 'claude-sonnet-5-5';
    expect(checkLineup(c).problems.join(' ')).toMatch(/countries/);
  });
});
