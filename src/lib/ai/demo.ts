/**
 * Demo mode: a deterministic stand-in for the AI providers, used when VENICE_API_KEY is not set
 * (local development, tests, previews). Every analysis produced this way is labelled "Demo" in the UI.
 * It never invents quotes, and its sources are marked "[Demo]".
 */
import type { ChatRequest, ChatResponse } from './client';
import { GRADES, GRADE_SCALE, type Grade } from '../domain/types';
import { PLACE_KEYWORDS, TOPIC_KEYWORDS } from '../data/topics';

export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function lastUserText(req: ChatRequest): string {
  const m = [...req.messages].reverse().find((x) => x.role === 'user');
  if (!m) return '';
  if (typeof m.content === 'string') return m.content;
  return m.content.map((p) => (p.type === 'text' ? p.text : '')).join(' ');
}

function between(text: string, tag: string): string {
  const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return (m?.[1] ?? text).trim();
}

const response = (content: string, extra: Partial<ChatResponse> = {}): ChatResponse => ({
  provider: 'venice',
  model: 'demo',
  content,
  toolCalls: [],
  finishReason: 'stop',
  usage: { promptTokens: 0, completionTokens: 0 },
  costUsd: 0,
  citations: [],
  latencyMs: 5,
  ...extra,
});

export function scrubPii(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/(^|\s)@\w{2,}/g, '$1[handle]')
    .replace(/\+?\d[\d\s-]{8,}\d/g, '[phone]');
}

function classify(sentence: string): { type: 'fact' | 'value' | 'prediction' | 'attribution' | 'framing'; checkable: boolean } {
  const s = sentence.toLowerCase();
  if (/\b(should|must|ought|debería|deberían|tiene que|hay que)\b/.test(s)) return { type: 'value', checkable: false };
  if (/\b(will|going to|va a|van a|será|serán)\b/.test(s)) return { type: 'prediction', checkable: false };
  if (/\b(said|says|claimed|dijo|afirmó|declaró)\b/.test(s)) return { type: 'attribution', checkable: true };
  return { type: 'fact', checkable: true };
}

export function demoGradeFor(claim: string): Grade {
  const buckets: Grade[] = ['well_supported', 'well_supported', 'mostly_supported', 'mostly_supported', 'missing_context', 'mixed', 'mostly_unsupported', 'contradicted', 'contradicted', 'missing_context'];
  return buckets[hash(claim) % buckets.length]!;
}

function shift(grade: Grade, by: number): Grade {
  if (grade === 'not_checkable') return grade;
  const v = Math.max(0, Math.min(5, GRADE_SCALE[grade] + by));
  return (Object.entries(GRADE_SCALE).find(([, x]) => x === v)?.[0] ?? grade) as Grade;
}

function demoSources(claim: string) {
  const topic = matchKeywords(claim, TOPIC_KEYWORDS)[0] ?? 'economy';
  const es = /[áéíóúñ¿¡]|\b(el|la|los|las|de|que|en)\b/i.test(claim);
  const primary = es
    ? { url: 'https://www.ine.es/', title: '[Demo] Instituto Nacional de Estadística (INE)' }
    : { url: 'https://www.bls.gov/', title: '[Demo] U.S. Bureau of Labor Statistics' };
  return [
    { ...primary, tier: 1, stance: 'supports' as const },
    { url: 'https://ec.europa.eu/eurostat', title: `[Demo] Eurostat data on ${topic}`, tier: 1, stance: 'context' as const },
    { url: 'https://www.reuters.com/', title: '[Demo] Wire service report', tier: 2, stance: 'context' as const },
  ];
}

function matchKeywords(text: string, table: Record<string, string[]>): string[] {
  const t = ` ${text.toLowerCase()} `;
  return Object.entries(table)
    .filter(([, words]) => words.some((w) => t.includes(w)))
    .map(([id]) => id);
}

const TEMPLATES: Record<string, { en: string; 'es-ES': string }> = {
  true: { en: 'Official statistics confirm the main figure in the claim.', 'es-ES': 'Las estadísticas oficiales confirman la cifra principal de la afirmación.' },
  missing: { en: 'The claim leaves out how the figure compares with earlier years.', 'es-ES': 'La afirmación no explica cómo se compara la cifra con años anteriores.' },
  wrong: { en: 'The most recent official data does not match the figure given.', 'es-ES': 'Los datos oficiales más recientes no coinciden con la cifra indicada.' },
  reason1: { en: 'Investigators checked primary statistics first [1].', 'es-ES': 'Los investigadores consultaron primero las estadísticas oficiales [1].' },
  reason2: { en: 'They compared the figure with the official series over time [2].', 'es-ES': 'Compararon la cifra con la serie oficial a lo largo del tiempo [2].' },
  reason3: { en: 'A wire-service report gave context on how it is measured [3].', 'es-ES': 'Una agencia de noticias aportó contexto sobre cómo se mide [3].' },
  conf: { en: 'Several primary sources agree, and the investigators reached similar verdicts.', 'es-ES': 'Varias fuentes primarias coinciden y los investigadores llegaron a veredictos parecidos.' },
  confLow: { en: 'The investigators disagreed, so a person will review this analysis.', 'es-ES': 'Los investigadores no coincidieron, así que una persona revisará este análisis.' },
};

function t(key: string, lang: string): string {
  const v = TEMPLATES[key];
  return v ? (lang === 'es-ES' ? v['es-ES'] : v.en) : key;
}

const HEADLINE: Record<Grade, { en: string; 'es-ES': string }> = {
  well_supported: { en: 'Well supported by the evidence', 'es-ES': 'Bien respaldada por las pruebas' },
  mostly_supported: { en: 'Mostly supported, with small inaccuracies', 'es-ES': 'Mayormente respaldada, con pequeñas imprecisiones' },
  missing_context: { en: 'Accurate, but missing important context', 'es-ES': 'Exacta, pero le falta contexto importante' },
  mixed: { en: 'The evidence points both ways', 'es-ES': 'Las pruebas apuntan en ambas direcciones' },
  mostly_unsupported: { en: 'Mostly not supported by the evidence', 'es-ES': 'Mayormente sin respaldo en las pruebas' },
  contradicted: { en: 'Contradicted by the evidence', 'es-ES': 'Contradicha por las pruebas' },
  not_checkable: { en: 'Not checkable yet', 'es-ES': 'Aún no se puede comprobar' },
};

export function demoRespond(step: string, req: ChatRequest): ChatResponse {
  const text = lastUserText(req);
  const kind = step.split(':')[0];

  switch (kind) {
    case 'canonicalize': {
      const input = scrubPii(between(text, 'user_input'));
      const sentences = input
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 12)
        .slice(0, 5);
      const claims = (sentences.length ? sentences : [input.slice(0, 280)]).map((s) => ({ canonical: s.replace(/\s+/g, ' '), ...classify(s) }));
      return response(JSON.stringify({ claims, sourceLanguage: /[áéíóúñ¿¡]/i.test(input) ? 'es' : 'en' }));
    }
    case 'tag': {
      const claim = between(text, 'claim');
      const places = matchKeywords(claim, PLACE_KEYWORDS).map((id) => ({ id, confidence: 0.7 }));
      const topics = matchKeywords(claim, TOPIC_KEYWORDS)
        .slice(0, 3)
        .map((id) => ({ id, confidence: 0.7 }));
      return response(JSON.stringify({ places: places.length ? places : [{ id: 'GLOBAL', confidence: 0.4 }], topics: topics.length ? topics : [{ id: 'culture', confidence: 0.3 }] }));
    }
    case 'investigate': {
      const slot = step.split(':')[1] ?? 'X';
      const claim = between(text, 'claim');
      const base = demoGradeFor(claim);
      const h = hash(claim + slot);
      const disagree = hash(claim) % 5 === 0 && slot === 'CN';
      const grade = disagree ? shift(base, base === 'contradicted' ? 2 : -2) : h % 4 === 0 ? shift(base, h % 8 === 0 ? 1 : -1) : base;
      const args = {
        grade,
        confidence: h % 3 === 0 ? 'medium' : 'high',
        confidenceReason: 'Demo mode: simulated investigation.',
        reasoning: ['Demo mode: this verdict is simulated, not a real investigation.'],
        techniques: grade === 'missing_context' ? ['cherry_picked_window'] : [],
        abstain: false,
        sources: demoSources(claim),
      };
      return response('', {
        finishReason: 'tool_calls',
        toolCalls: [{ id: `call_${h}`, type: 'function', function: { name: 'submit_verdict', arguments: JSON.stringify(args) } }],
      });
    }
    case 'compose': {
      const grade = (text.match(/combined grade: (\w+)/)?.[1] ?? 'mixed') as Grade;
      const disagreement = /disagreement: true/.test(text);
      const supported = ['well_supported', 'mostly_supported', 'missing_context'].includes(grade);
      return response(
        JSON.stringify({
          whatsTrue: supported ? ['TPL:true'] : [],
          whatsMissing: grade === 'missing_context' || grade === 'mixed' ? ['TPL:missing'] : [],
          whatsWrong: supported ? [] : ['TPL:wrong'],
          sidesRight: { left: [], right: [] },
          reasoning: ['TPL:reason1', 'TPL:reason2', 'TPL:reason3'],
          confidenceReason: disagreement ? 'TPL:confLow' : 'TPL:conf',
        }),
      );
    }
    case 'mirror': {
      const claim = between(text, 'claim');
      const swapped = claim
        .replace(/left-wing/gi, '§R').replace(/right-wing/gi, 'left-wing').replace(/§R/g, 'right-wing')
        .replace(/izquierda/gi, '§D').replace(/derecha/gi, 'izquierda').replace(/§D/g, 'derecha');
      return response(swapped === claim ? '' : swapped);
    }
    case 'render': {
      const lang = step.split(':')[1] ?? 'en';
      const src = JSON.parse(between(text, 'analysis')) as {
        grade: Grade; claim: string; whatsTrue: string[]; whatsMissing: string[]; whatsWrong: string[];
        sidesRight: { left: string[]; right: string[] }; reasoning: string[]; confidenceReason: string;
        valuesPositions?: { label: string; steelman: string }[];
      };
      const tr = (s: string) => (s.startsWith('TPL:') ? t(s.slice(4), lang) : s);
      const head = HEADLINE[src.grade] ?? HEADLINE.mixed;
      return response(
        JSON.stringify({
          headline: lang === 'es-ES' ? head['es-ES'] : head.en,
          summary: `${lang === 'es-ES' ? '[Demo] Análisis simulado de' : '[Demo] Simulated analysis of'}: “${src.claim.slice(0, 160)}”`,
          whatsTrue: src.whatsTrue.map(tr),
          whatsMissing: src.whatsMissing.map(tr),
          whatsWrong: src.whatsWrong.map(tr),
          sidesRight: { left: src.sidesRight.left.map(tr), right: src.sidesRight.right.map(tr) },
          reasoning: src.reasoning.map(tr),
          confidenceReason: tr(src.confidenceReason),
          valuesPositions: src.valuesPositions,
        }),
      );
    }
    case 'consistency':
      return response(JSON.stringify({ ok: true }));
    case 'pushback': {
      const lang = step.split(':')[1] ?? 'en';
      return response(
        lang === 'es-ES'
          ? '[Demo] En modo demostración las respuestas son simuladas. Con una clave de Venice configurada, aquí recibirías una respuesta con pruebas y fuentes, y se reconocería cualquier punto en el que tengas razón.'
          : '[Demo] In demo mode replies are simulated. With a Venice key configured, you would get an evidence-based answer with sources here, and any point where you are right would be acknowledged.',
      );
    }
    case 'ocr':
      return response('[Demo] Text extraction from images is simulated in demo mode.');
    case 'health':
      return response('ok');
    default:
      return response('{}');
  }
}

export { GRADES };
