import { cleanText, splitChapters } from '@/lib/preprocessor';
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

  const targetChunkSize = Math.max(2500, Math.ceil(text.length / complexityInfo.chunkCount));
  const chapterChunks = buildChapterPriorityChunks(text, targetChunkSize);
  if (chapterChunks.length > 0) {
    return chapterChunks.map((chunk, index) => toChunk(index + 1, chunk));
  }

  const paragraphChunks = buildParagraphChunks(text, targetChunkSize);
  return paragraphChunks.length > 0
    ? paragraphChunks.map((chunk, index) => toChunk(index + 1, chunk))
    : [toChunk(1, text)];
}

function buildChapterPriorityChunks(text: string, targetChunkSize: number) {
  const chapters = splitChapters(text);
  if (!hasStructuredChapterBoundaries(chapters)) {
    return [];
  }

  const chunks: string[] = [];
  let buffer = '';

  for (const chapter of chapters) {
    const content = chapter.content.trim();
    if (!content) {
      continue;
    }

    if (content.length > targetChunkSize * 1.35) {
      if (buffer) {
        chunks.push(buffer);
        buffer = '';
      }

      chunks.push(...splitOversizedChapter(content, targetChunkSize));
      continue;
    }

    const candidate = buffer ? `${buffer}\n\n${content}` : content;
    if (candidate.length > targetChunkSize && buffer) {
      chunks.push(buffer);
      buffer = content;
      continue;
    }

    buffer = candidate;
  }

  if (buffer) {
    chunks.push(buffer);
  }

  return chunks;
}

function buildParagraphChunks(text: string, targetChunkSize: number) {
  const paragraphs = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buffer = '';

  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (candidate.length > targetChunkSize && buffer) {
      chunks.push(buffer);
      buffer = paragraph;
      continue;
    }
    buffer = candidate;
  }

  if (buffer) {
    chunks.push(buffer);
  }

  return chunks;
}

function hasStructuredChapterBoundaries(
  chapters: ReturnType<typeof splitChapters>
) {
  return chapters.length > 1 && chapters.some((chapter) => !/^段落 \d+$/.test(chapter.title));
}

function splitOversizedChapter(content: string, targetChunkSize: number) {
  const paragraphs = content.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  if (paragraphs.length <= 1) {
    return [content];
  }

  const [heading, ...bodyParagraphs] = paragraphs;
  const chunks: string[] = [];
  let buffer = heading;

  for (const paragraph of bodyParagraphs) {
    const seededParagraph = `${heading}\n\n${paragraph}`;
    const candidate = buffer === heading ? seededParagraph : `${buffer}\n\n${paragraph}`;

    if (candidate.length > targetChunkSize && buffer !== heading) {
      chunks.push(buffer);
      buffer = seededParagraph;
      continue;
    }

    buffer = candidate;
  }

  if (buffer && buffer !== heading) {
    chunks.push(buffer);
  } else if (chunks.length === 0) {
    chunks.push(content);
  }

  return chunks;
}

function toChunk(index: number, text: string): StoryChunk {
  return {
    chunkId: `chunk-${String(index).padStart(2, '0')}`,
    index,
    text,
    charCount: text.length,
  };
}
