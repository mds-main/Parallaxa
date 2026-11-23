import { NextResponse } from 'next/server';
import { syncCatalog } from '@/lib/ai/catalog';
import { runHealthChecks } from '@/lib/cron/health';
import { runRetention } from '@/lib/cron/retention';
import { sendDuePushes } from '@/lib/cron/push';
import { dueEditionPlaces, generateEdition } from '@/lib/briefing/generate';
import { getActiveConfig } from '@/lib/config/store';
import { runEval } from '@/lib/eval/run';
import { raiseAlert } from '@/lib/admin/alerts';

export const maxDuration = 800;

/** Vercel Cron entry point (vercel.json). Protected by CRON_SECRET (sent by Vercel as a Bearer token). */
export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { job } = await params;
  switch (job) {
    case 'catalog': {
      const r = await syncCatalog();
      const { config } = await getActiveConfig();
      const affected = r.changed.filter((id) => config.slots.some((s) => s.model === id) || Object.values(config.roles).includes(id));
      if (affected.length) await raiseAlert('catalog', `Venice catalog changed for active models: ${affected.join(', ')} (offline, deprecated or price change).`);
      return NextResponse.json(r);
    }
    case 'health':
      return NextResponse.json(await runHealthChecks());
    case 'briefing': {
      const due = await dueEditionPlaces();
      const out = [];
      for (const placeId of due) out.push({ placeId, ...(await generateEdition(placeId)) });
      return NextResponse.json({ due, out });
    }
    case 'push':
      return NextResponse.json(await sendDuePushes());
    case 'retention':
      return NextResponse.json(await runRetention());
    case 'eval': {
      const { id, config } = await getActiveConfig();
      const m = await runEval({ config, configVersionId: id, kind: 'nightly', limit: 50 });
      if (!m.demo && m.accuracy < 0.89 && config.alerts.onEvalRegression) await raiseAlert('eval_regression', `Nightly eval accuracy ${(m.accuracy * 100).toFixed(1)}%.`);
      return NextResponse.json({ accuracy: m.accuracy, parity: m.parity, languageParity: m.languageParity, n: m.n });
    }
    default:
      return NextResponse.json({ error: 'unknown job' }, { status: 404 });
  }
}
