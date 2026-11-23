import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultConfig } from '../config/schema';

vi.mock('../db/client', () => ({ getDb: async () => ({ insert: () => ({ values: async () => undefined }) }) }));
vi.mock('./catalog', () => ({ getModel: async () => undefined }));

const { callModel } = await import('./provider');

// End-to-end routing through callModel with the network stubbed: which vendor is called, in which order.
describe('callModel vendor routing', () => {
  const hits: string[] = [];
  let failVendor: 'venice' | 'gateway' | null = null;

  beforeEach(() => {
    process.env.VENICE_API_KEY = 'test-venice-key';
    process.env.AI_GATEWAY_API_KEY = 'test-gateway-key';
    hits.length = 0;
    failVendor = null;
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      const vendor = url.includes('venice.ai') ? 'venice' : 'gateway';
      const body = JSON.parse(String(init.body)) as { model: string; venice_parameters?: unknown };
      hits.push(`${vendor}:${body.model}${body.venice_parameters ? ' +venice_parameters' : ''}`);
      if (vendor === failVendor) return new Response('upstream down', { status: 503 });
      return new Response(JSON.stringify({ model: body.model, choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 200 });
    });
  });
  afterEach(() => {
    delete process.env.VENICE_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    vi.unstubAllGlobals();
  });

  const config = (primary: 'venice' | 'gateway', fallback = true) => ({ ...defaultConfig(), routing: { primary, fallback } });
  const request = { messages: [{ role: 'user' as const, content: 'hi' }], veniceParameters: { enable_web_search: 'on' as const } };

  it('serves from the Gateway when it is the primary, without Venice-only parameters', async () => {
    const r = await callModel({ step: 'tag', model: 'deepseek-v4-flash', config: config('gateway'), request });
    expect(r.provider).toBe('gateway');
    expect(r.usedFallback).toBe(false);
    expect(hits).toEqual(['gateway:deepseek/deepseek-v4-pro']);
  });

  it('falls back to Venice when the Gateway primary fails', async () => {
    failVendor = 'gateway';
    const r = await callModel({ step: 'tag', model: 'kimi-k3', config: config('gateway'), request });
    expect(r.provider).toBe('venice');
    expect(r.usedFallback).toBe(true);
    expect(hits).toEqual(['gateway:moonshotai/kimi-k3', 'gateway:moonshotai/kimi-k3', 'venice:kimi-k3 +venice_parameters']);
  });

  it('does not fall back when the backup is off', async () => {
    failVendor = 'venice';
    await expect(callModel({ step: 'tag', model: 'z-ai-glm-5-3-flash', config: config('venice', false), request })).rejects.toThrow(/503/);
    expect(hits.every((h) => h.startsWith('venice:'))).toBe(true);
  });

  it("never sends the user's own words to the Gateway, even when Venice is down", async () => {
    failVendor = 'venice';
    await expect(callModel({ step: 'canonicalize', model: 'deepseek-v4-pro', config: config('gateway'), rawUserText: true, request })).rejects.toThrow();
    expect(hits.some((h) => h.startsWith('gateway:'))).toBe(false);
  });
});
