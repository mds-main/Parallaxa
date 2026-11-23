'use client';
import { gatewayModelFor } from '@/lib/ai/routing';
import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useEditor } from './ConfigEditor';
import { checkHarnessRequirements, checkLineup, estimateInvestigationCost, modelVendor, type CatalogModel } from '@/lib/config/models';
import { harnessSchema, type SlotConfig, type RolesConfig } from '@/lib/config/schema';
import { forceBreakerAction, harnessCheckAction, rollbackAction, syncCatalogAction } from '@/app/[locale]/admin/actions';
import type { HarnessCheckResult } from '@/lib/eval/run';

export type SlotStat = { slot: string; n: number; refusalRate: number; agreement: number | null; coiExclusions: number; p95Seconds: number | null; costUsd: number };
type Version = { id: number; createdAt: string; reason: string; status: string };

const usd = (n: number, locale: string) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 3 }).format(n);
const pct = (n: number | null, locale: string) => (n === null ? '—' : new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(n));

function Badges({ m }: { m?: CatalogModel }) {
  const t = useTranslations('admin.models.badges');
  if (!m) return null;
  const items: [string, boolean][] = [
    [t('tools'), m.capabilities.functionCalling],
    [t('schema'), m.capabilities.responseSchema],
    [t('web'), m.capabilities.webSearch],
    [t('x'), m.capabilities.xSearch],
  ];
  return (
    <ul className="flex flex-wrap gap-1">
      {items.map(([label, ok]) => (
        <li key={label} className={`chip text-xs ${ok ? '' : 'opacity-50 line-through'}`}>{ok ? '✓' : '✗'} {label}</li>
      ))}
    </ul>
  );
}

function Picker({ slot, catalog, onPick, onClose }: { slot: SlotConfig; catalog: CatalogModel[]; onPick: (id: string) => void; onClose: () => void }) {
  const t = useTranslations('admin.models.picker');
  const locale = useLocale();
  const [q, setQ] = useState('');
  const [origin, setOrigin] = useState('');
  const origins = [...new Set(catalog.map((m) => modelVendor(m.id).origin))].sort();
  const list = catalog
    .filter((m) => `${m.id} ${m.name} ${modelVendor(m.id).label}`.toLowerCase().includes(q.toLowerCase()))
    .filter((m) => !origin || modelVendor(m.id).origin === origin)
    .map((m) => ({ m, req: checkHarnessRequirements(m, slot) }))
    .sort((a, b) => Number(b.req.ok) - Number(a.req.ok) || a.m.id.localeCompare(b.m.id));
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="picker-title" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 md:items-center" onClick={onClose}>
      <div className="card max-h-[85vh] w-full max-w-3xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line p-4">
          <h2 id="picker-title" className="font-semibold">{t('title', { slot: slot.label[locale] ?? slot.id })}</h2>
          <button className="ml-auto text-sm underline" onClick={onClose}>✕</button>
        </div>
        <div className="flex flex-wrap gap-2 p-4">
          <input className="field md:!w-72" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <select className="field !w-auto" value={origin} onChange={(e) => setOrigin(e.target.value)} aria-label={t('origin')}>
            <option value="">{t('origin')}</option>
            {origins.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <ul className="max-h-[55vh] divide-y divide-line overflow-y-auto px-4 pb-4">
          {list.map(({ m, req }) => (
            <li key={m.id} className={`flex flex-wrap items-center gap-3 py-3 ${req.ok ? '' : 'opacity-60'}`}>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{m.name} <span className="text-xs muted">{m.id}</span></p>
                <p className="text-xs muted">{modelVendor(m.id).label} · {modelVendor(m.id).origin} · {m.privacy} · ${m.pricing.inputUsdPerM}/${m.pricing.outputUsdPerM}</p>
                <Badges m={m} />
                {!req.ok && <p className="mt-1 text-xs">{t('incompatible', { reasons: req.reasons.join(', ') })}</p>}
              </div>
              <span className="text-xs muted">{t('estimate', { value: usd(estimateInvestigationCost(m, slot.harness), locale) })}</span>
              <button className="btn !min-h-9 !py-1" disabled={!req.ok || m.id === slot.model} onClick={() => onPick(m.id)}>{t('select')}</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ModelsManager({ catalog, gatewayIds, stats, matrix, breakers, versions }: { catalog: CatalogModel[]; gatewayIds: string[] | null; stats: SlotStat[]; matrix: { slots: string[]; values: (number | null)[][] }; breakers: Record<string, { open: boolean; forced?: string }>; versions: Version[] }) {
  const t = useTranslations('admin.models');
  const locale = useLocale();
  const router = useRouter();
  const { draft, initial, update, replace, setBlocker } = useEditor();
  const [picking, setPicking] = useState<number | null>(null);
  const [checks, setChecks] = useState<Record<string, HarnessCheckResult | 'running'>>({});
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const byId = useMemo(() => new Map(catalog.map((m) => [m.id, m])), [catalog]);
  const lineup = checkLineup(draft);

  // Activation requires a passed harness check for every changed perspective model (PRD 9.4).
  useEffect(() => {
    const missing = draft.slots.filter((s) => s.enabled && initial.slots.find((p) => p.id === s.id)?.model !== s.model).filter((s) => {
      const c = checks[`${s.id}:${s.model}`];
      return !c || c === 'running' || !c.ok;
    });
    setBlocker('harness', missing.length ? `${t('test')}: ${missing.map((s) => `${s.id} → ${s.model}`).join(', ')}` : null);
    setBlocker('lineup', lineup.ok ? null : lineup.problems.join(' '));
  }, [draft, initial, checks, lineup.ok, lineup.problems, setBlocker, t]);

  async function runCheck(slot: SlotConfig, model: string) {
    const key = `${slot.id}:${model}`;
    setChecks((c) => ({ ...c, [key]: 'running' }));
    const r = await harnessCheckAction(slot.id, model);
    setChecks((c) => ({ ...c, [key]: r }));
  }

  const setSlot = (i: number, patch: Partial<SlotConfig>) => replace({ ...draft, slots: draft.slots.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const roleKeys = Object.keys(draft.roles) as (keyof RolesConfig)[];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm">{t('lineupRules')}</p>
        <button
          className="btn btn-ghost ml-auto !min-h-9 !py-1 text-sm"
          onClick={async () => {
            const r = await syncCatalogAction();
            setSyncMsg(t('catalogUpdated', { count: r.count }));
            router.refresh();
          }}
        >
          {t('catalogSync')}
        </button>
        {syncMsg && <span role="status" className="text-sm">{syncMsg}</span>}
      </div>
      {!lineup.ok && <p role="alert" className="rounded-lg border-2 border-ink p-3 text-sm">{lineup.problems.join(' ')}</p>}

      <ul className="grid gap-4 lg:grid-cols-3">
        {draft.slots.map((slot, i) => {
          const m = byId.get(slot.model);
          const v = modelVendor(slot.model);
          const st = stats.find((x) => x.slot === slot.id);
          const original = initial.slots.find((p) => p.id === slot.id);
          const changed = original?.model !== slot.model;
          const check = checks[`${slot.id}:${slot.model}`];
          const br = breakers[slot.model];
          return (
            <li key={slot.id} className={`card space-y-3 p-4 ${changed ? 'ring-2 ring-accent' : ''} ${slot.enabled ? '' : 'opacity-70'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold tracking-wide uppercase muted">{slot.id} · {t(`leaning.${slot.perceivedLeaning}`)}</p>
                  <p className="font-medium">{slot.label[locale] ?? slot.label.en}</p>
                </div>
                <label className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={slot.enabled} onChange={(e) => setSlot(i, { enabled: e.target.checked })} />
                  {slot.enabled ? t('enabled') : t('disabled')}
                </label>
              </div>
              <div>
                <p className="text-sm muted">{t('current')}</p>
                <p className="text-lg font-semibold">{m?.name ?? slot.model}</p>
                {changed && <p className="text-xs">← {original?.model}</p>}
                <p className="text-sm muted">{v.label} · {t('origin')}: {v.origin} · {t('privacy')}: {m?.privacy ?? '—'}</p>
              </div>
              <Badges m={m} />
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <dt className="muted">{t('price')}</dt><dd>{m ? `$${m.pricing.inputUsdPerM} / $${m.pricing.outputUsdPerM}` : '—'}</dd>
                <dt className="muted">{t('p95')}</dt><dd>{st?.p95Seconds ?? '—'} s</dd>
                <dt className="muted">{t('refusals')}</dt><dd>{pct(st?.refusalRate ?? null, locale)}</dd>
                <dt className="muted">{t('agreement')}</dt><dd>{pct(st?.agreement ?? null, locale)}</dd>
                <dt className="muted">{t('breaker')}</dt>
                <dd>
                  {br?.open ? t('breakerOpen') : t('breakerClosed')}{' '}
                  <button className="text-xs underline" onClick={() => forceBreakerAction(slot.model, br?.forced ? 'auto' : 'open').then(() => router.refresh())}>
                    {br?.forced ? '↺' : '⏸'}
                  </button>
                </dd>
              </dl>
              <div className="flex flex-wrap gap-2">
                <button className="btn !min-h-9 !py-1 text-sm" onClick={() => setPicking(i)}>{t('change')}</button>
                {changed && (
                  <button className="btn btn-ghost !min-h-9 !py-1 text-sm" disabled={check === 'running'} onClick={() => runCheck(slot, slot.model)}>
                    {check === 'running' ? t('testing') : t('test')}
                  </button>
                )}
                {changed && original && (
                  <button
                    className="btn btn-ghost !min-h-9 !py-1 text-sm"
                    title={t('shadowHelp', { n: 20 })}
                    onClick={() => setSlot(i, { model: original.model, shadowModel: slot.model, shadowRemaining: 20 })}
                  >
                    {t('shadow')}
                  </button>
                )}
              </div>
              {slot.shadowModel && (
                <p className="text-xs">
                  {t('shadowCount')}: {slot.shadowModel} ({slot.shadowRemaining}){' '}
                  <button className="underline" onClick={() => setSlot(i, { shadowModel: undefined, shadowRemaining: undefined })}>✕</button>
                </p>
              )}
              {check && check !== 'running' && (
                <div className="rounded-lg bg-paper-2 p-3 text-sm" role="status">
                  <p className="font-semibold">{check.ok ? `✓ ${t('testPassed')}` : `✗ ${t('testFailed')}`}{check.demo ? ' (demo)' : ''}</p>
                  <ul className="mt-1 space-y-0.5">{check.checks.map((c) => <li key={c.label}>{c.ok ? '✓' : '✗'} {c.label} {c.detail ? `(${c.detail})` : ''}</li>)}</ul>
                </div>
              )}
              <label className="block text-sm">
                <span className="muted">{t('fallback')}</span>
                <input className="field mt-1 !min-h-9 !py-1" value={slot.fallbackModel} placeholder={gatewayModelFor(slot.model, '', gatewayIds) ?? ''} onChange={(e) => setSlot(i, { fallbackModel: e.target.value })} aria-describedby={`gw-${slot.id}`} />
                <span id={`gw-${slot.id}`} className="mt-1 block text-xs muted">
                  {(() => {
                    const used = gatewayModelFor(slot.model, slot.fallbackModel, gatewayIds);
                    if (!used) return `⚠ ${t('fallbackNone')}`;
                    if (slot.fallbackModel.trim() && used !== slot.fallbackModel.trim()) return `⚠ ${t('fallbackMissing', { model: used })}`;
                    return slot.fallbackModel.trim() ? null : t('fallbackAuto', { model: used });
                  })()}
                </span>
              </label>
              {i >= 3 && (
                <button className="text-sm underline" onClick={() => replace({ ...draft, slots: draft.slots.filter((_, j) => j !== i) })}>{t('removeSlot')}</button>
              )}
            </li>
          );
        })}
      </ul>
      {draft.slots.length < 5 && (
        <button
          className="btn btn-ghost"
          onClick={() =>
            replace({
              ...draft,
              slots: [
                ...draft.slots,
                {
                  id: `X${draft.slots.length - 2}`,
                  label: { en: 'Additional perspective', 'es-ES': 'Perspectiva adicional' },
                  perceivedLeaning: 'none',
                  origin: 'FR',
                  model: 'mistral-small-3-2-24b-instruct',
                  allowedPrivacy: ['private', 'anonymized'],
                  enabled: false,
                  harness: harnessSchema.parse({ xSearch: false }),
                  coiTopics: [],
                  fallbackModel: '',
                },
              ],
            })
          }
        >
          + {t('addSlot')}
        </button>
      )}

      {matrix.slots.length > 1 && (
        <section className="card p-4">
          <h2 className="font-semibold">{t('agreement')}</h2>
          <table className="mt-2 text-sm">
            <thead><tr><th />{matrix.slots.map((s) => <th key={s} className="px-3">{s}</th>)}</tr></thead>
            <tbody>{matrix.slots.map((a, i) => <tr key={a}><th className="pr-3 text-left">{a}</th>{matrix.values[i]!.map((v, j) => <td key={j} className="px-3 text-center">{pct(v, locale)}</td>)}</tr>)}</tbody>
          </table>
        </section>
      )}

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">{t('roles')}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {roleKeys.map((k) => (
            <label key={k} className="block text-sm">
              <span className="muted">{t(`roleNames.${k}`)}</span>
              {k === 'writer' ? (
                <select className="field mt-1" value={draft.roles.writer} onChange={(e) => update('roles.writer', e.target.value)}>
                  <option value="rotate">{t('rotate')}</option>
                  {draft.slots.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
                </select>
              ) : (
                <select className="field mt-1" value={draft.roles[k]} onChange={(e) => update(`roles.${k}`, e.target.value)}>
                  {!byId.has(draft.roles[k]) && <option value={draft.roles[k]}>{draft.roles[k]}</option>}
                  {catalog
                    .filter((m) => (k === 'pushBack' || k === 'canonicalize' || k === 'vision' ? m.privacy === 'private' : true))
                    .map((m) => <option key={m.id} value={m.id}>{m.name} ({m.privacy})</option>)}
                </select>
              )}
            </label>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">{t('history')}</h2>
        <ol className="mt-2 divide-y divide-line text-sm">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="font-mono">{t('version', { id: v.id })}</span>
              <span className="chip">{v.status}</span>
              <span className="muted">{new Date(v.createdAt).toLocaleString(locale)}</span>
              <span className="flex-1">{v.reason}</span>
              {v.status !== 'active' && (
                <button
                  className="underline"
                  onClick={async () => {
                    const reason = window.prompt(t('rollback'));
                    if (reason) {
                      await rollbackAction(v.id, reason);
                      router.refresh();
                    }
                  }}
                >
                  {t('rollback')}
                </button>
              )}
            </li>
          ))}
        </ol>
      </section>

      {picking !== null && (
        <Picker
          slot={draft.slots[picking]!}
          catalog={catalog}
          onClose={() => setPicking(null)}
          onPick={(id) => {
            const s = draft.slots[picking]!;
            const caps = byId.get(id)?.capabilities;
            setSlot(picking, { model: id, origin: modelVendor(id).origin.length === 2 ? modelVendor(id).origin : s.origin, harness: { ...s.harness, xSearch: Boolean(caps?.xSearch) && s.harness.xSearch } });
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}
