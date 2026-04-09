import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';
import {
  buildDatedTextFilename,
  getExportDateLabel,
  getTextFileBaseName,
  isSupportedTextFile,
  readTextFile,
} from '@/lib/file-text';

const DOCX_FIXTURE_BASE64 =
  'UEsDBBQAAAAIAJCReFydxYoq8gAAALkBAAATABwAW0NvbnRlbnRfVHlwZXNdLnhtbFVUCQADkGPCaZBjwml1eAsAAQT1AQAABAAAAAB9kM1OwzAQhO95CstXlDhwQAgl6YGfI3AoD7CyN4lVe2153dK+PU4LRUKUozXzzaynW+29EztMbAP18rpppUDSwViaevm+fq7vpOAMZMAFwl4ekOVqqLr1ISKLAhP3cs453ivFekYP3ISIVJQxJA+5PNOkIugNTKhu2vZW6UAZKdd5yZBDJUT3iCNsXRZP+6KcbknoWIqHk3ep6yXE6KyGXHS1I/OrqP4qaQp59PBsI18Vg1SXShbxcscP+lomStageIOUX8AXo/oIySgT9NYXuPk/6Y9rwzhajWd+SYspaGQu23vXnBUPlr5/0anj8EP1CVBLAwQKAAAAAACQkXhcAAAAAAAAAAAAAAAABgAcAF9yZWxzL1VUCQADkGPCaZBjwml1eAsAAQT1AQAABAAAAABQSwMEFAAAAAgAkJF4XECgUwmyAAAALwEAAAsAHABfcmVscy8ucmVsc1VUCQADkGPCaZBjwml1eAsAAQT1AQAABAAAAACNz7sOgjAUBuCdp2jOLgUHYwyFxZiwGnyApj2URnpJWy+8vR0cxDg4ntt38jfd08zkjiFqZxnUZQUErXBSW8XgMpw2eyAxcSv57CwyWDBC1xbNGWee8k2ctI8kIzYymFLyB0qjmNDwWDqPNk9GFwxPuQyKei6uXCHdVtWOhk8D2oKQFUt6ySD0sgYyLB7/4d04aoFHJ24Gbfrx5WsjyzwoTAweLkgq3+0ys0BzSrqK2RYvUEsDBAoAAAAAAJCReFwAAAAAAAAAAAAAAAAFABwAd29yZC9VVAkAA5BjwmmQY8JpdXgLAAEE9QEAAAQAAAAAUEsDBBQAAAAIAJCReFx5/bj1zAAAABwBAAARABwAd29yZC9kb2N1bWVudC54bWxVVAkAA5BjwmmQY8JpdXgLAAEE9QEAAAQAAAAAbY9BTsMwEEX3OYXlPXVggVCUuDsuQHsAYw9JpHjGGpum3bFpT1N1hwT3oXAN7CJ23Tz9mdH/X9Mut34SG+A4EnbydlFLAWjJjdh3cr16vHmQIiaDzkyE0MkdRLnUVTs3juyrB0wiJ2Bs5k4OKYVGqWgH8CYuKADm2wuxNymP3KuZ2AUmCzHmAj+pu7q+V96MKHUlRE59Jrcr8jIEncEFSf8cj18fb9+n9/Nhfz59tqosC/nCcNX0BJbQiWDY9GzCcNVVxF9tUf9v6eoXUEsBAh4DFAAAAAgAkJF4XJ3FiiryAAAAuQEAABMAGAAAAAAAAQAAAICBAAAAAFtDb250ZW50X1R5cGVzXS54bWxVVAUAA5Bjwml1eAsAAQT1AQAABAAAAABQSwECHgMKAAAAAACQkXhcAAAAAAAAAAAAAAAABgAYAAAAAAAAABAAwEE/AQAAX3JlbHMvVVQFAAOQY8JpdXgLAAEE9QEAAAQAAAAAUEsBAh4DFAAAAAgAkJF4XECgUwmyAAAALwEAAAsAGAAAAAAAAQAAAICBfwEAAF9yZWxzLy5yZWxzVVQFAAOQY8JpdXgLAAEE9QEAAAQAAAAAUEsBAh4DCgAAAAAAkJF4XAAAAAAAAAAAAAAAAAUAGAAAAAAAAAAQAMBBdgIAAHdvcmQvVVQFAAOQY8JpdXgLAAEE9QEAAAQAAAAAUEsBAh4DFAAAAAgAkJF4XHn9uPXMAAAAHAEAABEAGAAAAAAAAQAAAICBtQIAAHdvcmQvZG9jdW1lbnQueG1sVVQFAAOQY8JpdXgLAAEE9QEAAAQAAAAAUEsFBgAAAAAFAAUAmAEAAMwDAAAAAA==';

describe('isSupportedTextFile', () => {
  it('accepts supported extensions', () => {
    expect(isSupportedTextFile(new File(['a'], 'demo.txt', { type: 'application/octet-stream' }))).toBe(true);
    expect(isSupportedTextFile(new File(['a'], 'demo.md', { type: 'application/octet-stream' }))).toBe(true);
    expect(
      isSupportedTextFile(
        new File(['a'], 'demo.docx', { type: 'application/octet-stream' })
      )
    ).toBe(true);
  });

  it('accepts supported mime types', () => {
    expect(isSupportedTextFile(new File(['a'], 'demo.bin', { type: 'text/plain' }))).toBe(true);
    expect(isSupportedTextFile(new File(['a'], 'demo.bin', { type: 'text/markdown' }))).toBe(true);
    expect(
      isSupportedTextFile(
        new File(['a'], 'demo.bin', {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
      )
    ).toBe(true);
  });

  it('rejects unsupported files', () => {
    expect(isSupportedTextFile(new File(['a'], 'demo.pdf', { type: 'application/pdf' }))).toBe(false);
  });
});

describe('readTextFile', () => {
  it('reads plain text files', async () => {
    const file = new File(['第一行\r\n第二行'], 'demo.txt', { type: 'text/plain' });

    await expect(readTextFile(file)).resolves.toBe('第一行\n第二行');
  });

  it('extracts raw text from docx files', async () => {
    const bytes = Uint8Array.from(Buffer.from(DOCX_FIXTURE_BASE64, 'base64'));
    const file = new File([bytes], 'demo.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    await expect(readTextFile(file)).resolves.toBe('第一段内容\n\nSecond paragraph');
  });

  it('rejects unsupported file types', async () => {
    await expect(
      readTextFile(new File(['%PDF'], 'demo.pdf', { type: 'application/pdf' }))
    ).rejects.toThrow('UNSUPPORTED_TEXT_FILE');
  });
});

describe('filename helpers', () => {
  it('derives the title from an uploaded filename', () => {
    expect(getTextFileBaseName('demo-source.docx')).toBe('demo-source');
    expect(getTextFileBaseName('  upload.md  ')).toBe('upload');
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
