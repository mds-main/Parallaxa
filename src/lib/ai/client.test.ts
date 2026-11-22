import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiError, chat, classifyStatus } from './client';

// Contract tests for the provider adapters (TODO 10.13): exact request shape and response parsing.
describe('Venice / Gateway client contract', () => {
  const calls: { url: string; body: Record<string, unknown>; headers: Record<string, string> }[] = [];
  beforeEach(() => {
    process.env.VENICE_API_KEY = 'test-venice-key';
    process.env.AI_GATEWAY_API_KEY = 'test-gateway-key';
    calls.length = 0;
  });
  afterEach(() => {
    delete process.env.VENICE_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    vi.unstubAllGlobals();
  });

  function mockFetch(status: number, json: unknown, headers: Record<string, string> = {}) {
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> });
      return new Response(typeof json === 'string' ? json : JSON.stringify(json), { status, headers });
    });
  }

  it('sends venice_parameters with the Venice system prompt forced off, and parses tool calls, citations and cost', async () => {
    mockFetch(200, {
      model: 'grok-4-7',
      choices: [{ message: { content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'submit_verdict', arguments: '{}' } }] }, finish_reason: 'tool_calls' }],
      usage: { prompt_tokens: 1200, completion_tokens: 80 },
      cost: { usd: 0.0123 },
      venice_parameters: { web_search_citations: [{ url: 'https://www.ine.es/x', title: 'INE', content: 'snippet', date: '2026-10-01' }] },
    });
    const res = await chat('venice', {
      model: 'grok-4-7',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ type: 'function', function: { name: 'submit_verdict', description: 'd', parameters: { type: 'object' } } }],
      toolChoice: 'required',
      veniceParameters: { enable_web_search: 'on', enable_web_citations: true, enable_x_search: true, include_venice_system_prompt: true },
      responseSchema: { name: 's', schema: { type: 'object' } },
    });
    const sent = calls[0]!;
    expect(sent.url).toBe('https://api.venice.ai/api/v1/chat/completions');
    expect(sent.headers.Authorization).toBe('Bearer test-venice-key');
    expect(sent.body.venice_parameters).toEqual({ enable_web_search: 'on', enable_web_citations: true, enable_x_search: true, include_venice_system_prompt: false });
    expect(sent.body.tool_choice).toBe('required');
    expect(sent.body.response_format).toEqual({ type: 'json_schema', json_schema: { name: 's', schema: { type: 'object' }, strict: true } });
    expect(res.toolCalls[0]!.function.name).toBe('submit_verdict');
    expect(res.finishReason).toBe('tool_calls');
    expect(res.citations[0]!.url).toBe('https://www.ine.es/x');
    expect(res.costUsd).toBe(0.0123);
    expect(res.usage).toEqual({ promptTokens: 1200, completionTokens: 80 });
  });

  it('never sends venice_parameters to the AI Gateway', async () => {
    mockFetch(200, { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] });
    await chat('gateway', { model: 'xai/grok-4', messages: [{ role: 'user', content: 'hi' }], veniceParameters: { enable_x_search: true } });
    expect(calls[0]!.url).toBe('https://ai-gateway.vercel.sh/v1/chat/completions');
    expect(calls[0]!.headers.Authorization).toBe('Bearer test-gateway-key');
    expect(calls[0]!.body.venice_parameters).toBeUndefined();
  });

  it('classifies errors and keeps Retry-After', async () => {
    mockFetch(429, { error: 'Rate limit exceeded' }, { 'retry-after': '3' });
    await expect(chat('venice', { model: 'm', messages: [{ role: 'user', content: 'x' }] })).rejects.toMatchObject({ errorClass: 'rate_limit', retryAfterMs: 3000 });
    expect(classifyStatus(402, '')).toBe('payment');
    expect(classifyStatus(401, '')).toBe('auth');
    expect(classifyStatus(422, '')).toBe('refusal');
    expect(classifyStatus(503, '')).toBe('server');
    expect(classifyStatus(400, 'Invalid request parameters')).toBe('schema');
  });

  it('reports a content_filter finish as a refusal signal (HTTP 200)', async () => {
    mockFetch(200, { choices: [{ message: { content: '' }, finish_reason: 'content_filter' }] });
    const res = await chat('venice', { model: 'claude-sonnet-5-5', messages: [{ role: 'user', content: 'x' }] });
    expect(res.finishReason).toBe('content_filter');
  });

  it('fails clearly without a key', async () => {
    delete process.env.VENICE_API_KEY;
    await expect(chat('venice', { model: 'm', messages: [] })).rejects.toBeInstanceOf(AiError);
  });
});
