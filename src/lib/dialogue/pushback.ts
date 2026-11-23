/** "Push back" dialogue (PRD F4, TODO 14): accuracy-first, cited, concedes when the reader is right, Private models only. */
import { callModel } from '../ai/provider';
import { loadPrompt } from '../ai/prompts';
import { getModel } from '../ai/catalog';
import type { AppConfig } from '../config/schema';
import type { StructuredAnalysis } from '../domain/types';
import { detectLanguage } from '../pipeline/ingest';
import { ENABLED_LANGUAGES } from '../../i18n/languages';

export type DialogueMessage = { role: 'user' | 'assistant'; content: string };

export async function pushBackReply(opts: { analysisId: string; structured: StructuredAnalysis; claim: string; messages: DialogueMessage[]; uiLang: string; config: AppConfig }): Promise<string> {
  const { config } = opts;
  const model = await getModel(config.roles.pushBack);
  if (model && model.privacy !== 'private') throw new Error('Push back requires a Private model (user text involved).');
  const lastUser = [...opts.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  // Reply in the language the reader writes in, if supported; otherwise the UI language (PRD F7).
  const detected = detectLanguage(lastUser);
  const replyLang = ENABLED_LANGUAGES.find((l) => l.primary === detected)?.tag ?? opts.uiLang;
  const prompt = loadPrompt('pushback', replyLang);
  const context = {
    claim: opts.claim,
    grade: opts.structured.grade,
    confidence: opts.structured.confidence,
    whatsTrue: opts.structured.whatsTrue,
    whatsMissing: opts.structured.whatsMissing,
    whatsWrong: opts.structured.whatsWrong,
    sources: opts.structured.sources.map((s, i) => ({ n: i + 1, title: s.title, url: s.url, tier: s.tier })),
  };
  const res = await callModel({
    step: `pushback:${replyLang}`,
    model: config.roles.pushBack,
    config,
    analysisId: opts.analysisId,
    rawUserText: true,
    searches: { web: 1, x: 0, scrape: 0 },
    request: {
      messages: [
        { role: 'system', content: `${prompt.text}\n\n<analysis>${JSON.stringify(context)}</analysis>` },
        ...opts.messages.slice(-20).map((m) => ({ role: m.role, content: m.content.slice(0, 1000) })),
      ],
      veniceParameters: { enable_web_search: 'auto', enable_web_citations: true },
      temperature: 0.3,
      maxCompletionTokens: 600,
    },
  });
  return res.content.trim();
}
