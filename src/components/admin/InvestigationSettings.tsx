'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useEditor } from './ConfigEditor';
import type { CatalogModel } from '@/lib/config/models';
import type { HarnessSettings } from '@/lib/config/schema';

const NUMS: { key: keyof HarnessSettings; min: number; max: number; step: number }[] = [
  { key: 'maxToolCalls', min: 1, max: 40, step: 1 },
  { key: 'maxWebSearches', min: 0, max: 20, step: 1 },
  { key: 'maxXSearches', min: 0, max: 20, step: 1 },
  { key: 'maxScrapes', min: 0, max: 20, step: 1 },
  { key: 'timeLimitSec', min: 20, max: 600, step: 5 },
  { key: 'costCapUsd', min: 0.01, max: 10, step: 0.01 },
];

export function InvestigationSettings({ catalog }: { catalog: CatalogModel[] }) {
  const t = useTranslations('admin.investigation');
  const locale = useLocale();
  const { draft, replace } = useEditor();
  const set = (i: number, patch: Partial<HarnessSettings> | { coiTopics: string[] }) =>
    replace({
      ...draft,
      slots: draft.slots.map((s, j) => (j !== i ? s : 'coiTopics' in patch ? { ...s, coiTopics: patch.coiTopics } : { ...s, harness: { ...s.harness, ...patch } })),
    });
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {draft.slots.map((slot, i) => {
        const m = catalog.find((x) => x.id === slot.model);
        const h = slot.harness;
        return (
          <section key={slot.id} className="card space-y-3 p-4">
            <h2 className="font-semibold">{slot.id} · {m?.name ?? slot.model}</h2>
            <p className="text-xs muted">{slot.label[locale] ?? slot.label.en}</p>
            <label className="block text-sm">
              <span className="label">{t('webSearch')}</span>
              <select className="field mt-1" value={h.webSearch} onChange={(e) => set(i, { webSearch: e.target.value as HarnessSettings['webSearch'] })}>
                <option value="on">on</option>
                <option value="auto">auto</option>
                <option value="off">off</option>
              </select>
              <span className="mt-1 block text-xs muted">{t('webSearchHelp')}</span>
            </label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={h.scraping} onChange={(e) => set(i, { scraping: e.target.checked })} /> {t('scraping')}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={h.citations} onChange={(e) => set(i, { citations: e.target.checked })} /> {t('citations')}</label>
            {m?.capabilities.xSearch ? (
              <label className="block text-sm">
                <span className="flex items-center gap-2"><input type="checkbox" checked={h.xSearch} onChange={(e) => set(i, { xSearch: e.target.checked })} /> {t('xSearch')}</span>
                <span className="mt-1 block text-xs muted">{t('xSearchHelp')}</span>
              </label>
            ) : (
              <p className="text-xs muted">{t('xUnsupported')}</p>
            )}
            <label className="block text-sm">
              <span className="label">{t('reasoningEffort')}</span>
              <select className="field mt-1" value={h.reasoningEffort ?? ''} onChange={(e) => set(i, { reasoningEffort: e.target.value || undefined })}>
                <option value="">{t('reasoningDefault')}</option>
                {(m?.capabilities.reasoningEffortOptions ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {NUMS.map((n) => (
                <label key={n.key} className="block text-sm">
                  <span className="text-xs muted">{t(n.key)}</span>
                  <input
                    type="number"
                    className="field mt-1 !min-h-9 !py-1"
                    min={n.min}
                    max={n.max}
                    step={n.step}
                    value={Number(h[n.key])}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) set(i, { [n.key]: Math.min(n.max, Math.max(n.min, v)) } as Partial<HarnessSettings>);
                    }}
                  />
                </label>
              ))}
            </div>
            <label className="block text-sm">
              <span className="text-xs muted">{t('temperature')}</span>
              <input type="number" className="field mt-1 !min-h-9 !py-1" min={0} max={2} step={0.1} placeholder={t('temperatureDefault')} value={h.temperature ?? ''} onChange={(e) => set(i, { temperature: e.target.value === '' ? undefined : Math.min(2, Math.max(0, Number(e.target.value))) })} />
            </label>
            <label className="block text-sm">
              <span className="label">{t('coiTopics')}</span>
              <textarea className="field mt-1 min-h-28 text-sm" value={slot.coiTopics.join('\n')} onChange={(e) => set(i, { coiTopics: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} />
              <span className="mt-1 block text-xs muted">{t('coiHelp')}</span>
            </label>
            <p className="text-xs muted">🔒 {t('systemPromptLocked')}</p>
          </section>
        );
      })}
    </div>
  );
}
