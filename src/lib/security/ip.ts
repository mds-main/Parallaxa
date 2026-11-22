/** Client IP from Vercel's forwarding headers. Used only for allowlists and salted hashes, never stored raw. */
export function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return headers.get('x-real-ip') ?? '0.0.0.0';
}

export function ipAllowed(ip: string, allowlist: string | undefined): boolean {
  if (!allowlist || !allowlist.trim()) return true;
  return allowlist
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(ip);
}

/** Daily-salted SHA-256 of the IP (PRD 9.3: IPs only as daily-salted hashes, kept 7 days). */
export async function hashIp(ip: string, secret = process.env.ADMIN_SESSION_SECRET ?? 'parallaxa'): Promise<string> {
  const day = new Date().toISOString().slice(0, 10);
  const data = new TextEncoder().encode(`${day}:${secret}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
