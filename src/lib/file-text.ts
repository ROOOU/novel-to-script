export const SUPPORTED_TEXT_FILE_ACCEPT = '.txt,.md,text/plain,text/markdown';

export function isSupportedTextFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    file.type === 'text/plain' ||
    file.type === 'text/markdown'
  );
}

export async function readTextFile(file: File): Promise<string> {
  return file.text();
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
