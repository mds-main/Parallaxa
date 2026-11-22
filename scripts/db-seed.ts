/**
 * Seeds demo content for local development and previews: today's briefing editions built from
 * simulated analyses. Refuses to run against a real AI key or production database unless --force.
 */
import { getDb } from '../src/lib/db/client';
import { generateEdition } from '../src/lib/briefing/generate';
import { isDemoMode } from '../src/lib/ai/client';

async function main() {
  if ((!isDemoMode() || process.env.DATABASE_URL) && !process.argv.includes('--force')) {
    console.error('Refusing to seed demo content outside demo mode. Pass --force to override.');
    process.exit(1);
  }
  await getDb();
  for (const place of ['GLOBAL', 'ES', 'US', 'ES-MD', 'ES-AN', 'ES-CT']) {
    const r = await generateEdition(place, { force: true });
    console.log(place, r);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
