import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin/auth';
import { getOverview } from '@/lib/admin/metrics';

function Card({ title, value, sub, warn, href }: { title: string; value: React.ReactNode; sub?: React.ReactNode; warn?: boolean; href?: string }) {
  const body = (
    <div className={`card h-full p-4 ${warn ? 'border-2 border-ink' : ''}`}>
      <p className="text-sm muted">{warn ? '⚠ ' : ''}{title}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-sm muted">{sub}</p>}
    </div>
  );
  return href ? <Link href={href} className="no-underline">{body}</Link> : body;
}

export default async function Overview() {
  const locale = await getLocale();
  await requireAdmin(locale);
  const t = await getTranslations('admin.overview');
  const format = await getFormatter();
  const o = await getOverview();
  const usd = (n: number) => format.number(n, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  const pct = (n: number | null) => (n === null ? '—' : format.number(n, { style: 'percent', maximumFractionDigits: 1 }));
  const ready = o.editions.filter((e) => e.status === 'published').length;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className={`rounded-xl p-4 text-lg font-medium ${o.attention.length ? 'border-2 border-ink' : 'bg-paper-2'}`} role="status">
        {o.attention.length ? t('attention', { count: o.attention.length }) : `✓ ${t('allGood')}`}
      </p>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title={t('venice')} value={o.veniceErrorRate > 0.2 ? '⚠' : '✓'} sub={`${pct(o.veniceErrorRate)} errors (30 min)`} warn={o.veniceErrorRate > 0.2} href="/admin/models" />
        <Card title={t('fallback')} value={o.fallbackActive ? t('fallbackActive') : t('fallbackIdle')} warn={o.fallbackActive} href="/admin/limits" />
        <Card title={t('breakers')} value={o.breakers.length || '0'} sub={o.breakers.join(', ') || undefined} warn={o.breakers.length > 0} href="/admin/models" />
        <Card title={t('alerts')} value={o.openAlerts} warn={o.openAlerts > 0} href="/admin/alerts" />
        <Card title={t('checksToday')} value={o.checksToday} sub={`${t('cacheHits')}: ${o.reusedToday}`} href="/admin/metrics" />
        <Card title={t('p50')} value={o.p50Seconds === null ? t('noData') : t('seconds', { value: o.p50Seconds })} sub={o.p95Seconds === null ? undefined : `${t('p95')}: ${t('seconds', { value: o.p95Seconds })}`} warn={o.attention.includes('latency')} href="/admin/metrics" />
        <Card title={t('errorRate')} value={pct(o.errorRate)} warn={o.attention.includes('errors')} href="/admin/metrics" />
        <Card title={t('spend')} value={usd(o.spendToday)} sub={t('ofCeiling', { ceiling: usd(o.ceiling) })} warn={o.attention.includes('spend')} href="/admin/limits" />
        <Card title={t('editions')} value={`${ready}/${o.editions.length}`} sub={o.editions.map((e) => `${e.placeId}: ${e.status}`).join(' · ')} href="/admin/content" />
        <Card title={t('reviewQueue')} value={o.openReviews} href="/admin/review" />
        <Card title={t('agreement')} value={pct(o.agreementRate)} href="/admin/models" />
        <Card title={t('evals')} value={o.lastEval?.metrics.accuracy !== undefined && o.lastEval?.metrics.accuracy !== null ? pct(Number(o.lastEval.metrics.accuracy)) : t('noData')} sub={o.lastEval ? `${o.lastEval.kind} · ${format.dateTime(o.lastEval.at, { dateStyle: 'short', timeStyle: 'short' })}` : undefined} href="/admin/metrics" />
      </section>
    </div>
  );
}
