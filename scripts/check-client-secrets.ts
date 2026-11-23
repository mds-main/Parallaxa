/**
 * TODO 24.3: fails if a server-only secret name or value appears in the browser bundles (.next/static).
 * Run after `pnpm build`.
 */
import fs from 'node:fs';
import path from 'node:path';

const SECRET_NAMES = ['VENICE_API_KEY', 'AI_GATEWAY_API_KEY', 'ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET', 'USER_SESSION_SECRET', 'EMAIL_HASH_SECRET', 'DATA_ENCRYPTION_KEY', 'VAPID_PRIVATE_KEY', 'RESEND_API_KEY', 'CRON_SECRET', 'VERCEL_API_TOKEN', 'DATABASE_URL', 'BRAVE_SEARCH_API_KEY', 'EXA_API_KEY', 'NEON_API_KEY'];
const values = SECRET_NAMES.map((n) => process.env[n]).filter((v): v is string => Boolean(v && v.length >= 8));

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

const files = walk(path.join(process.cwd(), '.next', 'static')).filter((f) => /\.(js|css|json|html)$/.test(f));
if (!files.length) {
  console.error('No build output found: run `pnpm build` first.');
  process.exit(1);
}
const problems: string[] = [];
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  for (const n of SECRET_NAMES) if (text.includes(n)) problems.push(`${path.relative(process.cwd(), f)} mentions ${n}`);
  for (const v of values) if (text.includes(v)) problems.push(`${path.relative(process.cwd(), f)} contains a secret value`);
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`No server secrets in ${files.length} client files.`);
