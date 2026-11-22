/**
 * Thin OpenAI-compatible chat client for Venice (primary) and Vercel AI Gateway (fallback).
 * A direct fetch client (instead of an SDK) lets us pass `venice_parameters` exactly as documented:
 * web search, scraping, citations, X search and include_venice_system_prompt=false (PRD 9.4).
 */
export type Provider = 'venice' | 'gateway';

export type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string | ContentPart[]; tool_calls?: ToolCall[]; reasoning_details?: unknown }
  | { role: 'tool'; content: string; tool_call_id: string };

export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export type ToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } };

export type ToolDefinition = {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown>; strict?: boolean };
};

export type VeniceParameters = {
  enable_web_search?: 'off' | 'auto' | 'on';
  enable_web_scraping?: boolean;
  enable_web_citations?: boolean;
  return_search_results_as_documents?: boolean;
  enable_x_search?: boolean;
  include_venice_system_prompt?: boolean;
  strip_thinking_response?: boolean;
};

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'required' | 'none';
  responseSchema?: { name: string; schema: Record<string, unknown> };
  temperature?: number;
  reasoningEffort?: string;
  maxCompletionTokens?: number;
  veniceParameters?: VeniceParameters;
  timeoutMs?: number;
};

export type WebCitation = { url: string; title?: string; content?: string; date?: string };

export type ChatResponse = {
  provider: Provider;
  model: string;
  content: string;
  toolCalls: ToolCall[];
  reasoningDetails?: unknown;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | string;
  usage: { promptTokens: number; completionTokens: number };
  costUsd: number | null;
  citations: WebCitation[];
  latencyMs: number;
};

export type AiErrorClass = 'rate_limit' | 'server' | 'timeout' | 'schema' | 'auth' | 'payment' | 'refusal' | 'not_found' | 'forbidden' | 'unknown';

export class AiError extends Error {
  constructor(
    message: string,
    readonly errorClass: AiErrorClass,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

const ENDPOINTS: Record<Provider, string> = {
  venice: 'https://api.venice.ai/api/v1/chat/completions',
  gateway: 'https://ai-gateway.vercel.sh/v1/chat/completions',
};

export function providerKey(provider: Provider): string | undefined {
  return provider === 'venice' ? process.env.VENICE_API_KEY : process.env.AI_GATEWAY_API_KEY;
}

export function classifyStatus(status: number, body: string): AiErrorClass {
  if (status === 429) return 'rate_limit';
  if (status === 401) return 'auth';
  if (status === 402) return 'payment';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 422) return 'refusal';
  if (status === 400) return /context|token|schema|Invalid request/i.test(body) ? 'schema' : 'schema';
  if (status >= 500) return 'server';
  return 'unknown';
}

export async function chat(provider: Provider, req: ChatRequest): Promise<ChatResponse> {
  const key = providerKey(provider);
  if (!key) throw new AiError(`${provider} API key missing`, 'auth');
  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
  };
  if (req.tools?.length) {
    body.tools = req.tools;
    body.tool_choice = req.toolChoice ?? 'auto';
  }
  if (req.responseSchema) {
    body.response_format = { type: 'json_schema', json_schema: { name: req.responseSchema.name, schema: req.responseSchema.schema, strict: true } };
  }
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.reasoningEffort) body.reasoning_effort = req.reasoningEffort;
  if (req.maxCompletionTokens) body.max_completion_tokens = req.maxCompletionTokens;
  if (provider === 'venice') {
    // Only Parallaxa's published prompts apply (PRD 9.4).
    body.venice_parameters = { ...req.veniceParameters, include_venice_system_prompt: false };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 45_000);
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(ENDPOINTS[provider], {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if ((e as Error).name === 'AbortError') throw new AiError('Request timed out', 'timeout');
    throw new AiError((e as Error).message, 'server');
  }
  clearTimeout(timer);
  const text = await res.text();
  if (!res.ok) {
    const retryAfter = Number(res.headers.get('retry-after'));
    throw new AiError(`${provider} ${res.status}: ${text.slice(0, 300)}`, classifyStatus(res.status, text), res.status, Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined);
  }
  const json = JSON.parse(text) as {
    model?: string;
    choices?: { message?: { content?: string | null; tool_calls?: ToolCall[]; reasoning_details?: unknown }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    cost?: { usd?: number };
    venice_parameters?: { web_search_citations?: WebCitation[] };
  };
  const choice = json.choices?.[0];
  return {
    provider,
    model: json.model ?? req.model,
    content: choice?.message?.content ?? '',
    toolCalls: choice?.message?.tool_calls ?? [],
    reasoningDetails: choice?.message?.reasoning_details,
    finishReason: choice?.finish_reason ?? 'stop',
    usage: { promptTokens: json.usage?.prompt_tokens ?? 0, completionTokens: json.usage?.completion_tokens ?? 0 },
    costUsd: typeof json.cost?.usd === 'number' ? json.cost.usd : null,
    citations: json.venice_parameters?.web_search_citations ?? [],
    latencyMs: Date.now() - started,
  };
}

/** Embeddings (Venice `text-embedding-bge-m3`, 1024 dims). */
export async function embed(model: string, input: string): Promise<number[]> {
  const key = providerKey('venice');
  if (!key) throw new AiError('venice API key missing', 'auth');
  const res = await fetch('https://api.venice.ai/api/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input, encoding_format: 'float' }),
  });
  const text = await res.text();
  if (!res.ok) throw new AiError(`embeddings ${res.status}: ${text.slice(0, 200)}`, classifyStatus(res.status, text), res.status);
  return (JSON.parse(text) as { data: { embedding: number[] }[] }).data[0]!.embedding;
}

export function isDemoMode(): boolean {
  return !process.env.VENICE_API_KEY;
}
