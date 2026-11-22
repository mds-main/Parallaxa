import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { surveyResponses } from '@/lib/db/schema';
import { rateLimit } from '@/lib/security/rate-limit';
import { clientIp, hashIp } from '@/lib/security/ip';

const ANSWERS = { respected: ['yes', 'no'], calmer: ['calmer', 'same', 'more_stressed'], relevant: ['yes', 'somewhat', 'no'] } as const;
const body = z.object({ question: z.enum(['respected', 'calmer', 'relevant']), answer: z.string().max(20), lang: z.string().max(10).optional() });

/** Opt-in, anonymous micro-survey answers: nothing links an answer to a person or a session. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !(ANSWERS[parsed.data.question] as readonly string[]).includes(parsed.data.answer)) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  if (!(await rateLimit(`survey:${await hashIp(clientIp(req.headers))}`, 30, 3600)).ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  const db = await getDb();
  await db.insert(surveyResponses).values({ question: parsed.data.question, answer: parsed.data.answer, lang: parsed.data.lang ?? null });
  return new NextResponse(null, { status: 204 });
}
