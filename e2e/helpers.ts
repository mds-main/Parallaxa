import type { Page } from '@playwright/test';

/** Marks onboarding as done so tests start on the real page. */
export async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'plx:prefs:v1',
      JSON.stringify({ version: 1, places: [{ id: 'ES', mode: 'include', home: true }], global: true, topics: {}, follows: { analyses: [], actors: [] }, briefing: { stories: 5, time: '07:00', days: 'everyday', depth: 'standard', plain: false, outsideFilters: true }, notifications: { enabled: false }, onboarded: true }),
    );
  });
}
