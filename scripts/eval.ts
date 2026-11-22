/** Release gate (TODO 23.6): runs the gold set with the active configuration and compares with evals/baseline.json. */
import fs from 'node:fs';
import { getActiveConfig } from '../src/lib/config/store';
import { runEval } from '../src/lib/eval/run';
import { evalTags } from '../src/lib/eval/tags';

async function main() {
  const baseline = JSON.parse(fs.readFileSync('evals/baseline.json', 'utf8')) as { accuracy: number; parity: number; languageParity: number; maxAccuracyDrop: number };
  const { id, config } = await getActiveConfig();
  const m = await runEval({ config, configVersionId: id, kind: 'nightly', persist: false });
  console.log(JSON.stringify({ n: m.n, accuracy: m.accuracy, withinOne: m.withinOne, calibrationError: m.calibrationError, parity: m.parity, languageParity: m.languageParity, demo: m.demo }, null, 2));
  if (m.demo) {
    console.log('Demo mode (no VENICE_API_KEY): gate skipped.');
    return;
  }
  const tags = await evalTags(config);
  console.log(JSON.stringify({ tags }, null, 2));
  const problems: string[] = [];
  if (m.accuracy < baseline.accuracy - baseline.maxAccuracyDrop) problems.push(`accuracy ${m.accuracy.toFixed(3)} < ${baseline.accuracy}`);
  if (m.parity !== null && m.parity < baseline.parity) problems.push(`mirror parity ${m.parity} < ${baseline.parity}`);
  if (m.languageParity !== null && m.languageParity < baseline.languageParity) problems.push(`language parity ${m.languageParity} < ${baseline.languageParity}`);
  if (tags.country < 0.95) problems.push(`country tag accuracy ${tags.country.toFixed(2)} < 0.95`);
  if (tags.topic < 0.9) problems.push(`topic tag accuracy ${tags.topic.toFixed(2)} < 0.90`);
  if (problems.length) {
    console.error(`Release gate failed:\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log('Release gate passed.');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
