/** Stage 1, ingest and normalize (PRD F1). */
import { createHash } from 'node:crypto';
import { safeFetch } from '../security/safe-fetch';
import { callModel } from '../ai/provider';
import { loadPrompt } from '../ai/prompts';
import type { AppConfig } from '../config/schema';

export type CheckInput = { kind: 'text'; text: string } | { kind: 'url'; url: string } | { kind: 'image'; dataUrl: string };

export type Ingested = { kind: CheckInput['kind']; text: string; excerpt: string; sourceUrl?: string; lang: string };

export function detectLanguage(text: string): string {
  const t = ` ${text.toLowerCase()} `;
  const es = (t.match(/ (el|la|los|las|de|que|y|en|un|una|por|con|para|es|son|del|al|más|según) /g) ?? []).length + (/[ñ¿¡áéíóú]/.test(t) ? 3 : 0);
  const en = (t.match(/ (the|of|and|to|in|is|are|that|for|with|on|was|were|has|have|by) /g) ?? []).length;
  if (es === 0 && en === 0) return 'und';
  return es > en ? 'es' : 'en';
}

export function normalizeText(text: string): string {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function textHash(text: string): string {
  return createHash('sha256').update(normalizeText(text).toLowerCase()).digest('hex');
}

export async function ingest(input: CheckInput, config: AppConfig, analysisId: string): Promise<Ingested> {
  if (input.kind === 'text') {
    const text = normalizeText(input.text).slice(0, 8000);
    return { kind: 'text', text, excerpt: text.slice(0, 400), lang: detectLanguage(text) };
  }
  if (input.kind === 'url') {
    const page = await safeFetch(input.url);
    const text = normalizeText(`${page.title}. ${page.text}`).slice(0, 8000);
    return { kind: 'url', text, excerpt: page.title || text.slice(0, 200), sourceUrl: page.url, lang: detectLanguage(text) };
  }
  const prompt = loadPrompt('ocr');
  const res = await callModel({
    step: 'ocr',
    model: config.roles.vision,
    config,
    analysisId,
    rawUserText: true,
    request: { messages: [{ role: 'system', content: prompt.text }, { role: 'user', content: [{ type: 'image_url', image_url: { url: input.dataUrl } }] }] },
  });
  const text = normalizeText(res.content).slice(0, 8000);
  return { kind: 'image', text, excerpt: text.slice(0, 400), lang: detectLanguage(text) };
}
