/** Tag accuracy eval (TODO 23.4): country ≥ 95%, topic ≥ 90% on the gold set. */
import { callModel } from '../ai/provider';
import { loadPrompt } from '../ai/prompts';
import { parseJson, TAG_SCHEMA } from '../ai/json';
import { TOPICS } from '../data/topics';
import type { AppConfig } from '../config/schema';
import { loadGoldSet } from './run';

export async function evalTags(config: AppConfig): Promise<{ n: number; country: number; topic: number }> {
  const gold = loadGoldSet().filter((g) => g.places?.length);
  let countryOk = 0;
  let topicOk = 0;
  const prompt = loadPrompt('tag', 'en', { topics: TOPICS.map((t) => t.id).join(', ') });
  for (const g of gold) {
    const res = await callModel({ step: 'tag', model: config.roles.tag, config, request: { messages: [{ role: 'system', content: prompt.text }, { role: 'user', content: `<claim>${g.claim}</claim>` }], responseSchema: TAG_SCHEMA, temperature: 0 } });
    const out = parseJson<{ places: { id: string }[]; topics: { id: string }[] }>(res.content);
    const countries = new Set(out.places.map((p) => p.id.toUpperCase().split('-')[0]));
    if (g.places!.every((p) => countries.has(p))) countryOk++;
    if (out.topics.some((t) => t.id === g.topic || t.id.split('.')[0] === g.topic)) topicOk++;
  }
  return { n: gold.length, country: gold.length ? countryOk / gold.length : 0, topic: gold.length ? topicOk / gold.length : 0 };
}
