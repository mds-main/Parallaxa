/** JSON schemas for structured outputs and a tolerant parser. */
import { CLAIM_TYPES, CONFIDENCES, GRADES, TECHNIQUES } from '../domain/types';

export function parseJson<T>(content: string): T {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const start = trimmed.search(/[[{]/);
  return JSON.parse(start > 0 ? trimmed.slice(start) : trimmed) as T;
}

const str = { type: 'string' };
const strArr = { type: 'array', items: str };

export const CANONICALIZE_SCHEMA = {
  name: 'claims',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['claims'],
    properties: {
      claims: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['canonical', 'local', 'type', 'checkable'],
          properties: { canonical: str, local: str, type: { type: 'string', enum: [...CLAIM_TYPES] }, checkable: { type: 'boolean' } },
        },
      },
      sourceLanguage: str,
    },
  },
};

const tagItem = { type: 'object', additionalProperties: false, required: ['id', 'confidence'], properties: { id: str, confidence: { type: 'number' } } };
export const TAG_SCHEMA = {
  name: 'tags',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['places', 'topics', 'placeNeeded'],
    properties: { places: { type: 'array', items: tagItem }, topics: { type: 'array', items: tagItem }, placeNeeded: { type: 'boolean' } },
  },
};

export const VERDICT_PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  required: ['grade', 'confidence', 'confidenceReason', 'reasoning', 'sources', 'abstain', 'techniques'],
  properties: {
    grade: { type: 'string', enum: [...GRADES] },
    confidence: { type: 'string', enum: [...CONFIDENCES] },
    confidenceReason: str,
    reasoning: strArr,
    techniques: { type: 'array', items: { type: 'string', enum: [...TECHNIQUES] } },
    abstain: { type: 'boolean' },
    abstainReason: str,
    sources: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['url', 'title', 'tier', 'stance'],
        properties: {
          url: str,
          title: str,
          tier: { type: 'integer', enum: [1, 2, 3, 4] },
          stance: { type: 'string', enum: ['supports', 'contradicts', 'context'] },
          quote: str,
          publishedAt: str,
        },
      },
    },
  },
};

export const COMPOSE_SCHEMA = {
  name: 'analysis',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['whatsTrue', 'whatsMissing', 'whatsWrong', 'sidesRight', 'reasoning', 'confidenceReason'],
    properties: {
      whatsTrue: strArr,
      whatsMissing: strArr,
      whatsWrong: strArr,
      sidesRight: { type: 'object', additionalProperties: false, required: ['left', 'right'], properties: { left: strArr, right: strArr } },
      reasoning: strArr,
      confidenceReason: str,
      valuesPositions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['label', 'steelman'], properties: { label: str, steelman: str } } },
      moralFrames: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['foundation', 'text'], properties: { foundation: { type: 'string', enum: ['care', 'fairness', 'liberty', 'loyalty', 'authority'] }, text: str } } },
    },
  },
};

export const RENDER_SCHEMA = {
  name: 'rendered',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['headline', 'summary', 'whatsTrue', 'whatsMissing', 'whatsWrong', 'sidesRight', 'reasoning', 'confidenceReason'],
    properties: {
      headline: str,
      summary: str,
      whatsTrue: strArr,
      whatsMissing: strArr,
      whatsWrong: strArr,
      sidesRight: { type: 'object', additionalProperties: false, required: ['left', 'right'], properties: { left: strArr, right: strArr } },
      reasoning: strArr,
      confidenceReason: str,
      valuesPositions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['label', 'steelman'], properties: { label: str, steelman: str } } },
      moralFrames: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['foundation', 'text'], properties: { foundation: str, text: str } } },
    },
  },
};

export const CONSISTENCY_SCHEMA = {
  name: 'consistency',
  schema: { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' }, notes: str } },
};
