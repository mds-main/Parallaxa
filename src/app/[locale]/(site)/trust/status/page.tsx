import { getTranslations, setRequestLocale } from 'next-intl/server';
import { and, eq, gte, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { llmCalls } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

async function readStatus() {
  const db = await getDb();
  const checkedAt = new Date();
  const since = new Date(checkedAt.getTime() - 30 * 60 * 1000);
  const [calls] = await db.select({ total: sql<number>`count(*)::int`, errors: sql<number>`sum(case when ${llmCalls.errorClass} is not null then 1 else 0 end)::int` }).from(llmCalls).where(gte(llmCalls.createdAt, since));
  const [fallback] = await db.select({ n: sql<number>`count(*)::int` }).from(llmCalls).where(and(gte(llmCalls.createdAt, since), eq(llmCalls.provider, 'gateway')));
  const errorRate = calls?.total ? (calls.errors ?? 0) / calls.total : 0;
  const state = (fallback?.n ?? 0) > 0 ? 'fallback' : errorRate > 0.2 ? 'degraded' : 'operational';
  return { state, checkedAt } as const;
}

export default async function StatusPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('trust.status');
  const { state, checkedAt } = await readStatus();
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <p className="card p-6 text-xl font-semibold" role="status">{t(state)}</p>
      <p className="text-sm muted">{t('lastChecked', { date: checkedAt })}</p>
    </div>
  );
}
