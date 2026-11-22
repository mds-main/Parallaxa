'use client';
import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { loadPreferences } from '@/lib/prefs/storage';

/** Sends first-time visitors to the ≤ 60 s onboarding (skippable, no sign-up). */
export function OnboardingGate() {
  const router = useRouter();
  useEffect(() => {
    const p = loadPreferences();
    const shared = new URLSearchParams(window.location.search).has('text');
    if (!p?.onboarded && !shared && !sessionStorage.getItem('plx:onboardingSkipped')) router.replace('/onboarding');
  }, [router]);
  return null;
}
