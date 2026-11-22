import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getActiveConfig } from '@/lib/config/store';
import { getAnalysis } from '@/lib/queries';
import { pushBackReply } from '@/lib/dialogue/pushback';
import { rateLimit } from '@/lib/security/rate-limit';
import { clientIp, hashIp } from '@/lib/security/ip';
import { underSpendCeiling } from '@/lib/ai/spend';
import { recordUsage } from '@/lib/metrics/usage';
import { isLocale, DEFAULT_LOCALE } from '@/i18n/languages';

export const maxDuration = 60;

const body = z.object({
  analysisId: z.string().uuid(),
  lang: z.string(),
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) })).min(1).max(60),
});

export async function POST(req: Request) {
  const { config } = await getActiveConfig();
  if (!config.killSwitches.pushBack) return NextResponse.json({ error: 'disabled' }, { status: 503 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const turns = parsed.data.messages.filter((m) => m.role === 'user').length;
  if (turns > config.limits.dialogueMaxTurns) return NextResponse.json({ error: 'limit' }, { status: 400 });
  const ipHash = await hashIp(clientIp(req.headers));
  if (!(await rateLimit(`dialogue:${ipHash}`, config.limits.dialogueMaxTurns * 6, 3600)).ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  if (!(await underSpendCeiling(config.limits.dailySpendCeilingUsd))) return NextResponse.json({ error: 'spend_limit' }, { status: 402 });
  const found = await getAnalysis(parsed.data.analysisId);
  if (!found?.analysis.structured || found.analysis.status !== 'published') return NextResponse.json({ error: 'not_found' }, { status: 404 });
  try {
    const reply = await pushBackReply({
      analysisId: found.analysis.id,
      structured: found.analysis.structured,
      claim: found.claim?.canonicalText ?? '',
      messages: parsed.data.messages,
      uiLang: isLocale(parsed.data.lang) ? parsed.data.lang : DEFAULT_LOCALE,
      config,
    });
    await recordUsage('pushback_message', { lang: parsed.data.lang });
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
