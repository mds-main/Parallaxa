import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/admin/auth';
import { getActiveConfig } from '@/lib/config/store';
import { listAlerts } from '@/lib/admin/alerts';
import { ConfigEditor } from '@/components/admin/ConfigEditor';
import { SectionFields } from '@/components/admin/FieldInput';
import { acknowledgeAlertAction } from '../../actions';

export default async function AlertsPage() {
  const locale = await getLocale();
  await requireAdmin(locale);
  const t = await getTranslations('admin.alerts');
  const format = await getFormatter();
  const { config } = await getActiveConfig();
  const alerts = await listAlerts();
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="muted">{t('intro')}</p>
      <section className="card p-4">
        <h2 className="font-semibold">{t('recent')}</h2>
        {alerts.length === 0 ? (
          <p className="mt-2 text-sm muted">{t('none')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line text-sm">
            {alerts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="chip">{a.kind}</span>
                <span className="flex-1">{a.message}</span>
                <span className="muted">{format.dateTime(a.at, { dateStyle: 'short', timeStyle: 'short' })}</span>
                {!a.acknowledgedAt && (
                  <form action={acknowledgeAlertAction.bind(null, a.id)}>
                    <button className="underline">{t('acknowledge')}</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <ConfigEditor initial={config}>
        <SectionFields section="alerts" />
      </ConfigEditor>
    </div>
  );
}
