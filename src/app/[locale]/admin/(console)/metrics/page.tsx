import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin/auth';
import { getSeries, getSlotStats } from '@/lib/admin/metrics';
import { MetricsCharts } from '@/components/admin/MetricsCharts';

export default async function MetricsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const locale = await getLocale();
  await requireAdmin(locale);
  const t = await getTranslations('admin.metrics');
  const days = [7, 30, 90].includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 30;
  const [series, slots] = await Promise.all([getSeries(days), getSlotStats(days)]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <nav className="ml-auto flex gap-1" aria-label={t('range')}>
          {[7, 30, 90].map((d) => (
            <Link key={d} href={{ pathname: '/admin/metrics', query: { days: d } }} className={`chip no-underline ${d === days ? 'bg-ink text-paper' : ''}`}>{t('days', { n: d })}</Link>
          ))}
        </nav>
        <a className="chip" href={`/api/admin/metrics.csv?days=${days}`}>{t('export')}</a>
      </div>
      <p className="muted">{t('intro')}</p>
      <section className="card overflow-x-auto p-4">
        <h2 className="font-semibold">{t('sections.models')}</h2>
        <table className="mt-2 w-full min-w-[36rem] text-sm">
          <thead><tr className="text-left"><th className="p-1">Slot</th><th className="p-1">n</th><th className="p-1">{t('labels.refusalsBySlot')}</th><th className="p-1">{t('labels.agreementMatrix')}</th><th className="p-1">{t('labels.coi')}</th><th className="p-1">{t('labels.latency')}</th><th className="p-1">{t('labels.costBySlot')}</th></tr></thead>
          <tbody>
            {slots.stats.map((s) => (
              <tr key={s.slot} className="border-t border-line">
                <td className="p-1 font-medium">{s.slot}</td>
                <td className="p-1">{s.n}</td>
                <td className="p-1">{(s.refusalRate * 100).toFixed(1)}%</td>
                <td className="p-1">{s.agreement === null ? '—' : `${(s.agreement * 100).toFixed(0)}%`}</td>
                <td className="p-1">{s.coiExclusions}</td>
                <td className="p-1">{s.p95Seconds ?? '—'}</td>
                <td className="p-1">${s.costUsd.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <MetricsCharts series={series} />
    </div>
  );
}
