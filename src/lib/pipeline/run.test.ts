import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createPendingAnalysis, runAnalysis } from './run';
import { ensureRendering } from './render';
import { getDb } from '../db/client';
import * as s from '../db/schema';

describe('pipeline (demo mode)', () => {
  it('runs end to end, stores per-slot verdicts, tags and a rendering', async () => {
    const input = { kind: 'text' as const, text: 'Unemployment in Spain fell to 10.5% in 2026 according to the government. Contact me at test@example.com.' };
    const id = await createPendingAnalysis(input, 'en');
    const r = await runAnalysis(id, input, 'en');
    expect(['published', 'review']).toContain(r.status);
    const db = await getDb();
    const [a] = await db.select().from(s.analyses).where(eq(s.analyses.id, id));
    expect(a!.structured!.verdicts.map((v) => v.slot)).toEqual(['US-R', 'US-L', 'CN']);
    expect(a!.structured!.disclosures.demoMode).toBe(true);
    expect(a!.provider).toBe('demo');
    const [claim] = await db.select().from(s.claims).where(eq(s.claims.id, a!.claimId!));
    expect(claim!.canonicalText).not.toContain('test@example.com');
    const verdicts = await db.select().from(s.analysisVerdicts).where(eq(s.analysisVerdicts.analysisId, id));
    expect(verdicts).toHaveLength(3);
    const places = await db.select().from(s.claimPlaces).where(eq(s.claimPlaces.analysisId, id));
    expect(places.map((p) => p.placeId)).toContain('ES');
    const es = await ensureRendering(id, 'es-ES');
    expect(es!.lang).toBe('es-ES');
    expect(es!.headline.length).toBeGreaterThan(5);
  });

  it('reuses an earlier analysis of the same claim', async () => {
    const input = { kind: 'text' as const, text: 'Unemployment in Spain fell to 10.5% in 2026 according to the government.' };
    const id = await createPendingAnalysis(input, 'en');
    const r = await runAnalysis(id, input, 'en');
    expect(r.reusedFrom).toBeDefined();
  });

  it('treats value judgements as values questions, without a grade', async () => {
    const input = { kind: 'text' as const, text: 'The government should ban cars from city centres.' };
    const id = await createPendingAnalysis(input, 'es-ES');
    const r = await runAnalysis(id, input, 'es-ES');
    const db = await getDb();
    const [a] = await db.select().from(s.analyses).where(eq(s.analyses.id, r.analysisId));
    expect(a!.grade).toBe('not_checkable');
    expect(a!.structured!.verdicts).toHaveLength(0);
  });
});
