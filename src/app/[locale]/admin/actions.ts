'use server';
/**
 * Admin server actions. Each one re-verifies the admin session (TODO 22.5); Next.js server actions
 * also reject cross-origin POSTs, and the session cookie is SameSite=Strict (CSRF protection).
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { eq } from 'drizzle-orm';
import { getAdminSession, login, logout } from '@/lib/admin/auth';
import { activateConfig, getActiveConfig, rollbackTo } from '@/lib/config/store';
import { appConfigSchema, type AppConfig } from '@/lib/config/schema';
import { harnessCheck, runEval, type HarnessCheckResult } from '@/lib/eval/run';
import { syncCatalog } from '@/lib/ai/catalog';
import { forceBreaker } from '@/lib/ai/breaker';
import { audit } from '@/lib/admin/audit';
import { acknowledgeAlert, raiseAlert } from '@/lib/admin/alerts';
import { getDb } from '@/lib/db/client';
import { analyses, quizItems, reviewTasks } from '@/lib/db/schema';
import { prefixFor, type Locale } from '@/i18n/languages';

async function session() {
  const s = await getAdminSession();
  if (!s) throw new Error('Not signed in');
  return s;
}

export async function loginAction(_prev: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  const locale = String(form.get('locale') ?? 'en') as Locale;
  const result = await login(String(form.get('username') ?? ''), String(form.get('password') ?? ''));
  if (result !== 'ok') return { error: result };
  redirect(`/${prefixFor(locale)}/admin`);
}

export async function logoutAction(form: FormData) {
  await logout();
  redirect(`/${prefixFor(String(form.get('locale') ?? 'en') as Locale)}/admin/login`);
}

export type ApplyResult = { ok: true; id: number } | { ok: false; problems: string[] };

export async function applyConfigAction(next: AppConfig, reason: string): Promise<ApplyResult> {
  const s = await session();
  const parsed = appConfigSchema.safeParse(next);
  if (!parsed.success) return { ok: false, problems: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  const before = await getActiveConfig();
  const res = await activateConfig(parsed.data, { reason, ipHash: s.ipHash });
  if (!res.ok) return res;
  // Post-swap eval when any perspective model changed (TODO 10.26).
  const modelsChanged = parsed.data.slots.some((slot) => before.config.slots.find((p) => p.id === slot.id)?.model !== slot.model);
  if (modelsChanged) {
    after(async () => {
      const m = await runEval({ config: parsed.data, configVersionId: res.id, kind: 'post_swap', limit: 50 });
      const prev = before.config;
      void prev;
      if (!m.demo && m.accuracy < 0.89 && parsed.data.alerts.onEvalRegression) {
        await raiseAlert('eval_regression', `Post-swap eval for config v${res.id}: accuracy ${(m.accuracy * 100).toFixed(1)}%. Consider rolling back.`, parsed.data.alerts.emails);
      }
    });
  }
  revalidatePath('/', 'layout');
  return res;
}

export async function harnessCheckAction(slotId: string, model: string): Promise<HarnessCheckResult> {
  await session();
  const { config } = await getActiveConfig();
  return harnessCheck(config, slotId, model);
}

export async function rollbackAction(versionId: number, reason: string): Promise<ApplyResult> {
  const s = await session();
  const res = await rollbackTo(versionId, { reason, ipHash: s.ipHash });
  revalidatePath('/', 'layout');
  return res;
}

export async function syncCatalogAction(): Promise<{ count: number; changed: string[] }> {
  const s = await session();
  const r = await syncCatalog();
  await audit({ action: 'catalog.sync', target: 'venice', after: r, ipHash: s.ipHash });
  return r;
}

export async function forceBreakerAction(model: string, state: 'open' | 'closed' | 'auto') {
  const s = await session();
  forceBreaker(model, state === 'auto' ? undefined : state);
  await audit({ action: 'breaker.force', target: model, after: { state }, ipHash: s.ipHash });
}

export async function resolveReviewAction(taskId: string, decision: 'approve' | 'reviewed' | 'escalate', reviewer: string, notes: string) {
  const s = await session();
  if (!reviewer.trim()) throw new Error('Reviewer name is required.');
  const db = await getDb();
  const [task] = await db.select().from(reviewTasks).where(eq(reviewTasks.id, taskId));
  if (!task) throw new Error('Task not found');
  await db
    .update(reviewTasks)
    .set({ status: decision === 'escalate' ? 'escalated' : 'done', resolvedBy: reviewer.slice(0, 80), resolvedAt: new Date(), notes: [task.notes, notes].filter(Boolean).join('\n').slice(0, 4000) })
    .where(eq(reviewTasks.id, taskId));
  const analysisId = task.kind === 'error_report' ? task.notes?.split('\n')[0] : task.refId.split(':')[0];
  if (analysisId && /^[0-9a-f-]{36}$/.test(analysisId) && decision !== 'escalate') {
    const [a] = await db.select().from(analyses).where(eq(analyses.id, analysisId));
    if (a?.structured) {
      const structured = { ...a.structured, disclosures: { ...a.structured.disclosures, humanReviewed: true } };
      await db
        .update(analyses)
        .set({ humanReviewed: true, structured, ...(decision === 'approve' && a.status === 'review' ? { status: 'published' as const, publishedAt: new Date() } : {}) })
        .where(eq(analyses.id, analysisId));
    }
  }
  await audit({ action: `review.${decision}`, target: `${task.kind}:${task.refId}`, after: { reviewer, notes }, ipHash: s.ipHash });
  revalidatePath('/', 'layout');
}

export async function saveQuizItemAction(form: FormData): Promise<{ ok: boolean; error?: string }> {
  const s = await session();
  const get = (k: string) => String(form.get(k) ?? '').trim();
  const item = {
    placeId: get('placeId').toUpperCase(),
    topicId: get('topicId'),
    question: { en: get('questionEn'), 'es-ES': get('questionEs') },
    trueValue: Number(get('trueValue')),
    margin: Number(get('margin')),
    sourceName: get('sourceName'),
    sourceUrl: get('sourceUrl'),
    originalWording: get('originalWording'),
    year: Number(get('year')),
  };
  if (!item.placeId || !item.question.en || !item.question['es-ES'] || !/^https?:\/\//.test(item.sourceUrl) || !(item.trueValue >= 0 && item.trueValue <= 100)) {
    return { ok: false, error: 'Please fill in every field (published survey source required).' };
  }
  const db = await getDb();
  await db.insert(quizItems).values(item);
  await audit({ action: 'quiz.add', target: item.placeId, after: item, ipHash: s.ipHash });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function toggleQuizItemAction(id: string, active: boolean) {
  const s = await session();
  const db = await getDb();
  await db.update(quizItems).set({ active }).where(eq(quizItems.id, id));
  await audit({ action: active ? 'quiz.enable' : 'quiz.disable', target: id, ipHash: s.ipHash });
  revalidatePath('/', 'layout');
}

export async function acknowledgeAlertAction(id: number) {
  await session();
  await acknowledgeAlert(id);
  revalidatePath('/', 'layout');
}

export async function runEvalAction(): Promise<{ accuracy: number; n: number; demo: boolean }> {
  await session();
  const { id, config } = await getActiveConfig();
  const m = await runEval({ config, configVersionId: id, kind: 'nightly', limit: 50 });
  return { accuracy: m.accuracy, n: m.n, demo: m.demo };
}

/** Reverts a configuration change from the audit log by re-activating the configuration it replaced. */
export async function revertAuditAction(auditId: number, reason: string): Promise<ApplyResult> {
  const s = await session();
  const db = await getDb();
  const { auditLog } = await import('@/lib/db/schema');
  const [row] = await db.select().from(auditLog).where(eq(auditLog.id, auditId));
  if (!row || row.action !== 'config.activate' || !row.before) return { ok: false, problems: ['Nothing to revert.'] };
  const parsed = appConfigSchema.safeParse(row.before);
  if (!parsed.success) return { ok: false, problems: ['Stored configuration is no longer valid.'] };
  const res = await activateConfig(parsed.data, { reason: `Revert audit #${auditId}: ${reason}`, ipHash: s.ipHash });
  revalidatePath('/', 'layout');
  return res;
}
