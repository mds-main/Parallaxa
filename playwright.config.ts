import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: /admin\.spec/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm build && pnpm start -p ${PORT}`,
        port: PORT,
        timeout: 300_000,
        reuseExistingServer: !process.env.CI,
        env: {
          ADMIN_USERNAME: 'e2e-admin',
          ADMIN_PASSWORD: 'e2e-password-0123456789-abcdef',
          ADMIN_SESSION_SECRET: 'e2e-session-secret-0123456789-abcdefghijklmnop',
          PARALLAXA_DB: 'memory',
          USER_SESSION_SECRET: 'e2e-user-session-secret-0123456789-abcdefghij',
          AUTH_DEV_LINKS: '1',
        },
      },
});
