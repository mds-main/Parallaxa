import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { getActiveConfig } from '@/lib/config/store';
import { createPendingAnalysis, runAnalysis } from '@/lib/pipeline/run';
import { rateLimit } from '@/lib/security/rate-limit';
import { clientIp, hashIp } from '@/lib/security/ip';
import { underSpendCeiling } from '@/lib/ai/spend';
import { isLocale, DEFAULT_LOCALE } from '@/i18n/languages';
import { recordUsage } from '@/lib/metrics/usage';
import { getUserSession } from '@/lib/accounts/session';

export const maxDuration = 300;

const body = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), text: z.string().trim().min(8).max(8000), lang: z.string().optional(), rerunOf: z.string().uuid().optional() }),
  z.object({ kind: z.literal('url'), url: z.string().url().max(2000), lang: z.string().optional() }),
  z.object({ kind: z.literal('image'), dataUrl: z.string().regex(/^data:image\/(png|jpeg|webp);base64,/).max(7_000_000), lang: z.string().optional() }),
]);

export async function POST(req: Request) {
  const { config } = await getActiveConfig();
  if (!config.killSwitches.check) return NextResponse.json({ error: 'disabled' }, { status: 503 });
  const raw = await req.text();
  if (raw.length > 7_100_000) return NextResponse.json({ error: 'too_large' }, { status: 413 });
  let parsed;
  try {
    parsed = body.safeParse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const ipHash = await hashIp(clientIp(req.headers));
  const user = await getUserSession();
  const rl = user
    ? await rateLimit(`check:user:${user.userId}`, config.limits.checksPerHourSignedIn, 3600)
    : await rateLimit(`check:${ipHash}`, config.limits.checksPerHourAnonymous, 3600);
  if (!rl.ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': '3600' } });
  if (!(await underSpendCeiling(config.limits.dailySpendCeilingUsd))) return NextResponse.json({ error: 'spend_limit' }, { status: 402 });

  const lang = parsed.data.lang && isLocale(parsed.data.lang) ? parsed.data.lang : DEFAULT_LOCALE;
  const input = parsed.data.kind === 'text' ? { kind: 'text' as const, text: parsed.data.text } : parsed.data.kind === 'url' ? { kind: 'url' as const, url: parsed.data.url } : { kind: 'image' as const, dataUrl: parsed.data.dataUrl };
  const id = await createPendingAnalysis(input, lang);
  await recordUsage('check_started', { lang });
  // "Re-run with current models" skips the similar-claim cache so today's lineup investigates again.
  const skipCache = parsed.data.kind === 'text' && Boolean(parsed.data.rerunOf);
  after(async () => {
    await runAnalysis(id, input, lang, { skipCache });
  });
  return NextResponse.json({ id }, { status: 202 });
}
