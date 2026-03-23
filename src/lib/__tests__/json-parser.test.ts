import { describe, expect, it } from 'vitest';
import { parseJsonLike, parseJsonResponse } from '@/lib/json-parser';

describe('parseJsonResponse', () => {
  it('parses direct json', () => {
    expect(parseJsonResponse<{ a: number }>('{ "a": 1 }')).toEqual({ a: 1 });
  });

  it('parses fenced json blocks', () => {
    expect(parseJsonResponse<{ a: number }>('```json\n{ "a": 1 }\n```')).toEqual({ a: 1 });
  });

  it('parses trailing commas and comments', () => {
    const input = `{
      // note
      "a": 1,
      "list": [1, 2, 3,],
    }`;

    expect(parseJsonResponse<{ a: number; list: number[] }>(input)).toEqual({
      a: 1,
      list: [1, 2, 3],
    });
  });

  it('parses common single-quoted pseudo-json', () => {
    expect(parseJsonResponse<{ a: string; b: number }>(`{'a': 'x', 'b': 2}`)).toEqual({
      a: 'x',
      b: 2,
    });
  });
});

describe('parseJsonLike', () => {
  it('returns failure when parsing is impossible', () => {
    const result = parseJsonLike<{ a: number }>('not valid json');
    expect(result.ok).toBe(false);
  });
});
