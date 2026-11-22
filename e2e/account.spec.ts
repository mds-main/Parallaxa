import { expect, test } from '@playwright/test';
import { skipOnboarding } from './helpers';

test('optional account: magic-link sign-in (development link), then sign out', async ({ page }) => {
  await skipOnboarding(page);
  await page.goto('/en/account');
  await page.getByLabel('Email address').fill(`reader-${test.info().project.name}-${Date.now()}@example.org`);
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await page.getByRole('link', { name: 'Development mode: open the sign-in link' }).click();
  await expect(page.getByRole('heading', { name: 'Finish signing in' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('You are signed in.')).toBeVisible();
  await page.getByRole('button', { name: "Save this device's settings to my account" }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Done.' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByLabel('Email address')).toBeVisible();
});
