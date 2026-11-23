import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/admin/auth';
import { getActiveConfig } from '@/lib/config/store';
import { listAlerts } from '@/lib/admin/alerts';
import { ConfigEditor } from '@/components/admin/ConfigEditor';
import { SectionFields } from '@/components/admin/FieldInput';
import { acknowledgeAlertAction } from '../../actions';
import { telegramChats, telegramConfigured } from '@/lib/admin/telegram';
import { TelegramTest } from '@/components/admin/TelegramTest';

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
      <section className={`card space-y-2 p-4 ${telegramConfigured() ? '' : 'border-2 border-ink'}`} aria-labelledby="telegram-title">
        <h2 id="telegram-title" className="font-semibold">{t('telegram.title')}</h2>
        <p className="text-sm">{telegramConfigured() ? `✓ ${t('telegram.on', { count: telegramChats().length })}` : `✗ ${t('telegram.off')}`}</p>
        <p className="text-sm muted">{t('telegram.help')}</p>
        {telegramConfigured() && <TelegramTest />}
      </section>
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
