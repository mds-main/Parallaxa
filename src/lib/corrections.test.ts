import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createPendingAnalysis, runAnalysis } from './pipeline/run';
import { publishCorrection } from './corrections';
import { getCorrections } from './queries';
import { getDb } from './db/client';
import { analyses } from './db/schema';

describe('corrections', () => {
  it('creates a new version with a public diff', async () => {
    const input = { kind: 'text' as const, text: 'The Bank of Spain raised interest rates to 9% in 2026.' };
    const id = await createPendingAnalysis(input, 'en');
    const r = await runAnalysis(id, input, 'en');
    const res = await publishCorrection(r.analysisId, { grade: 'contradicted', confidence: 'high', reason: { en: 'Interest rates are set by the ECB, not the Bank of Spain.', 'es-ES': 'Los tipos los fija el BCE, no el Banco de España.' }, reviewer: 'test' });
    expect(res.toVersion).toBe(2);
    const db = await getDb();
    const [a] = await db.select().from(analyses).where(eq(analyses.id, r.analysisId));
    expect(a!.version).toBe(2);
    expect(a!.grade).toBe('contradicted');
    const log = await getCorrections(r.analysisId);
    expect(log[0]!.reason['es-ES']).toContain('BCE');
  });
});
