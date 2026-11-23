'use client';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { defaultPreferences, suggestHomeCountry, type Preferences } from '@/lib/prefs/types';
import { savePreferences } from '@/lib/prefs/storage';
import { useBrowserLanguages, useIsClient, useStoredPreferences } from '@/lib/prefs/hooks';
import { PlacePicker, TopicPicker, type PlaceOption, type TopicOption } from './SettingsForm';
import { LanguageSwitcher } from './LanguageSwitcher';

/** Onboarding (PRD 8.4): ≤ 60 s, skippable, no sign-up, no political identity question. */
export function Onboarding({ places, topics }: { places: PlaceOption[]; topics: TopicOption[] }) {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const [step, setStep] = useState(0);
  const isClient = useIsClient();
  const stored = useStoredPreferences();
  const languages = useBrowserLanguages();
  const [draft, setPrefs] = useState<Preferences | null>(null);
  const suggested = useMemo(() => {
    const countries = places.filter((p) => p.level === 'country').map((p) => p.id);
    return defaultPreferences(suggestHomeCountry(languages ? languages.split(',') : [], countries));
  }, [places, languages]);
  const prefs = draft ?? stored ?? suggested;
  if (!isClient) return null;
  const finish = () => {
    savePreferences({ ...prefs, onboarded: true });
    router.replace('/');
  };
  const skip = () => {
    savePreferences({ ...prefs, onboarded: true });
    sessionStorage.setItem('plx:onboardingSkipped', '1');
    router.replace('/');
  };
  const panels = ['step1', 'step2', 'step3'] as const;
  return (
    <div className="mx-auto max-w-xl lg:max-w-3xl 2xl:max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <LanguageSwitcher />
        <button className="text-sm underline" onClick={skip}>{t('skip')}</button>
      </div>
      <div className="card p-6 md:p-8 xl:p-10">
        {step < 3 && (
          <>
            <h1 className="text-2xl font-semibold">{t(`${panels[step]!}.title`)}</h1>
            <p className="mt-3 text-lg">{t(`${panels[step]!}.text`)}</p>
          </>
        )}
        {step === 3 && (
          <>
            <h1 className="text-2xl font-semibold">{t('places.title')}</h1>
            <p className="mt-2 muted">{t('places.text')}</p>
            <div className="mt-4">
              <PlacePicker places={places} value={prefs.places} onChange={(v) => setPrefs({ ...prefs, places: v })} />
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <h1 className="text-2xl font-semibold">{t('topics.title')}</h1>
            <p className="mt-2 muted">{t('topics.text')}</p>
            <div className="mt-4 max-h-[50vh] overflow-y-auto">
              <TopicPicker topics={topics.filter((x) => !x.parentId)} value={prefs.topics} onChange={(v) => setPrefs({ ...prefs, topics: v })} columns />
            </div>
          </>
        )}
        {step === 5 && (
          <p className="text-lg">
            {t('hook')} <Link href="/trust">→</Link>
          </p>
        )}
        <div className="mt-8 flex items-center justify-between">
          <span className="text-sm muted" aria-hidden="true">{step + 1} / 6</span>
          {step < 5 ? <button className="btn" onClick={() => setStep(step + 1)}>{t('next')}</button> : <button className="btn btn-accent" onClick={finish}>{t('start')}</button>}
        </div>
      </div>
    </div>
  );
}
