const DOCX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const SUPPORTED_TEXT_FILE_ACCEPT = [
  '.txt',
  '.md',
  '.docx',
  'text/plain',
  'text/markdown',
  ...DOCX_MIME_TYPES,
].join(',');

export function isSupportedTextFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    name.endsWith('.docx') ||
    file.type === 'text/plain' ||
    file.type === 'text/markdown' ||
    DOCX_MIME_TYPES.has(file.type)
  );
}

export async function readTextFile(file: File): Promise<string> {
  if (!isSupportedTextFile(file)) {
    throw new Error('UNSUPPORTED_TEXT_FILE');
  }

  if (isDocxFile(file)) {
    return extractDocxText(file);
  }

  return normalizeTextContent(await file.text());
}

export function getTextFileBaseName(filename: string): string {
  const trimmed = filename.trim();
  if (!trimmed) {
    return 'Uploaded source';
  }

  return trimmed.replace(/\.[^.]+$/, '');
}

export function getExportDateLabel(date: Date = new Date()): string {
  return date.toLocaleDateString();
}

export function buildDatedTextFilename(
  prefix: string,
  extension: 'txt' | 'json' = 'txt',
  date: Date = new Date()
): string {
  return `${prefix}_${getExportDateLabel(date)}.${extension}`;
}

export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isDocxFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.docx') || DOCX_MIME_TYPES.has(file.type);
}

function normalizeTextContent(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await loadMammoth();
  const arrayBuffer = await file.arrayBuffer();
  const result = typeof window === 'undefined'
    ? await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) })
    : await mammoth.extractRawText({ arrayBuffer });

  return normalizeTextContent(result.value).replace(/\n{3,}/g, '\n\n').trim();
}

type MammothInput = { buffer: Buffer } | { arrayBuffer: ArrayBuffer };

type MammothModule = {
  extractRawText: (input: MammothInput) => Promise<{ value: string }>;
};

async function loadMammoth(): Promise<MammothModule> {
  const mammothModule = await import('mammoth');
  const candidate = mammothModule as unknown as Partial<MammothModule> & { default?: MammothModule };

  if (typeof candidate.extractRawText === 'function') {
    return candidate as MammothModule;
  }

  if (candidate.default && typeof candidate.default.extractRawText === 'function') {
    return candidate.default;
  }

  throw new Error('MAMMOTH_LOAD_FAILED');
}
