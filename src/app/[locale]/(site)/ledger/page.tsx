import { getTranslations, setRequestLocale } from 'next-intl/server';
import { and, eq } from 'drizzle-orm';
import { Link } from '@/i18n/navigation';
import { getDb } from '@/lib/db/client';
import { actorDimensionScores, actors } from '@/lib/db/schema';
import { getActiveConfig } from '@/lib/config/store';
import { getPlaces } from '@/lib/queries';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'ledger' }))('title') };
}

export default async function LedgerPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ country?: string; type?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations('ledger');
  const { config } = await getActiveConfig();
  const db = await getDb();
  const conds = [eq(actors.published, true)];
  if (sp.country) conds.push(eq(actors.country, sp.country));
  if (sp.type) conds.push(eq(actors.type, sp.type as never));
  const list = config.killSwitches.ledger ? await db.select().from(actors).where(and(...conds)).limit(200) : [];
  const scores = list.length ? await db.select().from(actorDimensionScores).where(eq(actorDimensionScores.dimension, 'factual_reliability')) : [];
  const places = await getPlaces();
  const countries = [...new Set(list.map((a) => a.country))];
  const types = [...new Set(list.map((a) => a.type))];
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <p className="max-w-3xl muted">{t('intro')}</p>
      <p className="max-w-3xl text-sm">{t('conductNote')}</p>
      {countries.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label={t('filters.country')}>
          <Link href="/ledger" className="chip no-underline">{t('filters.all')}</Link>
          {countries.map((c) => (
            <Link key={c} href={{ pathname: '/ledger', query: { country: c } }} className="chip no-underline">{places.find((p) => p.id === c)?.names[locale] ?? c}</Link>
          ))}
        </nav>
      )}
      {types.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label={t('filters.type')}>
          <Link href={{ pathname: '/ledger', query: sp.country ? { country: sp.country } : {} }} className="chip no-underline">{t('filters.all')}</Link>
          {types.map((ty) => (
            <Link key={ty} href={{ pathname: '/ledger', query: { ...(sp.country ? { country: sp.country } : {}), type: ty } }} className={`chip no-underline ${sp.type === ty ? 'bg-ink text-paper' : ''}`}>{t(`types.${ty}`)}</Link>
          ))}
        </nav>
      )}
      {list.length === 0 ? (
        <p className="card p-6">{t('empty')}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {list.map((a) => {
            const sc = scores.find((s) => s.actorId === a.id);
            return (
              <li key={a.id} className="card p-4">
                <Link href={`/ledger/${a.slug}`} className="text-lg font-semibold">{a.name}</Link>
                <p className="text-sm muted">{t(`types.${a.type}`)} · {places.find((p) => p.id === a.country)?.names[locale] ?? a.country}</p>
                <p className="mt-2 text-sm">{sc && sc.value !== null ? t('sampleSize', { n: sc.n, confidence: sc.confidence ?? '' }) : t('notEnough', { n: sc?.n ?? 0 })}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
