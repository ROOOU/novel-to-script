import { cleanText } from '@/lib/preprocessor';
import type { ComplexityInfo } from '@/lib/types';

export interface StoryChunk {
  chunkId: string;
  index: number;
  text: string;
  charCount: number;
}

export function buildStoryChunks(
  rawText: string,
  complexityInfo: ComplexityInfo
): StoryChunk[] {
  const text = cleanText(rawText);
  if (!text) {
    return [];
  }

  if (complexityInfo.recommendedExecutionMode === 'direct' || complexityInfo.chunkCount <= 1) {
    return [
      {
        chunkId: 'chunk-01',
        index: 1,
        text,
        charCount: text.length,
      },
    ];
  }

  const paragraphs = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const targetChunkSize = Math.max(2500, Math.ceil(text.length / complexityInfo.chunkCount));
  const chunks: StoryChunk[] = [];
  let buffer = '';

  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (candidate.length > targetChunkSize && buffer) {
      chunks.push(toChunk(chunks.length + 1, buffer));
      buffer = paragraph;
      continue;
    }
    buffer = candidate;
  }

  if (buffer) {
    chunks.push(toChunk(chunks.length + 1, buffer));
  }

  return chunks.length > 0 ? chunks : [toChunk(1, text)];
}

function toChunk(index: number, text: string): StoryChunk {
  return {
    chunkId: `chunk-${String(index).padStart(2, '0')}`,
    index,
    text,
    charCount: text.length,
  };
}
