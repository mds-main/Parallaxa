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

describe('claim clean-up output', () => {
  it('keeps the PII-free local-language version for local searches, and drops it when it adds nothing', async () => {
    const { toAtomicClaims } = await import('./run');
    const claims = toAtomicClaims(
      [
        { canonical: ' Unemployment in Spain is at a 15-year low. ', local: ' El paro en España está en mínimos de 15 años. ', type: 'fact', checkable: true },
        { canonical: 'Taxes doubled.', local: 'Taxes doubled.', type: 'nonsense', checkable: true },
        { canonical: '   ', local: 'x', type: 'fact', checkable: true },
      ],
      5,
    );
    expect(claims).toEqual([
      { id: 'c1', canonical: 'Unemployment in Spain is at a 15-year low.', localized: 'El paro en España está en mínimos de 15 años.', type: 'fact', checkable: true },
      { id: 'c2', canonical: 'Taxes doubled.', type: 'fact', checkable: true },
    ]);
  });
});

describe('asking which place a claim is about', () => {
  const unplaced = { kind: 'text' as const, text: 'Unemployment has fallen to its lowest level in 15 years. Write to me at someone@example.com.' };

  it('pauses before investigating, keeping only the cleaned claim, and resumes for the chosen place', async () => {
    const { resumeWithPlace } = await import('./run');
    const db = await getDb();
    const id = await createPendingAnalysis(unplaced, 'en');
    const paused = await runAnalysis(id, unplaced, 'en');
    expect(paused.status).toBe('needs_input');
    const [a] = await db.select().from(s.analyses).where(eq(s.analyses.id, id));
    expect(a!.status).toBe('needs_input');
    expect(a!.progress!.question).toBe('place');
    expect(a!.pending!.suggestions).toEqual(['US', 'GB']);
    expect(JSON.stringify(a!.pending!.atomic)).not.toContain('someone@example.com');
    expect(await db.select().from(s.analysisVerdicts).where(eq(s.analysisVerdicts.analysisId, id))).toHaveLength(0);

    await db.update(s.analyses).set({ status: 'running' }).where(eq(s.analyses.id, id)); // what the API does first
    const done = await resumeWithPlace(id, 'ES');
    expect(['published', 'review']).toContain(done.status);
    const [b] = await db.select().from(s.analyses).where(eq(s.analyses.id, id));
    expect(b!.pending).toBeNull();
    const [claim] = await db.select().from(s.claims).where(eq(s.claims.id, b!.claimId!));
    expect(claim!.canonicalText).toBe('Unemployment has fallen to its lowest level in 15 years (Spain).');
    const places = await db.select().from(s.claimPlaces).where(eq(s.claimPlaces.analysisId, id));
    expect(places).toEqual([expect.objectContaining({ placeId: 'ES', confidence: 1 })]);
  });

  it('gives everyone who picks the same place the same analysis, and a different place its own', async () => {
    const { resumeWithPlace } = await import('./run');
    const db = await getDb();
    const ask = async (place: string) => {
      const id = await createPendingAnalysis(unplaced, 'en');
      expect((await runAnalysis(id, unplaced, 'en')).status).toBe('needs_input');
      await db.update(s.analyses).set({ status: 'running' }).where(eq(s.analyses.id, id));
      return resumeWithPlace(id, place);
    };
    const first = await ask('FR');
    expect(first.reusedFrom).toBeUndefined();
    const again = await ask('FR');
    expect(again.reusedFrom).toBe(first.analysisId);
    const other = await ask('DE');
    expect(other.reusedFrom).toBeUndefined();
    expect(other.analysisId).not.toBe(first.analysisId);
  });

  it('never asks when the caller already knows the place, the claim is worldwide, or it is a values question', async () => {
    const briefing = { kind: 'text' as const, text: 'Inflation has fallen below 3% for the first time in 4 years.' };
    const id = await createPendingAnalysis(briefing, 'en');
    expect((await runAnalysis(id, briefing, 'en', { place: 'IT' })).status).not.toBe('needs_input');
    const worldwide = { kind: 'text' as const, text: 'Global average temperatures in 2026 were the highest on record.' };
    const id2 = await createPendingAnalysis(worldwide, 'en');
    expect((await runAnalysis(id2, worldwide, 'en')).status).not.toBe('needs_input');
    const values = { kind: 'text' as const, text: 'Taxes should be 10% lower for everyone.' };
    const id3 = await createPendingAnalysis(values, 'en');
    expect((await runAnalysis(id3, values, 'en')).status).not.toBe('needs_input');
  });

  it('writes the place into the claim the same way every time, and offers likely places first', async () => {
    const { withPlace, placeSuggestions } = await import('./run');
    expect(withPlace('El paro está en mínimos de 15 años.', 'España')).toBe('El paro está en mínimos de 15 años (España).');
    expect(withPlace('Prices doubled', 'Community of Madrid')).toBe('Prices doubled (Community of Madrid).');
    expect(placeSuggestions({ places: [{ id: 'GLOBAL', confidence: 0.3 }], topics: [] }, 'es')).toEqual(['ES', 'MX']);
    expect(placeSuggestions({ places: [{ id: 'PT', confidence: 0.4 }], topics: [] }, 'es')).toEqual(['PT', 'ES', 'MX']);
  });
});
