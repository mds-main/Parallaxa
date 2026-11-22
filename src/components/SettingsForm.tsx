'use client';
import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { clearAllLocalData, exportLocalData, savePreferences } from '@/lib/prefs/storage';
import { useIsClient, usePushSupport, useStoredPreferences } from '@/lib/prefs/hooks';
import { defaultPreferences, MAX_PLACES, type Preferences, type TopicState } from '@/lib/prefs/types';
import { LanguageSwitcher } from './LanguageSwitcher';
import { enablePush } from '@/lib/prefs/push';
import { Link } from '@/i18n/navigation';
import { assembleBriefing, type EditionStory } from '@/lib/briefing/assemble';

export type PlaceOption = { id: string; parentId: string | null; level: string; names: Record<string, string>; localName: string | null; coverageLevel: string };
export type TopicOption = { id: string; parentId: string | null; names: Record<string, string>; countryCode: string | null };

export function PlacePicker({ places, value, onChange }: { places: PlaceOption[]; value: Preferences['places']; onChange: (v: Preferences['places']) => void }) {
  const t = useTranslations('settings.places');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [q, setQ] = useState('');
  const name = (p: PlaceOption) => p.names[locale] ?? p.names.en ?? p.id;
  const byId = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const matches = q.trim().length >= 1
    ? places
        .filter((p) => p.level !== 'global' && !value.some((v) => v.id === p.id))
        .filter((p) => `${name(p)} ${p.localName ?? ''} ${p.id}`.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 8)
    : [];
  const set = (next: Preferences['places']) => {
    if (next.length && !next.some((p) => p.home)) next = next.map((p, i) => ({ ...p, home: i === 0 }));
    onChange(next);
  };
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {value.map((v) => {
          const p = byId.get(v.id);
          return (
            <li key={v.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3">
              <span className="font-medium">{p ? name(p) : v.id}</span>
              {p?.localName && <span className="text-sm muted">({p.localName})</span>}
              {p && <span className="chip">{tc(`coverage.${p.coverageLevel}`)}</span>}
              {v.home ? <span className="chip">★ {t('home')}</span> : (
                <button type="button" className="text-sm underline" onClick={() => set(value.map((x) => ({ ...x, home: x.id === v.id })))}>{t('makeHome')}</button>
              )}
              <label className="ml-auto flex items-center gap-1 text-sm">
                <input type="checkbox" checked={v.mode === 'focus'} onChange={(e) => set(value.map((x) => (x.id === v.id ? { ...x, mode: e.target.checked ? 'focus' : 'include' } : x)))} />
                {t('focus')}
              </label>
              <button type="button" className="text-sm underline" onClick={() => set(value.filter((x) => x.id !== v.id))}>{t('remove')}</button>
            </li>
          );
        })}
      </ul>
      {value.length < MAX_PLACES ? (
        <div className="relative">
          <label className="label" htmlFor="place-search">{t('add')}</label>
          <input id="place-search" className="field mt-1" value={q} placeholder={t('search')} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          {matches.length > 0 && (
            <ul className="card absolute z-10 mt-1 w-full p-1" role="listbox">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="w-full rounded-lg px-3 py-2 text-left hover:bg-paper-2"
                    onClick={() => {
                      set([...value, { id: p.id, mode: 'include', home: value.length === 0 }]);
                      setQ('');
                    }}
                  >
                    {name(p)} <span className="text-sm muted">· {p.parentId && byId.get(p.parentId) ? name(byId.get(p.parentId)!) : tc(`placeLevels.${p.level}`)} · {tc(`coverage.${p.coverageLevel}`)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-sm muted">{t('max')}</p>
      )}
    </div>
  );
}

export function TopicPicker({ topics, value, onChange }: { topics: TopicOption[]; value: Record<string, TopicState>; onChange: (v: Record<string, TopicState>) => void }) {
  const t = useTranslations('settings.topics');
  const locale = useLocale();
  const roots = topics.filter((x) => !x.parentId);
  const states: TopicState[] = ['follow', 'neutral', 'mute'];
  const row = (topic: TopicOption, child = false) => (
    <li key={topic.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 ${child ? 'pl-6' : ''}`}>
      <span className={child ? 'text-sm' : 'font-medium'}>{topic.names[locale] ?? topic.names.en}</span>
      <span role="radiogroup" aria-label={topic.names[locale]} className="inline-flex overflow-hidden rounded-full border border-line text-sm">
        {states.map((st) => (
          <button
            key={st}
            type="button"
            role="radio"
            aria-checked={(value[topic.id] ?? 'neutral') === st}
            className={`px-3 py-1 ${(value[topic.id] ?? 'neutral') === st ? 'bg-ink text-paper' : ''}`}
            onClick={() => onChange({ ...value, [topic.id]: st })}
          >
            {t(st)}
          </button>
        ))}
      </span>
    </li>
  );
  return (
    <ul className="divide-y divide-line">
      {roots.map((r) => [row(r), ...topics.filter((c) => c.parentId === r.id).map((c) => row(c, true))])}
    </ul>
  );
}

export function SettingsForm({ places, topics, editions = [] }: { places: PlaceOption[]; topics: TopicOption[]; editions?: { placeId: string; stories: EditionStory[] }[] }) {
  const t = useTranslations('settings');
  const isClient = useIsClient();
  const stored = useStoredPreferences();
  const support = usePushSupport();
  const [status, setStatus] = useState<string | null>(null);
  const [pushOverride, setPushState] = useState<'on' | 'off' | null>(null);
  const pushState = pushOverride ?? support ?? 'off';
  if (!isClient) return null;
  const prefs: Preferences = stored ?? { ...defaultPreferences(), onboarded: true };
  const update = (p: Preferences) => {
    savePreferences(p);
    setStatus(t('saved'));
  };
  const b = prefs.briefing;
  const locale = document.documentElement.lang;
  const parents = Object.fromEntries(places.map((p) => [p.id, p.parentId]));
  const preview = editions.length ? assembleBriefing(editions, prefs, (id) => parents[id] ?? null).stories : [];
  return (
    <div className="space-y-8">
      {preview.length > 0 && (
        <section className="card p-5" aria-live="polite">
          <h2 className="font-semibold">{t('preview')}</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            {preview.map((s) => <li key={s.analysisId}>{s.headline[locale] ?? s.headline.en}{s.claim ? ` — “${s.claim.slice(0, 90)}”` : ''}</li>)}
          </ol>
        </section>
      )}
      <p role="status" aria-live="polite" className="sr-only">{status}</p>
      <section className="card space-y-3 p-5">
        <h2 className="text-xl font-semibold">{t('places.title')}</h2>
        <p className="text-sm muted">{t('places.help')}</p>
        <PlacePicker places={places} value={prefs.places} onChange={(v) => update({ ...prefs, places: v })} />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={prefs.global} onChange={(e) => update({ ...prefs, global: e.target.checked })} />
          {t('places.global')}
        </label>
      </section>
      <section className="card space-y-3 p-5">
        <h2 className="text-xl font-semibold">{t('topics.title')}</h2>
        <p className="text-sm muted">{t('topics.help')}</p>
        <TopicPicker topics={topics} value={prefs.topics} onChange={(v) => update({ ...prefs, topics: v })} />
      </section>
      <section className="card grid gap-4 p-5 md:grid-cols-2">
        <h2 className="text-xl font-semibold md:col-span-2">{t('briefing.title')}</h2>
        <label className="block">
          <span className="label">{t('briefing.length')}</span>
          <select className="field mt-1" value={b.stories} onChange={(e) => update({ ...prefs, briefing: { ...b, stories: Number(e.target.value) as 3 | 5 } })}>
            <option value={3}>3</option>
            <option value={5}>5</option>
          </select>
        </label>
        <label className="block">
          <span className="label">{t('briefing.time')}</span>
          <input className="field mt-1" type="time" value={b.time} onChange={(e) => update({ ...prefs, briefing: { ...b, time: e.target.value } })} />
        </label>
        <label className="block">
          <span className="label">{t('briefing.days')}</span>
          <select className="field mt-1" value={b.days} onChange={(e) => update({ ...prefs, briefing: { ...b, days: e.target.value as 'everyday' | 'weekdays' } })}>
            <option value="everyday">{t('briefing.everyday')}</option>
            <option value="weekdays">{t('briefing.weekdays')}</option>
          </select>
        </label>
        <label className="block">
          <span className="label">{t('briefing.depth')}</span>
          <select className="field mt-1" value={b.depth} onChange={(e) => update({ ...prefs, briefing: { ...b, depth: e.target.value as 'quick' | 'standard' } })}>
            <option value="quick">{t('briefing.quick')}</option>
            <option value="standard">{t('briefing.standard')}</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={b.plain} onChange={(e) => update({ ...prefs, briefing: { ...b, plain: e.target.checked } })} />
          {t('briefing.plain')}
        </label>
        <div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={b.outsideFilters} onChange={(e) => update({ ...prefs, briefing: { ...b, outsideFilters: e.target.checked, outsideOffSince: e.target.checked ? undefined : new Date().toISOString() } })} />
            {t('briefing.outside')}
          </label>
          <p className="mt-1 text-sm muted">{t('briefing.outsideHelp')}</p>
        </div>
      </section>
      <section className="card space-y-3 p-5">
        <h2 className="text-xl font-semibold">{t('notifications.title')}</h2>
        <p className="text-sm muted">{t('notifications.help')}</p>
        {pushState === 'unsupported' && <p className="text-sm">{t('notifications.unsupported')}</p>}
        {pushState === 'off' && (
          <button className="btn" onClick={async () => setPushState((await enablePush(prefs)) ? 'on' : 'off')}>
            {t('notifications.enable')}
          </button>
        )}
        {pushState === 'on' && <p className="text-sm">✓ {t('notifications.enabled')}</p>}
      </section>
      <section className="card space-y-3 p-5">
        <h2 className="text-xl font-semibold">{t('language.title')}</h2>
        <LanguageSwitcher />
      </section>
      <section className="card space-y-3 p-5">
        <h2 className="text-xl font-semibold">{t('privacy.title')}</h2>
        <p className="text-sm muted">{t('privacy.help')}</p>
        <p className="text-sm"><Link href="/account">{t('account.title')}</Link></p>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-ghost"
            onClick={() => {
              const blob = new Blob([exportLocalData()], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'parallaxa-data.json';
              a.click();
            }}
          >
            {t('privacy.export')}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              clearAllLocalData();
              setStatus(t('privacy.deleted'));
            }}
          >
            {t('privacy.delete')}
          </button>
        </div>
        {status === t('privacy.deleted') && <p role="status">{status}</p>}
      </section>
    </div>
  );
}
