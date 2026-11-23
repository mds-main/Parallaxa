import { expect, test } from '@playwright/test';
import { skipOnboarding } from './helpers';

test('optional account: create one with a passkey (no email), sync, sign out and sign back in', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Uses the Chromium virtual authenticator');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });

  await skipOnboarding(page);
  await page.goto('/en/account');
  await expect(page.getByLabel('Email address')).toHaveCount(0);
  await page.getByRole('button', { name: 'Create an account with a passkey' }).click();
  await expect(page.getByText('You are signed in.')).toBeVisible();
  await page.getByRole('button', { name: "Save this device's settings to my account" }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Done.' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();

  await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
  await expect(page.getByText('You are signed in.')).toBeVisible();
});
