import { getTranslations, setRequestLocale } from 'next-intl/server';
import { and, eq, gte, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { llmCalls } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

export default async function StatusPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('trust.status');
  const db = await getDb();
  const since = new Date(Date.now() - 30 * 60 * 1000);
  const [calls] = await db.select({ total: sql<number>`count(*)::int`, errors: sql<number>`sum(case when ${llmCalls.errorClass} is not null then 1 else 0 end)::int` }).from(llmCalls).where(gte(llmCalls.createdAt, since));
  const [fallback] = await db.select({ n: sql<number>`count(*)::int` }).from(llmCalls).where(and(gte(llmCalls.createdAt, since), eq(llmCalls.provider, 'gateway')));
  const errorRate = calls?.total ? (calls.errors ?? 0) / calls.total : 0;
  const state = (fallback?.n ?? 0) > 0 ? 'fallback' : errorRate > 0.2 ? 'degraded' : 'operational';
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <p className="card p-6 text-xl font-semibold" role="status">{t(state)}</p>
      <p className="text-sm muted">{t('lastChecked', { date: new Date() })}</p>
    </div>
  );
}
