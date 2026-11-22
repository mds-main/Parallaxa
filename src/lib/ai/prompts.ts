/** Loads published prompts from prompts/<lang>/<name>.md (TODO 10.5), with fallback to English and a content hash. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DEFAULT_LOCALE } from '../../i18n/languages';

export type PromptName = 'canonicalize' | 'tag' | 'investigate' | 'compose' | 'mirror' | 'render' | 'consistency' | 'pushback' | 'ocr';

const cache = new Map<string, string>();

export function loadPrompt(name: PromptName, lang: string = DEFAULT_LOCALE, vars: Record<string, string | number> = {}): { text: string; hash: string } {
  const key = `${lang}/${name}`;
  let raw = cache.get(key);
  if (raw === undefined) {
    const base = path.join(process.cwd(), 'prompts');
    const file = [path.join(base, lang, `${name}.md`), path.join(base, DEFAULT_LOCALE, `${name}.md`)].find((f) => fs.existsSync(f));
    if (!file) throw new Error(`Prompt ${name} not found`);
    raw = fs.readFileSync(file, 'utf8');
    cache.set(key, raw);
  }
  const text = raw.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? `{{${k}}}`));
  return { text, hash: createHash('sha256').update(raw).digest('hex').slice(0, 12) };
}
