import { after, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { resumeWithPlace } from '@/lib/pipeline/run';
import { rateLimit } from '@/lib/security/rate-limit';
import { clientIp, hashIp } from '@/lib/security/ip';

export const maxDuration = 300;

const body = z.object({ place: z.string().regex(/^(GLOBAL|[A-Z]{2}(-[A-Z0-9]{1,3})?)$/) });

/** The reader says which place a claim is about; the paused check continues for that place. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const ipHash = await hashIp(clientIp(req.headers));
  if (!(await rateLimit(`place:${ipHash}`, 30, 3600)).ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  const db = await getDb();
  const [place] = await db.select({ id: s.places.id }).from(s.places).where(and(eq(s.places.id, parsed.data.place), eq(s.places.active, true)));
  if (!place) return NextResponse.json({ error: 'unknown_place' }, { status: 400 });
  // Only one answer counts: the first request moves the check from "needs_input" to "running".
  const [claimed] = await db
    .update(s.analyses)
    .set({ status: 'running' })
    .where(and(eq(s.analyses.id, id), eq(s.analyses.status, 'needs_input')))
    .returning({ id: s.analyses.id });
  if (!claimed) return NextResponse.json({ error: 'not_waiting' }, { status: 409 });
  after(async () => {
    await resumeWithPlace(id, place.id);
  });
  return NextResponse.json({ id }, { status: 202 });
}
