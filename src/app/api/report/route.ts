import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { errorReports, reviewTasks } from '@/lib/db/schema';
import { rateLimit } from '@/lib/security/rate-limit';
import { clientIp, hashIp } from '@/lib/security/ip';
import { recordUsage } from '@/lib/metrics/usage';
import { getAnalysis } from '@/lib/queries';

const body = z.object({ analysisId: z.string().uuid(), version: z.number().int().min(1), body: z.string().trim().min(10).max(4000) });

/** "Report an error" (TODO 13.6): creates a report and a review task with the 72-hour SLA clock. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const ipHash = await hashIp(clientIp(req.headers));
  if (!(await rateLimit(`report:${ipHash}`, 10, 3600)).ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  if (!(await getAnalysis(parsed.data.analysisId))) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const db = await getDb();
  const [row] = await db.insert(errorReports).values(parsed.data).returning({ id: errorReports.id });
  await db.insert(reviewTasks).values({ kind: 'error_report', refId: row!.id, priority: 1, dueAt: new Date(Date.now() + 72 * 3600 * 1000), notes: parsed.data.analysisId });
  await recordUsage('error_reported');
  return NextResponse.json({ ok: true });
}
