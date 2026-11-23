/**
 * The public address of the site. NEXT_PUBLIC_SITE_URL wins when set; otherwise Vercel's system variables:
 * production uses the project's production domain (shortest custom domain, else *.vercel.app), other deployments
 * use the address the request came in on (so sign-in links and passkeys match it), then the deployment's own URL.
 */
export function siteUrl(requestOrigin?: string): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (process.env.VERCEL_ENV === 'production' && production) return `https://${production}`;
  if (requestOrigin) return requestOrigin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}
