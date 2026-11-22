import { expect, test } from '@playwright/test';

const ADMIN_ROUTES = ['', '/models', '/investigation', '/pipeline', '/limits', '/content', '/review', '/ledger', '/metrics', '/alerts', '/audit'];

// TODO 22.5: every admin page and API rejects requests without a session.
for (const r of ADMIN_ROUTES) {
  test(`admin${r || ' overview'} redirects to sign-in without a session`, async ({ request }) => {
    const res = await request.get(`/en/admin${r}`, { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toContain('/en/admin/login');
  });
}

test('admin CSV exports require a session', async ({ request }) => {
  expect((await request.get('/api/admin/audit.csv')).status()).toBe(401);
  expect((await request.get('/api/admin/metrics.csv')).status()).toBe(401);
});

test('cron routes require the cron secret', async ({ request }) => {
  expect((await request.get('/api/cron/health')).status()).toBe(401);
});

test('sign in, see the overview and the three model slots', async ({ page }) => {
  await page.goto('/en/admin/login');
  await page.getByLabel('Username').fill('e2e-admin');
  await page.getByLabel('Password').fill('wrong-password-attempt-1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Wrong username or password.')).toBeVisible();
  await page.getByLabel('Password').fill('e2e-password-0123456789-abcdef');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Is everything OK?' })).toBeVisible();
  await page.getByRole('link', { name: 'Models', exact: true }).click();
  await expect(page.getByText('Grok 4.7', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('GPT-6.2 Sol', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('DeepSeek V4 Pro', { exact: true }).first()).toBeVisible();
});
