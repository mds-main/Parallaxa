import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordUsage } from '@/lib/metrics/usage';

const body = z.object({ event: z.enum(['briefing_opened']), lang: z.string().max(10).optional() });

/** Anonymous aggregate counters only: no ids, no IPs, no cookies. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (parsed.success) await recordUsage(parsed.data.event, { lang: parsed.data.lang });
  return new NextResponse(null, { status: 204 });
}
