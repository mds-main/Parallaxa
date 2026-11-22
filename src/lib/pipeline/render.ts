/**
 * Stage 8b, native rendering per language from the language-neutral analysis, plus the
 * cross-language consistency check (PRD F1 stage 8, F7; TODO 12.11–12.12).
 */
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { analyses, analysisRenderings, claims, reviewTasks } from '../db/schema';
import { callModel } from '../ai/provider';
import { loadPrompt } from '../ai/prompts';
import { CONSISTENCY_SCHEMA, RENDER_SCHEMA, parseJson } from '../ai/json';
import { getActiveConfig } from '../config/store';
import { assertKnownLanguage } from '../../i18n/languages';
import { latamTerms } from '../i18n-lexicon';
import type { RenderedAnalysis, StructuredAnalysis } from '../domain/types';
import type { AppConfig } from '../config/schema';

function payload(structured: StructuredAnalysis, claimText: string) {
  return {
    claim: claimText,
    grade: structured.grade,
    confidence: structured.confidence,
    whatsTrue: structured.whatsTrue,
    whatsMissing: structured.whatsMissing,
    whatsWrong: structured.whatsWrong,
    sidesRight: structured.sidesRight,
    reasoning: structured.reasoning,
    confidenceReason: structured.confidenceReason,
    valuesPositions: structured.valuesQuestion?.positions,
    moralFrames: structured.moralFrames,
    sources: structured.sources.map((s, i) => ({ n: i + 1, title: s.title })),
  };
}

export async function renderAnalysis(structured: StructuredAnalysis, claimText: string, lang: string, config: AppConfig, analysisId?: string): Promise<{ body: RenderedAnalysis; consistency: { ok: boolean; notes?: string }; model: string; promptHash: string }> {
  assertKnownLanguage(lang);
  const prompt = loadPrompt('render', lang);
  const input = JSON.stringify(payload(structured, claimText));
  let lastNotes: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await callModel({
      step: `render:${lang}`,
      model: config.roles.renderer,
      config,
      analysisId,
      request: {
        messages: [
          { role: 'system', content: prompt.text },
          { role: 'user', content: `<analysis>${input}</analysis>${lastNotes ? `\nA checker found differences in your previous attempt: ${lastNotes}. Fix them.` : ''}` },
        ],
        responseSchema: RENDER_SCHEMA,
        temperature: 0.2,
      },
    });
    const body = { ...parseJson<Omit<RenderedAnalysis, 'lang'>>(res.content), lang };
    const check = await callModel({
      step: 'consistency',
      model: config.roles.checker,
      config,
      analysisId,
      request: {
        messages: [
          { role: 'system', content: loadPrompt('consistency').text },
          { role: 'user', content: `<source>${input}</source>\n<rewrite>${JSON.stringify(body)}</rewrite>` },
        ],
        responseSchema: CONSISTENCY_SCHEMA,
        temperature: 0,
      },
    });
    const consistency = parseJson<{ ok: boolean; notes?: string }>(check.content);
    if (lang === 'es-ES') {
      const hits = latamTerms(JSON.stringify(body));
      if (hits.length) {
        consistency.ok = false;
        consistency.notes = `${consistency.notes ? `${consistency.notes}; ` : ''}Use Spain Spanish only (found: ${hits.join(', ')})`;
      }
    }
    if (consistency.ok || attempt === 1) return { body, consistency, model: config.roles.renderer, promptHash: prompt.hash };
    lastNotes = consistency.notes;
  }
  throw new Error('unreachable');
}

/** Returns the rendering for (analysis, version, lang), creating it on first request (PRD F7). */
export async function ensureRendering(analysisId: string, lang: string): Promise<RenderedAnalysis | null> {
  const db = await getDb();
  const [a] = await db.select().from(analyses).where(eq(analyses.id, analysisId));
  if (!a?.structured) return null;
  const [existing] = await db
    .select()
    .from(analysisRenderings)
    .where(and(eq(analysisRenderings.analysisId, analysisId), eq(analysisRenderings.version, a.version), eq(analysisRenderings.lang, lang)));
  if (existing) return existing.body;
  const [claim] = a.claimId ? await db.select().from(claims).where(eq(claims.id, a.claimId)) : [];
  const { config } = await getActiveConfig();
  const r = await renderAnalysis(a.structured, claim?.canonicalText ?? a.structured.input.excerpt, lang, config, analysisId);
  await db
    .insert(analysisRenderings)
    .values({ analysisId, version: a.version, lang, body: r.body, model: r.model, promptVersion: r.promptHash, consistencyCheck: r.consistency })
    .onConflictDoNothing();
  if (!r.consistency.ok) {
    await db.insert(reviewTasks).values({ kind: 'consistency', refId: `${analysisId}:${lang}`, priority: 2, notes: r.consistency.notes ?? null });
  }
  return r.body;
}
