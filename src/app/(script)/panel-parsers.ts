import { NovelAnalysis, OutlineEntry } from '@/lib/types';

function sanitizeJsonLike(raw: string): string {
  let text = raw.trim();
  const fencedBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedBlock) {
    text = fencedBlock[1].trim();
  }

  text = text
    .replace(/^\uFEFF/, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,\s*([}\]])/g, '$1');

  if (text.includes("'")) {
    text = text
      .replace(/([{,]\s*)'([^']+?)'\s*:/g, '$1"$2":')
      .replace(/:\s*'([^']*?)'(\s*[},\]])/g, ': "$1"$2');
  }

  return text.trim();
}

function parseJsonLike<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return JSON.parse(sanitizeJsonLike(raw)) as T;
  }
}

export function parseAnalysisPayload(raw: string): NovelAnalysis {
  return parseJsonLike<NovelAnalysis>(raw);
}

export function parseOutlinePayload(raw: string): OutlineEntry[] {
  const parsed = parseJsonLike<OutlineEntry[] | { episodes?: OutlineEntry[] }>(raw);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed.episodes && Array.isArray(parsed.episodes)) {
    return parsed.episodes;
  }
  throw new Error('大纲 JSON 结构不符合预期');
}
