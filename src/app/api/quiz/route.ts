import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { quizResponses } from '@/lib/db/schema';
import { recordUsage } from '@/lib/metrics/usage';

const body = z.object({ quizItemId: z.string().uuid(), guess: z.number().min(0).max(100) });

/** Anonymous quiz answers (no user id) for aggregate perception-gap measurement (PRD 10). */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const db = await getDb();
  await db.insert(quizResponses).values(parsed.data).catch(() => undefined);
  await recordUsage('quiz_answered');
  return new NextResponse(null, { status: 204 });
}
