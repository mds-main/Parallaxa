'use client';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useEditor } from './ConfigEditor';
import { ENGINES, planEngines, RESEARCH_DEPTH, type EngineKey, type KeyStatus } from '@/lib/ai/search-engines';
import { SEARCH_ENGINES, type SearchConfig, type SearchEngineId } from '@/lib/config/schema';

/** Admin › Investigation › Search engines: which engine searches first, the backups in order, and research depth. */
export function SearchEngines({ keyStatus }: { keyStatus: Record<EngineKey, KeyStatus> }) {
  const t = useTranslations('admin.investigation.search');
  const { draft, initial, update, setBlocker } = useEditor();
  const cfg = draft.search;
  const keys = { exa: keyStatus.exa.set, brave: keyStatus.brave.set, venice: keyStatus.venice.set };
  const set = (next: Partial<SearchConfig>) => {
    for (const [k, v] of Object.entries(next)) update(`search.${k}`, v);
  };
  const order = planEngines(cfg, keys);
  const demo = !keys.venice;
  const changed = JSON.stringify(cfg) !== JSON.stringify(initial.search);

  useEffect(() => {
    setBlocker('search', changed && !demo && order.length === 0 ? t('blockNoEngine') : null);
  }, [changed, demo, order.length, setBlocker, t]);

  // Choosing a new primary keeps the old one as the first backup, so nothing silently drops out.
  const choosePrimary = (e: SearchEngineId) => {
    if (e === cfg.primary) return;
    set({ primary: e, fallbacks: [cfg.primary, ...cfg.fallbacks.filter((f) => f !== e && f !== cfg.primary)].slice(0, 3) });
  };
  const toggleBackup = (e: SearchEngineId, on: boolean) => set({ fallbacks: on ? [...cfg.fallbacks, e].slice(0, 3) : cfg.fallbacks.filter((f) => f !== e) });
  const move = (i: number, dir: -1 | 1) => {
    const f = [...cfg.fallbacks];
    const j = i + dir;
    if (j < 0 || j >= f.length) return;
    [f[i], f[j]] = [f[j]!, f[i]!];
    set({ fallbacks: f });
  };
  const others = SEARCH_ENGINES.filter((e) => e !== cfg.primary);
  const backupsInOrder = [...cfg.fallbacks.filter((e) => e !== cfg.primary), ...others.filter((e) => !cfg.fallbacks.includes(e))];
  const name = (e: SearchEngineId) => ENGINES[e].name;
  const orderText = !order.length
    ? t('none')
    : cfg.combine && order.length >= 2
      ? [`${name(order[0]!)} + ${name(order[1]!)}`, ...order.slice(2).map(name)].join(' → ')
      : order.map(name).join(' → ');
  const keyText = (e: SearchEngineId) => (keys[ENGINES[e].key] ? `✓ ${t('keySet')}` : `✗ ${t('keyMissing', { env: keyStatus[ENGINES[e].key].env })}`);

  return (
    <section className="card space-y-4 p-4" aria-labelledby="search-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="search-title" className="text-lg font-semibold">{t('title')}</h2>
        <p className="text-sm">
          <span className="muted">{t('order')}: </span>
          <strong>{orderText}</strong>
        </p>
      </div>
      <p className="max-w-3xl text-sm muted">{t('intro')}</p>

      <fieldset>
        <legend className="font-semibold">{t('primary')}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {SEARCH_ENGINES.map((e) => {
            const selected = e === cfg.primary;
            const meta = ENGINES[e];
            return (
              <label key={e} className={`flex cursor-pointer flex-col gap-1.5 rounded-xl p-3 ${selected ? 'border-2 border-ink bg-paper-2' : 'border border-line'}`}>
                <span className="flex items-start gap-2">
                  <input type="radio" name="search-primary" className="mt-1 h-5 w-5" checked={selected} onChange={() => choosePrimary(e)} aria-labelledby={`engine-${e}`} aria-describedby={`engine-${e}-help`} />
                  <span id={`engine-${e}`} className="font-semibold">{meta.name}</span>
                </span>
                <span id={`engine-${e}-help`} className="flex flex-col gap-1 text-sm">
                  <span className="muted">{t(`engines.${e}`)}</span>
                  <span className="flex flex-wrap gap-1 text-xs">
                    {meta.zeroRetention && <span className="chip">{t('zeroRetention')}</span>}
                    {meta.fullText && <span className="chip">{t('fullText')}</span>}
                    <span className="chip">{t('price', { usd: meta.usdPer1k })}</span>
                  </span>
                  <span className={keys[meta.key] ? '' : 'font-medium'}>{keyText(e)}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-semibold">{t('backups')}</legend>
        <p className="text-sm muted">{t('backupsHelp')}</p>
        <ol className="mt-2 space-y-1">
          {backupsInOrder.map((e) => {
            const i = cfg.fallbacks.indexOf(e);
            const on = i >= 0;
            return (
              <li key={e} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2">
                <label className="flex flex-1 items-center gap-2">
                  <input type="checkbox" className="h-5 w-5" checked={on} onChange={(ev) => toggleBackup(e, ev.target.checked)} />
                  <span className="font-medium">{on ? `${i + 1}. ` : ''}{ENGINES[e].name}</span>
                  <span className="text-xs muted">{keyText(e)}</span>
                </label>
                {on && (
                  <span className="flex gap-1">
                    <button type="button" className="btn btn-ghost !min-h-9 !px-3" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('moveUp', { engine: ENGINES[e].name })}>↑</button>
                    <button type="button" className="btn btn-ghost !min-h-9 !px-3" onClick={() => move(i, 1)} disabled={i === cfg.fallbacks.length - 1} aria-label={t('moveDown', { engine: ENGINES[e].name })}>↓</button>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        {cfg.fallbacks[0] && (
          <button type="button" className="btn btn-ghost mt-2" onClick={() => choosePrimary(cfg.fallbacks[0]!)}>
            ⇄ {t('swap', { engine: ENGINES[cfg.fallbacks[0]].name })}
          </button>
        )}
      </fieldset>

      <label className="flex items-start gap-2">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={cfg.combine} onChange={(e) => set({ combine: e.target.checked })} />
        <span>
          <span className="font-semibold">{t('combine')}</span>
          <span className="block text-sm muted">{t('combineHelp')}</span>
        </span>
      </label>

      <fieldset>
        <legend className="font-semibold">{t('depth')}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(['standard', 'deep'] as const).map((d) => (
            <label key={d} className={`flex cursor-pointer items-start gap-2 rounded-xl p-3 ${cfg.depth === d ? 'border-2 border-ink bg-paper-2' : 'border border-line'}`}>
              <input type="radio" name="research-depth" className="mt-1 h-5 w-5" checked={cfg.depth === d} onChange={() => set({ depth: d })} />
              <span>
                <span className="font-semibold">{t(`depths.${d}`)}</span>
                {d === 'deep' && <span className="chip ml-2 text-xs">{t('recommended')}</span>}
                <span className="block text-sm muted">{t('depthHelp', { queries: RESEARCH_DEPTH[d].queries, pages: RESEARCH_DEPTH[d].pagesRead })}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <ul className="space-y-1 text-sm">
        <li>🔒 {t('privacyNote')}</li>
        {(cfg.primary === 'exa' || cfg.fallbacks.includes('exa')) && <li>{t('exaRetentionNote')}</li>}
        {!demo && order[0] && order[0] !== cfg.primary && <li className="font-medium">⚠ {t('primaryMissing', { engine: ENGINES[cfg.primary].name, first: ENGINES[order[0]].name })}</li>}
      </ul>
    </section>
  );
}
