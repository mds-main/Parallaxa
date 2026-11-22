'use client';
import { useTranslations } from 'next-intl';
import { useEditor } from './ConfigEditor';
import { ENABLED_LANGUAGES } from '@/i18n/languages';

const SWITCHES = ['check', 'pushBack', 'briefing', 'ledger', 'quiz'] as const;
const FEATURE_KEY = { check: 'check', pushBack: 'dialogue', briefing: 'briefing', ledger: 'ledger', quiz: 'quiz' } as const;

export function LimitsExtras() {
  const t = useTranslations('admin.limits');
  const tf = useTranslations('admin.features');
  const { draft, update } = useEditor();
  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h2 className="font-semibold">{t('kill')}</h2>
        <p className="text-sm muted">{t('killHelp')}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {SWITCHES.map((k) => (
            <li key={k}>
              <label className={`flex items-center justify-between gap-2 rounded-xl border p-3 ${draft.killSwitches[k] ? 'border-line' : 'border-2 border-ink'}`}>
                <span className="font-medium">{tf(FEATURE_KEY[k])}</span>
                <input type="checkbox" className="h-6 w-6" checked={draft.killSwitches[k]} onChange={(e) => update(`killSwitches.${k}`, e.target.checked)} />
              </label>
            </li>
          ))}
        </ul>
      </section>
      <section className="card space-y-2 p-4">
        <h2 className="font-semibold">{t('maintenance')}</h2>
        {ENABLED_LANGUAGES.map((l) => (
          <label key={l.tag} className="block text-sm">
            <span className="muted">{l.nativeName}</span>
            <input className="field mt-1" value={draft.content.maintenanceBanner[l.tag] ?? ''} onChange={(e) => update('content.maintenanceBanner', { ...draft.content.maintenanceBanner, [l.tag]: e.target.value })} />
          </label>
        ))}
      </section>
    </div>
  );
}
