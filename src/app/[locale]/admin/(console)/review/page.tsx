import { getLocale, getTranslations } from 'next-intl/server';
import { asc, eq, inArray } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin/auth';
import { getDb } from '@/lib/db/client';
import { claims, analyses, errorReports, reviewTasks } from '@/lib/db/schema';
import { ReviewQueue } from '@/components/admin/ReviewQueue';

export default async function ReviewPage() {
  const locale = await getLocale();
  await requireAdmin(locale);
  const t = await getTranslations('admin.review');
  const db = await getDb();
  const tasks = await db.select().from(reviewTasks).where(eq(reviewTasks.status, 'open')).orderBy(asc(reviewTasks.priority), asc(reviewTasks.createdAt)).limit(100);
  const reportIds = tasks.filter((x) => x.kind === 'error_report').map((x) => x.refId);
  const reports = reportIds.length ? await db.select().from(errorReports).where(inArray(errorReports.id, reportIds)) : [];
  const analysisIds = tasks.map((x) => (x.kind === 'error_report' ? x.notes?.split('\n')[0] : x.refId.split(':')[0])).filter((x): x is string => Boolean(x && /^[0-9a-f-]{36}$/.test(x)));
  const rows = analysisIds.length
    ? await db.select({ id: analyses.id, text: claims.canonicalText, grade: analyses.grade, structured: analyses.structured }).from(analyses).leftJoin(claims, eq(claims.id, analyses.claimId)).where(inArray(analyses.id, analysisIds))
    : [];
  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="muted">{t('intro')}</p>
      <ReviewQueue
        tasks={tasks.map((task) => {
          const aid = task.kind === 'error_report' ? task.notes?.split('\n')[0] : task.refId.split(':')[0];
          const a = rows.find((r) => r.id === aid);
          const report = reports.find((r) => r.id === task.refId);
          return {
            id: task.id,
            kind: task.kind,
            refId: task.refId,
            priority: task.priority,
            dueAt: task.dueAt?.toISOString() ?? null,
            notes: task.notes,
            createdAt: task.createdAt.toISOString(),
            summary: [a?.text ? `“${a.text}” (${a.grade ?? '—'})` : null, report ? `Report: ${report.body}` : null].filter(Boolean).join(' — '),
            verdicts: a?.structured?.verdicts.map((v) => ({ slot: v.slot, model: v.model, grade: v.grade, abstained: v.abstained, coi: v.coiExcluded, reasoning: v.reasoning.slice(0, 600) })) ?? [],
            sources: a?.structured?.sources.slice(0, 8).map((src) => ({ title: src.title, url: src.url, tier: src.tier, hash: src.contentHash })) ?? [],
          };
        })}
      />
    </div>
  );
}
