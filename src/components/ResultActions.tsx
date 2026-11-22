'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { loadPreferences, savePreferences } from '@/lib/prefs/storage';
import { defaultPreferences } from '@/lib/prefs/types';
import { PushBack } from './PushBack';
import { ReportError } from './ReportError';

export function ResultActions({ analysisId, version, pushBackEnabled, maxTurns }: { analysisId: string; version: number; pushBackEnabled: boolean; maxTurns: number }) {
  const t = useTranslations('result.actions');
  const [panel, setPanel] = useState<'push' | 'report' | null>(null);
  const [copied, setCopied] = useState(false);
  const [following, setFollowing] = useState(() => (typeof window !== 'undefined' ? Boolean(loadPreferences()?.follows.analyses.includes(analysisId)) : false));

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {
        /* cancelled */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleFollow() {
    const p = loadPreferences() ?? defaultPreferences();
    const set = new Set(p.follows.analyses);
    if (set.has(analysisId)) set.delete(analysisId);
    else set.add(analysisId);
    savePreferences({ ...p, follows: { ...p.follows, analyses: [...set] } });
    setFollowing(set.has(analysisId));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={() => setPanel(panel === 'push' ? null : 'push')} aria-expanded={panel === 'push'}>
          {t('pushBack')}
        </button>
        <button className="btn btn-ghost" onClick={() => setPanel(panel === 'report' ? null : 'report')} aria-expanded={panel === 'report'}>
          {t('report')}
        </button>
        <button className="btn btn-ghost" onClick={share}>
          {copied ? t('copied') : t('share')}
        </button>
        <button className="btn btn-ghost" onClick={toggleFollow} aria-pressed={following}>
          {following ? t('following') : t('follow')}
        </button>
      </div>
      {panel === 'push' && <PushBack analysisId={analysisId} enabled={pushBackEnabled} maxTurns={maxTurns} />}
      {panel === 'report' && <ReportError analysisId={analysisId} version={version} />}
    </div>
  );
}
