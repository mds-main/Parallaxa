import { getAdminSession } from '@/lib/admin/auth';
import { getSeries } from '@/lib/admin/metrics';

const csv = (rows: (string | number | null)[][]) => rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

export async function GET(req: Request) {
  if (!(await getAdminSession())) return new Response('Unauthorized', { status: 401 });
  const days = Math.min(365, Math.max(1, Number(new URL(req.url).searchParams.get('days') ?? 30)));
  const s = await getSeries(days);
  const rows: (string | number | null)[][] = [['date', 'checks', 'failed', 'spend_usd', 'fallback_calls']];
  const dates = [...new Set([...s.checks.map((c) => c.d), ...s.spend.map((x) => x.d)])].sort();
  for (const d of dates) {
    const c = s.checks.find((x) => x.d === d);
    const p = s.spend.find((x) => x.d === d);
    rows.push([d, c?.total ?? 0, c?.failed ?? 0, p?.usd ?? 0, p?.fallback ?? 0]);
  }
  return new Response(csv(rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="parallaxa-metrics-${days}d.csv"` } });
}
