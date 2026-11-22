import { expect, test } from '@playwright/test';

/**
 * TODO 15.13: personalization never changes what an analysis says. Preferences live on the device and
 * are never sent to the server, so the server-rendered analysis is identical for every profile.
 */
test('the same analysis renders identically for different preference profiles', async ({ browser, request }) => {
  const res = await request.post('/api/check', { data: { kind: 'text', text: 'Housing prices in Madrid rose 12% in 2026 according to the INE.', lang: 'en' } });
  const { id } = (await res.json()) as { id: string };
  const profileA = await browser.newContext();
  const profileB = await browser.newContext();
  const prefs = (places: string[], topics: Record<string, string>) =>
    JSON.stringify({ version: 1, places: places.map((p, i) => ({ id: p, mode: 'include', home: i === 0 })), global: true, topics, follows: { analyses: [], actors: [] }, briefing: { stories: 5, time: '07:00', days: 'everyday', depth: 'standard', plain: false, outsideFilters: true }, notifications: { enabled: false }, onboarded: true });
  await profileA.addInitScript((v) => localStorage.setItem('plx:prefs:v1', v), prefs(['ES', 'ES-MD'], { housing: 'follow' }));
  await profileB.addInitScript((v) => localStorage.setItem('plx:prefs:v1', v), prefs(['US'], { housing: 'mute', immigration: 'follow' }));
  const [a, b] = [await profileA.newPage(), await profileB.newPage()];
  for (const p of [a, b]) {
    await p.goto(`/en/a/${id}`);
    await expect(p.getByRole('heading', { name: 'Who investigated' })).toBeVisible({ timeout: 30_000 });
  }
  const content = async (p: typeof a) => (await p.locator('article').innerText()).replace(/\s+/g, ' ');
  expect(await content(a)).toBe(await content(b));
  await profileA.close();
  await profileB.close();
});
