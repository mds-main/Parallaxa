/**
 * Daily Parallax edition generation (PRD F2, TODO 16.1–16.3). Runs per place at 05:00 local time:
 * discovers candidate contested claims covered by outlets on both sides, analyzes each with the full
 * pipeline, ranks them by published salience rules and sends the edition to human review.
 */
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import * as s from '../db/schema';
import { getActiveConfig } from '../config/store';
import { callModel } from '../ai/provider';
import { parseJson } from '../ai/json';
import { isDemoMode } from '../ai/client';
import { createPendingAnalysis, runAnalysis } from '../pipeline/run';
import { ensureRendering } from '../pipeline/render';
import { todayIn } from '../queries';
import { ENABLED_LANGUAGES } from '../../i18n/languages';
import { raiseAlert } from '../admin/alerts';

type Candidate = { claim: string; outletsLeft: number; outletsRight: number; viral: number; upcomingDecision: boolean };

const CANDIDATE_SCHEMA = {
  name: 'candidates',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['candidates'],
    properties: {
      candidates: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['claim', 'outletsLeft', 'outletsRight', 'viral', 'upcomingDecision'],
          properties: {
            claim: { type: 'string' },
            outletsLeft: { type: 'integer' },
            outletsRight: { type: 'integer' },
            viral: { type: 'number' },
            upcomingDecision: { type: 'boolean' },
          },
        },
      },
    },
  },
};

const DEMO_CANDIDATES: Record<string, string[]> = {
  GLOBAL: ['Global average temperatures in 2026 were the highest on record, according to the WMO.', 'The number of people displaced by conflict worldwide rose again in 2026, according to UNHCR.'],
  ES: ['El paro registrado en España bajó en octubre de 2026 según el Ministerio de Trabajo.', 'El precio medio del alquiler en España subió más de un 10% en el último año.', 'La inmigración irregular por la ruta canaria se redujo en 2026.'],
  US: ['US inflation fell below 3% in 2026 according to the Bureau of Labor Statistics.', 'Violent crime in major US cities declined in 2026.'],
  'ES-MD': ['La Comunidad de Madrid tiene la menor presión fiscal autonómica de España.', 'Las listas de espera quirúrgicas en Madrid aumentaron en 2026.'],
  'ES-AN': ['Andalucía creó más empleo que ninguna otra comunidad en 2026.', 'La sequía redujo las reservas de los embalses andaluces por debajo del 30%.'],
  'ES-CT': ['Cataluña recibió más inversión extranjera que ninguna otra comunidad en 2026.', 'El uso social del catalán entre los jóvenes ha disminuido.'],
};

/** Salience (published rule, TODO 3.6): coverage on both sides, virality, upcoming decisions. */
export function salience(c: Candidate): number {
  const both = Math.min(c.outletsLeft, c.outletsRight);
  const coverage = Math.min(1, (c.outletsLeft + c.outletsRight) / 12);
  const balance = both > 0 ? 0.25 : 0;
  return Math.round((coverage * 0.5 + Math.min(1, c.viral) * 0.25 + (c.upcomingDecision ? 0.15 : 0) + balance * 0.4) * 1000) / 1000;
}

async function discover(placeId: string, placeName: string): Promise<Candidate[]> {
  const { config } = await getActiveConfig();
  if (isDemoMode()) {
    return (DEMO_CANDIDATES[placeId] ?? DEMO_CANDIDATES.GLOBAL!).map((claim, i) => ({ claim, outletsLeft: 4 - i, outletsRight: 3, viral: 0.6 - i * 0.1, upcomingDecision: i === 0 }));
  }
  const res = await callModel({
    step: 'briefing-discover',
    model: config.roles.reader,
    config,
    searches: { web: 1, x: 0, scrape: 0 },
    request: {
      messages: [
        {
          role: 'system',
          content:
            'You select candidate stories for a non-partisan daily briefing. Find today\'s most widely covered contested factual claims about the given place, using outlets from across the political spectrum. Count how many left-leaning and right-leaning outlets cover each. Estimate virality from 0 to 1. Flag claims tied to an upcoming decision (vote, ruling, budget). Return 5–10 neutral, checkable claims. Do not include value judgements.',
        },
        { role: 'user', content: `<place>${placeName} (${placeId})</place>\n<date>${new Date().toISOString().slice(0, 10)}</date>` },
      ],
      veniceParameters: { enable_web_search: 'on', enable_web_citations: true },
      responseSchema: CANDIDATE_SCHEMA,
      temperature: 0.2,
    },
  });
  return parseJson<{ candidates: Candidate[] }>(res.content).candidates.slice(0, 10);
}

export async function generateEdition(placeId: string, opts: { force?: boolean } = {}): Promise<{ editionId: string; stories: number; status: string } | null> {
  const db = await getDb();
  const { config } = await getActiveConfig();
  if (!config.killSwitches.briefing) return null;
  const [place] = await db.select().from(s.places).where(eq(s.places.id, placeId));
  if (!place) throw new Error(`Unknown place ${placeId}`);
  const date = todayIn(place.timezone);
  const [existing] = await db.select().from(s.briefingEditions).where(and(eq(s.briefingEditions.placeId, placeId), eq(s.briefingEditions.date, date)));
  if (existing && !opts.force) return { editionId: existing.id, stories: 0, status: existing.status };
  const [edition] = existing
    ? [existing]
    : await db.insert(s.briefingEditions).values({ placeId, date, status: 'draft' }).returning();

  const candidates = (await discover(placeId, place.names.en ?? placeId)).map((c) => ({ ...c, salience: salience(c) })).sort((a, b) => b.salience - a.salience);
  const quiz = await db.select().from(s.quizItems).where(and(eq(s.quizItems.placeId, placeId.split('-')[0]!), eq(s.quizItems.active, true)));
  let rank = 0;
  for (const c of candidates) {
    const input = { kind: 'text' as const, text: c.claim };
    const pendingId = await createPendingAnalysis(input, 'en');
    // The edition's place answers "which place is this about?" when a candidate claim doesn't say.
    const result = await runAnalysis(pendingId, input, 'en', { place: placeId });
    if (result.status === 'failed') continue;
    const analysisId = result.analysisId;
    const [a] = await db.select().from(s.analyses).where(eq(s.analyses.id, analysisId));
    if (!a?.structured || a.grade === 'not_checkable') continue;
    const headline: Record<string, string> = {};
    for (const l of ENABLED_LANGUAGES) {
      const r = await ensureRendering(analysisId, l.tag).catch(() => null);
      if (r) headline[l.tag] = r.headline;
    }
    const q = quiz[rank % Math.max(1, quiz.length)];
    rank++;
    await db
      .insert(s.editionStories)
      .values({
        editionId: edition!.id,
        analysisId,
        rank,
        topicId: a.structured.topicTags[0]?.id ?? 'culture',
        salience: c.salience,
        headline,
        perceptionFact: q ? Object.fromEntries(Object.entries(q.question).map(([lang, text]) => [lang, `${text} → ${q.trueValue}% (${q.sourceName}, ${q.year})`])) : null,
      })
      .onConflictDoNothing();
    if (rank >= 10) break;
  }
  // Editions are reviewed by people before 07:00 (PRD F2). Demo/preview environments may auto-publish.
  const autoPublish = isDemoMode() || process.env.BRIEFING_AUTO_PUBLISH === '1';
  const status = autoPublish ? 'published' : 'in_review';
  await db.update(s.briefingEditions).set({ status, publishedAt: autoPublish ? new Date() : null }).where(eq(s.briefingEditions.id, edition!.id));
  if (!autoPublish) await db.insert(s.reviewTasks).values({ kind: 'briefing', refId: edition!.id, priority: 1, dueAt: new Date(Date.now() + 2 * 3600_000), notes: `${placeId} ${date}` });
  return { editionId: edition!.id, stories: rank, status };
}

/** Which places are due at this moment: 05:00–05:59 local time and no edition yet today. */
export async function dueEditionPlaces(now = new Date()): Promise<string[]> {
  const db = await getDb();
  const { config } = await getActiveConfig();
  const places = await db.select().from(s.places);
  const due: string[] = [];
  for (const pid of config.content.editionPlaces) {
    const p = places.find((x) => x.id === pid);
    if (!p) continue;
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: p.timezone, hour: '2-digit', hour12: false }).format(now));
    if (hour !== 5) continue;
    const [e] = await db.select().from(s.briefingEditions).where(and(eq(s.briefingEditions.placeId, pid), eq(s.briefingEditions.date, todayIn(p.timezone, now))));
    if (!e) due.push(pid);
  }
  return due;
}

/** Late-briefing check (SLO: ready by 06:45 local on 99% of days). */
export async function checkLateEditions(now = new Date()) {
  const db = await getDb();
  const { config } = await getActiveConfig();
  const places = await db.select().from(s.places);
  for (const pid of config.content.editionPlaces) {
    const p = places.find((x) => x.id === pid);
    if (!p) continue;
    const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: p.timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now).split(':').map(Number) as [number, number];
    if (h * 60 + m < 6 * 60 + 45 || h >= 12) continue;
    const [e] = await db.select().from(s.briefingEditions).where(and(eq(s.briefingEditions.placeId, pid), eq(s.briefingEditions.date, todayIn(p.timezone, now))));
    if (!e || e.status !== 'published') {
      if (e && e.status !== 'late') await db.update(s.briefingEditions).set({ status: 'late' }).where(eq(s.briefingEditions.id, e.id));
      if (config.alerts.onLateBriefing) await raiseAlert('late_briefing', `Briefing edition for ${pid} is not published by 06:45 local time (status: ${e?.status ?? 'missing'}).`, config.alerts.emails);
    }
  }
}
