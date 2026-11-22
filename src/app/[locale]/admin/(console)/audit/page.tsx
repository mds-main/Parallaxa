import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/admin/auth';
import { listAudit } from '@/lib/admin/audit';
import { AuditRevert } from '@/components/admin/AuditRevert';

export default async function AuditPage() {
  const locale = await getLocale();
  await requireAdmin(locale);
  const t = await getTranslations('admin.audit');
  const format = await getFormatter();
  const rows = await listAudit(200);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <a className="chip ml-auto" href="/api/admin/audit.csv">{t('export')}</a>
      </div>
      <p className="muted">{t('intro')}</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead><tr className="text-left"><th className="p-2">{t('when')}</th><th className="p-2">{t('action')}</th><th className="p-2">{t('target')}</th><th className="p-2">{t('reason')}</th><th className="p-2" /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line align-top">
                <td className="p-2 whitespace-nowrap">{format.dateTime(r.at, { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td className="p-2"><code>{r.action}</code></td>
                <td className="p-2">{r.target}</td>
                <td className="p-2">{r.reason}</td>
                <td className="p-2">{r.action === 'config.activate' && r.target.startsWith('config:') ? <AuditRevert auditId={r.id} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
