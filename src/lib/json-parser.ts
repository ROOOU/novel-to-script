export interface JsonParseSuccess<T> {
  ok: true;
  value: T;
  normalized: string;
}

export interface JsonParseFailure {
  ok: false;
  error: string;
}

export type JsonParseResult<T> = JsonParseSuccess<T> | JsonParseFailure;

function stripCodeFences(input: string): string {
  const fencedMatch = input.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fencedMatch ? fencedMatch[1] : input;
}

function stripComments(input: string): string {
  let result = '';
  let inString = false;
  let quote = '';

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    const previous = input[index - 1];

    if (!inString && char === '/' && next === '/') {
      while (index < input.length && input[index] !== '\n') {
        index += 1;
      }
      result += '\n';
      continue;
    }

    if (!inString && char === '/' && next === '*') {
      index += 2;
      while (index < input.length && !(input[index] === '*' && input[index + 1] === '/')) {
        index += 1;
      }
      index += 1;
      continue;
    }

    if ((char === '"' || char === '\'') && previous !== '\\') {
      if (!inString) {
        inString = true;
        quote = char;
      } else if (quote === char) {
        inString = false;
        quote = '';
      }
    }

    result += char;
  }

  return result;
}

function normalizeSingleQuotes(input: string): string {
  return input.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, content: string) => {
    const normalized = content.replace(/"/g, '\\"');
    return `"${normalized}"`;
  });
}

function quoteBareKeys(input: string): string {
  return input.replace(/([{,]\s*)([A-Za-z_][\w-]*)(\s*:)/g, '$1"$2"$3');
}

function removeTrailingCommas(input: string): string {
  return input.replace(/,\s*([}\]])/g, '$1');
}

function buildCandidates(input: string): string[] {
  const trimmed = input.trim().replace(/^\uFEFF/, '');
  const unfenced = stripCodeFences(trimmed).trim();
  const uncommented = stripComments(unfenced).trim();
  const normalizedQuotes = normalizeSingleQuotes(uncommented);
  const normalizedKeys = quoteBareKeys(normalizedQuotes);
  const withoutTrailingCommas = removeTrailingCommas(normalizedKeys);

  return Array.from(new Set([
    trimmed,
    unfenced,
    uncommented,
    normalizedQuotes,
    normalizedKeys,
    withoutTrailingCommas,
  ].filter(Boolean)));
}

export function parseJsonLike<T>(input: string): JsonParseResult<T> {
  const candidates = buildCandidates(input);
  let lastError = '未知 JSON 解析错误';

  for (const candidate of candidates) {
    try {
      return {
        ok: true,
        value: JSON.parse(candidate) as T,
        normalized: candidate,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : '未知 JSON 解析错误';
    }
  }

  return {
    ok: false,
    error: lastError,
  };
}

export function parseJsonResponse<T>(input: string): T {
  const result = parseJsonLike<T>(input);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.value;
}
