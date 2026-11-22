import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { getActiveConfig, listConfigVersions } from '@/lib/config/store';
import { getCatalog } from '@/lib/ai/catalog';
import { modelVendor } from '@/lib/config/models';
import type { AppConfig } from '@/lib/config/schema';

function slotChanges(prev: AppConfig | undefined, next: AppConfig): string[] {
  if (!prev) return [];
  const out: string[] = [];
  for (const s of next.slots) {
    const p = prev.slots.find((x) => x.id === s.id);
    if (!p) out.push(`${s.id}: + ${s.model}`);
    else if (p.model !== s.model) out.push(`${s.id}: ${p.model} → ${s.model}`);
    else if (p.enabled !== s.enabled) out.push(`${s.id}: ${s.enabled ? 'on' : 'off'}`);
  }
  for (const p of prev.slots) if (!next.slots.find((x) => x.id === p.id)) out.push(`${p.id}: − ${p.model}`);
  for (const k of Object.keys(next.roles) as (keyof AppConfig['roles'])[]) if (prev.roles[k] !== next.roles[k]) out.push(`${k}: ${prev.roles[k]} → ${next.roles[k]}`);
  return out;
}

/** Public model lineup and change history (PRD F5, TODO 19.8). */
export default async function ModelsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('trust.lineup');
  const format = await getFormatter();
  const { config } = await getActiveConfig();
  const catalog = await getCatalog();
  const versions = (await listConfigVersions(100)).filter((v) => v.status === 'active' || v.status === 'retired').reverse();
  const history = versions
    .map((v, i) => ({ v, changes: slotChanges(versions[i - 1]?.config, v.config) }))
    .filter((x) => x.changes.length)
    .reverse();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <p className="max-w-3xl">{t('intro')}</p>
      <p className="max-w-3xl text-sm muted">{t('leaningNote')}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr className="text-left">
              {['slot', 'model', 'vendor', 'origin', 'privacy', 'xSearch'].map((h) => <th key={h} className="border-b border-line p-2">{t(h)}</th>)}
            </tr>
          </thead>
          <tbody>
            {config.slots.filter((s) => s.enabled).map((s) => {
              const m = catalog.find((x) => x.id === s.model);
              const v = modelVendor(s.model);
              return (
                <tr key={s.id}>
                  <td className="border-b border-line p-2">{s.label[locale] ?? s.label.en}</td>
                  <td className="border-b border-line p-2 font-medium">{m?.name ?? s.model}</td>
                  <td className="border-b border-line p-2">{v.label}</td>
                  <td className="border-b border-line p-2">{v.origin}</td>
                  <td className="border-b border-line p-2">{m ? t(`privacyTiers.${m.privacy}`) : '—'}</td>
                  <td className="border-b border-line p-2">{m?.capabilities.xSearch && s.harness.xSearch ? '✓' : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <section>
        <h2 className="text-xl font-semibold">{t('roles')}</h2>
        <ul className="mt-2 grid gap-1 text-sm md:grid-cols-2">
          {Object.entries(config.roles).map(([k, v]) => <li key={k}><span className="muted">{k}:</span> {v}</li>)}
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-semibold">{t('history')}</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm muted">{t('noHistory')}</p>
        ) : (
          <ol className="mt-2 space-y-2">
            {history.map(({ v, changes }) => (
              <li key={v.id} className="card p-3 text-sm">
                <p className="font-medium">{format.dateTime(v.activatedAt ?? v.createdAt, { dateStyle: 'medium', timeStyle: 'short' })} · v{v.id}</p>
                <ul className="mt-1 list-disc pl-5">{changes.map((c) => <li key={c}>{c}</li>)}</ul>
                <p className="mt-1 muted">{v.reason}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
