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

test('switch AI vendors from the Models page', async ({ page }) => {
  await page.goto('/en/admin/login');
  await page.getByLabel('Username').fill('e2e-admin');
  await page.getByLabel('Password').fill('e2e-password-0123456789-abcdef');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Is everything OK?' })).toBeVisible();
  await page.goto('/en/admin/models');
  const vendors = page.getByRole('region', { name: 'AI vendors' });
  await expect(vendors).toBeVisible();
  await expect(vendors.getByRole('radio', { name: 'Venice, with AI Gateway as backup', exact: true })).toBeChecked();

  // The test server has no AI Gateway key: making the Gateway primary is blocked with a clear reason.
  await vendors.getByRole('button', { name: 'Make AI Gateway the primary' }).click();
  await expect(vendors.getByRole('radio', { name: 'AI Gateway, with Venice as backup', exact: true })).toBeChecked();
  await expect(page.getByText("AI Gateway can't be the primary: AI_GATEWAY_API_KEY is not set.")).toBeVisible();
  await page.screenshot({ path: 'test-results/admin-vendors-blocked.png', fullPage: false });

  // Venice only needs no Gateway key: apply it as an audited change, then restore the default.
  for (const [mode, reason] of [['Venice only', 'E2E: turn the backup off'], ['Venice, with AI Gateway as backup', 'E2E: restore the default']] as const) {
    await vendors.getByRole('radio', { name: mode, exact: true }).check();
    await page.getByLabel('Why are you making this change?').fill(reason);
    await page.getByLabel('Affects the whole site. Type CONFIRM to apply.').fill('CONFIRM');
    await page.getByRole('button', { name: 'Apply changes' }).click();
    await expect(page.getByText('Applied. Live for new analyses within about 10 seconds.')).toBeVisible();
    await expect(vendors.getByRole('radio', { name: mode, exact: true })).toBeChecked();
    await expect(vendors.getByText(`Live now: ${mode}`)).toBeVisible();
  }
  await page.goto('/en/admin');
  await expect(page.getByText('Venice first · backup: AI Gateway')).toBeVisible();
});
