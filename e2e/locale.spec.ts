import { expect, test } from '@playwright/test';

// PRD F7 acceptance criteria: language from browser settings, English fallback.
for (const [header, expected] of [
  ['es-MX,es;q=0.9', '/es'],
  ['ca,es;q=0.8,en;q=0.5', '/es'],
  ['en-GB', '/en'],
  ['fr-FR,de;q=0.8', '/en'],
] as const) {
  test(`Accept-Language "${header}" → ${expected}`, async ({ request }) => {
    const res = await request.get('/', { headers: { 'Accept-Language': header }, maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(new URL(res.headers()['location']!, 'http://x').pathname).toBe(expected);
  });
}

test('a saved choice beats the browser language', async ({ request }) => {
  const res = await request.get('/', { headers: { 'Accept-Language': 'en', Cookie: 'NEXT_LOCALE=es-ES' }, maxRedirects: 0 });
  expect(new URL(res.headers()['location']!, 'http://x').pathname).toBe('/es');
});

test('pages carry the right lang attribute and hreflang alternates', async ({ page }) => {
  await page.goto('/es/trust');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-ES');
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute('href', /\/en$/);
});
