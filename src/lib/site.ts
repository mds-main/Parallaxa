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

/**
 * In production, the canonical address when a request arrived on another one (an older alias or a deployment
 * URL), else null. Passkeys are bound to one host, so production pages are served from that host only.
 */
export function canonicalRedirect(requestHost: string | null): string | null {
  if (process.env.VERCEL_ENV !== 'production' || !requestHost) return null;
  const canonical = new URL(siteUrl());
  return canonical.host === requestHost.toLowerCase() ? null : canonical.origin;
}
