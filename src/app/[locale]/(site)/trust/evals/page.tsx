import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { desc, ne } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { evalRuns } from '@/lib/db/schema';

/** Public eval results (TODO 19.6): updated nightly and after every model change. */
export default async function EvalsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('trust.evals');
  const format = await getFormatter();
  const db = await getDb();
  const runs = await db.select().from(evalRuns).where(ne(evalRuns.kind, 'harness_check')).orderBy(desc(evalRuns.createdAt)).limit(30);
  const pct = (v: unknown) => (typeof v === 'number' ? format.number(v, { style: 'percent', maximumFractionDigits: 1 }) : '—');
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <p className="max-w-3xl muted">{t('intro')}</p>
      {runs.length === 0 ? (
        <p className="card p-6">{t('empty')}</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="text-left">
                {['when', 'kind', 'n', 'accuracy', 'withinOne', 'calibration', 'parity', 'languageParity'].map((h) => <th key={h} className="p-2">{t(h)}</th>)}
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => {
                const m = r.metrics as Record<string, unknown>;
                return (
                  <tr key={r.id} className="border-t border-line">
                    <td className="p-2 whitespace-nowrap">{format.dateTime(r.createdAt, { dateStyle: 'medium' })}</td>
                    <td className="p-2">{r.kind}{m.demo ? ' (demo)' : ''}</td>
                    <td className="p-2">{String(m.n ?? '—')}</td>
                    <td className="p-2">{pct(m.accuracy)}</td>
                    <td className="p-2">{pct(m.withinOne)}</td>
                    <td className="p-2">{typeof m.calibrationError === 'number' ? m.calibrationError.toFixed(3) : '—'}</td>
                    <td className="p-2">{pct(m.parity)}</td>
                    <td className="p-2">{pct(m.languageParity)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm muted">{t('demo')}</p>
    </div>
  );
}
