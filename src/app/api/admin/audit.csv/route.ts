import { getAdminSession } from '@/lib/admin/auth';
import { listAudit } from '@/lib/admin/audit';

const csv = (rows: (string | number | null)[][]) => rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

export async function GET() {
  if (!(await getAdminSession())) return new Response('Unauthorized', { status: 401 });
  const rows = await listAudit(5000);
  return new Response(csv([['id', 'at', 'actor', 'action', 'target', 'reason', 'ip_hash'], ...rows.map((r) => [r.id, r.at.toISOString(), r.actor, r.action, r.target, r.reason, r.ipHash])]), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="parallaxa-audit.csv"' },
  });
}
