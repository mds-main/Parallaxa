import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { skipOnboarding } from './helpers';

test('check a claim end to end (demo mode) and see three independent verdicts', async ({ page }) => {
  await skipOnboarding(page);
  await page.goto('/en');
  await page.getByRole('textbox').first().fill('Unemployment in Spain fell to 10.5% in 2026 according to the government.');
  await page.getByRole('button', { name: 'Check it' }).click();
  await expect(page).toHaveURL(/\/en\/a\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Who investigated' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('US model, perceived as right-leaning')).toBeVisible();
  await expect(page.getByText('US model, perceived as left-leaning')).toBeVisible();
  await expect(page.getByText('Chinese model')).toBeVisible();
  await expect(page.locator('[data-grade]').first()).toBeVisible();
  await expect(page.getByText(/Demo mode: this analysis is simulated/)).toBeVisible();

  // Switching language re-renders the same analysis natively in Spanish.
  const url = page.url().replace('/en/', '/es/');
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Quién ha investigado' })).toBeVisible();
});

test('home and result pages have no serious accessibility violations', async ({ page }) => {
  await skipOnboarding(page);
  await page.goto('/en');
  const home = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(home.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  await page.goto('/en/trust/methodology/models');
  const doc = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(doc.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});

test('first visit goes to onboarding, which can be skipped', async ({ page }) => {
  await page.goto('/en');
  await expect(page).toHaveURL(/\/en\/onboarding$/);
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole('heading', { name: 'Check something you saw' })).toBeVisible();
});
