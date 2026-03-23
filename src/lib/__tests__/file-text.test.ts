import { describe, expect, it, vi } from 'vitest';
import { buildDatedTextFilename, getExportDateLabel, isSupportedTextFile } from '@/lib/file-text';

describe('isSupportedTextFile', () => {
  it('accepts supported extensions', () => {
    expect(isSupportedTextFile(new File(['a'], 'demo.txt', { type: 'application/octet-stream' }))).toBe(true);
    expect(isSupportedTextFile(new File(['a'], 'demo.md', { type: 'application/octet-stream' }))).toBe(true);
  });

  it('accepts supported mime types', () => {
    expect(isSupportedTextFile(new File(['a'], 'demo.bin', { type: 'text/plain' }))).toBe(true);
    expect(isSupportedTextFile(new File(['a'], 'demo.bin', { type: 'text/markdown' }))).toBe(true);
  });

  it('rejects unsupported files', () => {
    expect(isSupportedTextFile(new File(['a'], 'demo.pdf', { type: 'application/pdf' }))).toBe(false);
  });
});

describe('export filename helpers', () => {
  it('formats a dated filename with the default extension', () => {
    const date = new Date('2026-03-22T00:00:00.000Z');
    const localeSpy = vi.spyOn(date, 'toLocaleDateString').mockReturnValue('2026-03-22');

    expect(buildDatedTextFilename('短剧剧本', 'txt', date)).toBe('短剧剧本_2026-03-22.txt');
    localeSpy.mockRestore();
  });

  it('formats a dated filename with json extension', () => {
    const date = new Date('2026-03-22T00:00:00.000Z');
    const localeSpy = vi.spyOn(date, 'toLocaleDateString').mockReturnValue('2026-03-22');

    expect(buildDatedTextFilename('小说分析', 'json', date)).toBe('小说分析_2026-03-22.json');
    localeSpy.mockRestore();
  });

  it('returns the current date label helper output', () => {
    const date = new Date('2026-03-22T00:00:00.000Z');
    const localeSpy = vi.spyOn(date, 'toLocaleDateString').mockReturnValue('2026-03-22');

    expect(getExportDateLabel(date)).toBe('2026-03-22');
    localeSpy.mockRestore();
  });
});
