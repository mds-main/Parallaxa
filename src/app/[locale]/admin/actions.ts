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
import { acknowledgeAlert, raiseAlert, sendTestAlert } from '@/lib/admin/alerts';
import { telegramConfigured } from '@/lib/admin/telegram';
import { getDb } from '@/lib/db/client';
import { analyses, quizItems, reviewTasks } from '@/lib/db/schema';
import { prefixFor, type Locale } from '@/i18n/languages';

async function session() {
  const s = await getAdminSession();
  if (!s) throw new Error('Not signed in');
  return s;
}

export async function loginAction(_prev: { error?: string; username?: string } | undefined, form: FormData): Promise<{ error?: string; username?: string }> {
  const locale = String(form.get('locale') ?? 'en') as Locale;
  const username = String(form.get('username') ?? '');
  const result = await login(username, String(form.get('password') ?? ''));
  // Keep the username after a failed attempt (React resets form fields after an action).
  if (result !== 'ok') return { error: result, username: username.slice(0, 100) };
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
        await raiseAlert('eval_regression', `Post-swap eval for config v${res.id}: accuracy ${(m.accuracy * 100).toFixed(1)}%. Consider rolling back.`);
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

/** Posts a test message to the admins' Telegram chat(s). */
export async function sendTestAlertAction(): Promise<{ delivered: number; configured: boolean }> {
  await session();
  return { delivered: await sendTestAlert(), configured: telegramConfigured() };
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

export async function publishCorrectionAction(analysisId: string, input: { grade: string; confidence: string; reasonEn: string; reasonEs: string; reviewer: string; taskId?: string }) {
  const s = await session();
  const { publishCorrection } = await import('@/lib/corrections');
  const { GRADES, CONFIDENCES } = await import('@/lib/domain/types');
  if (!(GRADES as readonly string[]).includes(input.grade) || !(CONFIDENCES as readonly string[]).includes(input.confidence)) throw new Error('Invalid grade or confidence');
  if (!input.reviewer.trim()) throw new Error('Reviewer name is required.');
  const res = await publishCorrection(analysisId, { grade: input.grade as never, confidence: input.confidence as never, reason: { en: input.reasonEn, 'es-ES': input.reasonEs || input.reasonEn }, reviewer: input.reviewer });
  if (input.taskId) {
    const db = await getDb();
    await db.update(reviewTasks).set({ status: 'done', resolvedBy: input.reviewer.slice(0, 80), resolvedAt: new Date() }).where(eq(reviewTasks.id, input.taskId));
  }
  await audit({ action: 'analysis.correct', target: analysisId, after: { ...res, reviewer: input.reviewer, reason: input.reasonEn }, reason: input.reasonEn, ipHash: s.ipHash });
  revalidatePath('/', 'layout');
  return res;
}

// ── Ledger management (PRD F3) ──
export async function saveActorAction(form: FormData): Promise<{ ok: boolean; error?: string }> {
  const s = await session();
  const { actors } = await import('@/lib/db/schema');
  const get = (k: string) => String(form.get(k) ?? '').trim();
  const slug = get('slug').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const type = get('type');
  const allowed = ['politician', 'party', 'government', 'public_figure', 'influencer', 'company', 'entrepreneur', 'media'];
  if (!slug || !get('name') || !allowed.includes(type) || !get('country')) return { ok: false, error: 'Name, slug, type and country are required.' };
  const db = await getDb();
  await db
    .insert(actors)
    .values({ slug, name: get('name'), type: type as never, country: get('country').toUpperCase(), homePlaceId: get('homePlaceId') || null, partyFamily: get('partyFamily') || null, publicRole: { en: get('roleEn'), 'es-ES': get('roleEs') || get('roleEn') } })
    .onConflictDoUpdate({ target: actors.slug, set: { name: get('name'), type: type as never, country: get('country').toUpperCase(), publicRole: { en: get('roleEn'), 'es-ES': get('roleEs') || get('roleEn') } } });
  await audit({ action: 'ledger.actor.save', target: slug, ipHash: s.ipHash });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function linkClaimAction(actorId: string, analysisRef: string, reach: number) {
  const s = await session();
  const { actorClaims } = await import('@/lib/db/schema');
  const { recomputeActor } = await import('@/lib/ledger/score');
  const analysisId = analysisRef.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
  if (!analysisId) throw new Error('Paste an analysis link or id.');
  const db = await getDb();
  await db.insert(actorClaims).values({ actorId, analysisId, reach: Math.max(1, Math.round(reach) || 1) }).onConflictDoNothing();
  const fr = await recomputeActor(actorId);
  await audit({ action: 'ledger.claim.link', target: `${actorId}:${analysisId}`, after: fr, ipHash: s.ipHash });
  revalidatePath('/', 'layout');
  return fr;
}

export async function publishActorAction(actorId: string, published: boolean, legalReviewConfirmed: boolean) {
  const s = await session();
  if (published && !legalReviewConfirmed) throw new Error('Confirm the legal review before publishing a profile.');
  const { actors } = await import('@/lib/db/schema');
  const db = await getDb();
  await db.update(actors).set({ published }).where(eq(actors.id, actorId));
  await audit({ action: published ? 'ledger.actor.publish' : 'ledger.actor.unpublish', target: actorId, reason: published ? 'Legal review confirmed' : undefined, ipHash: s.ipHash });
  revalidatePath('/', 'layout');
}

export async function saveDimensionAction(actorId: string, dimension: string, n: number, confidence: string, value: number | null) {
  const s = await session();
  const { actorDimensionScores } = await import('@/lib/db/schema');
  const { RUBRIC_VERSION } = await import('@/lib/ledger/score');
  const db = await getDb();
  await db
    .insert(actorDimensionScores)
    .values({ actorId, dimension, n, confidence: confidence as never, value, rubricVersion: RUBRIC_VERSION })
    .onConflictDoUpdate({ target: [actorDimensionScores.actorId, actorDimensionScores.dimension], set: { n, confidence: confidence as never, value, computedAt: new Date() } });
  await audit({ action: 'ledger.dimension.save', target: `${actorId}:${dimension}`, after: { n, confidence, value }, ipHash: s.ipHash });
  revalidatePath('/', 'layout');
}

export async function publishReplyAction(actorId: string, body: string, links: string) {
  const s = await session();
  if (body.trim().split(/\s+/).length > 300) throw new Error('Replies are limited to 300 words.');
  const { actorReplies } = await import('@/lib/db/schema');
  const db = await getDb();
  await db.insert(actorReplies).values({ actorId, body: body.trim(), links: links.split(/\s+/).filter((l) => /^https?:\/\//.test(l)), status: 'published', publishedAt: new Date() });
  await audit({ action: 'ledger.reply.publish', target: actorId, ipHash: s.ipHash });
  revalidatePath('/', 'layout');
}
