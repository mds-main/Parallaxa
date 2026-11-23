import { NextResponse } from 'next/server';
import { syncCatalog } from '@/lib/ai/catalog';
import { runHealthChecks } from '@/lib/cron/health';
import { runRetention } from '@/lib/cron/retention';
import { sendDuePushes } from '@/lib/cron/push';
import { dueEditionPlaces, generateEdition } from '@/lib/briefing/generate';
import { getActiveConfig } from '@/lib/config/store';
import { runEval } from '@/lib/eval/run';
import { raiseAlert } from '@/lib/admin/alerts';
import { log, requestId } from '@/lib/log';

export const maxDuration = 800;

/** Vercel Cron entry point (vercel.json). Protected by CRON_SECRET (sent by Vercel as a Bearer token). */
export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { job } = await params;
  const started = Date.now();
  try {
    const res = await runJob(job);
    const summary = (await res.clone().json().catch(() => ({}))) as Record<string, unknown>;
    // Frequent jobs with nothing to report log at debug, so routine runs don't flood the logs.
    const quiet = res.ok && (IDLE[job]?.(summary) ?? false);
    const unhealthy = job === 'health' ? Object.entries((summary.pings ?? {}) as Record<string, string>).filter(([, v]) => v !== 'ok').map(([k]) => k) : [];
    (quiet ? log.debug : log.info)('cron.done', { job, status: res.status, ms: Date.now() - started, ...brief(summary), down: unhealthy.length ? unhealthy.join(',') : undefined });
    return res;
  } catch (e) {
    log.error('cron.failed', { job, ms: Date.now() - started, req: requestId(req.headers), error: e });
    return NextResponse.json({ error: 'failed', job }, { status: 500 });
  }
}

/** Frequent jobs whose result says they did nothing worth a line. */
const IDLE: Record<string, (r: Record<string, unknown>) => boolean> = {
  health: (r) => Object.values((r.pings ?? {}) as Record<string, string>).every((v) => v === 'ok'),
  catalog: (r) => !(r.changed as unknown[] | undefined)?.length,
  push: (r) => !r.sent,
  briefing: (r) => !(r.due as unknown[] | undefined)?.length,
};

/** Counts and flags only: list fields become their length, objects are left out. */
function brief(summary: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(summary)) {
    if (Array.isArray(v)) out[k] = v.length;
    else if (typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && v.length < 60)) out[k] = v;
  }
  return out;
}

async function runJob(job: string): Promise<NextResponse> {
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
