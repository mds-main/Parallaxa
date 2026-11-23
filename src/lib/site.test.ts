import { afterEach, describe, expect, it } from 'vitest';
import { siteUrl } from './site';

const KEYS = ['NEXT_PUBLIC_SITE_URL', 'VERCEL_ENV', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL'] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of KEYS) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
});
const set = (env: Partial<Record<(typeof KEYS)[number], string>>) => {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, env);
};

describe('siteUrl', () => {
  it('prefers an explicit site URL', () => {
    set({ NEXT_PUBLIC_SITE_URL: 'https://parallaxa.org/', VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'parallaxa.vercel.app' });
    expect(siteUrl('https://x.test')).toBe('https://parallaxa.org');
  });
  it("uses Vercel's production domain in production", () => {
    set({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'parallaxa.vercel.app', VERCEL_URL: 'parallaxa-abc.vercel.app' });
    expect(siteUrl('https://parallaxa-abc.vercel.app')).toBe('https://parallaxa.vercel.app');
  });
  it('uses the request address, then the deployment URL, on previews', () => {
    set({ VERCEL_ENV: 'preview', VERCEL_PROJECT_PRODUCTION_URL: 'parallaxa.vercel.app', VERCEL_URL: 'parallaxa-git-x.vercel.app' });
    expect(siteUrl('https://parallaxa-git-x-team.vercel.app')).toBe('https://parallaxa-git-x-team.vercel.app');
    expect(siteUrl()).toBe('https://parallaxa-git-x.vercel.app');
  });
  it('falls back to localhost', () => {
    set({});
    expect(siteUrl()).toBe('http://localhost:3000');
  });
});
