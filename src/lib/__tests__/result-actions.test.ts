import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  copyTextToClipboard: vi.fn(),
  downloadTextFile: vi.fn(),
}));

vi.mock('@/lib/clipboard', () => ({
  copyTextToClipboard: mocks.copyTextToClipboard,
}));

vi.mock('@/lib/file-text', () => ({
  downloadTextFile: mocks.downloadTextFile,
}));

import { copyResultText, exportResultText } from '@/lib/result-actions';

describe('copyResultText', () => {
  beforeEach(() => {
    mocks.copyTextToClipboard.mockReset();
    mocks.downloadTextFile.mockReset();
  });

  it('returns false for empty content', async () => {
    const toast = vi.fn();

    await expect(copyResultText('', toast)).resolves.toBe(false);
    expect(toast).not.toHaveBeenCalled();
    expect(mocks.copyTextToClipboard).not.toHaveBeenCalled();
  });

  it('shows success toast when copy succeeds', async () => {
    mocks.copyTextToClipboard.mockResolvedValue(true);
    const toast = vi.fn();

    await expect(copyResultText('hello', toast)).resolves.toBe(true);
    expect(mocks.copyTextToClipboard).toHaveBeenCalledWith('hello');
    expect(toast).toHaveBeenCalledWith('已复制到剪贴板');
  });

  it('shows error toast when copy fails', async () => {
    mocks.copyTextToClipboard.mockResolvedValue(false);
    const toast = vi.fn();

    await expect(copyResultText('hello', toast)).resolves.toBe(false);
    expect(toast).toHaveBeenCalledWith('复制失败，请手动选择复制', 'error');
  });
});

describe('exportResultText', () => {
  beforeEach(() => {
    mocks.copyTextToClipboard.mockReset();
    mocks.downloadTextFile.mockReset();
  });

  it('returns false for empty content', () => {
    const toast = vi.fn();

    expect(
      exportResultText('', 'file.txt', toast, {
        emptyMessage: '暂无内容',
        successMessage: '已导出',
      })
    ).toBe(false);
    expect(toast).toHaveBeenCalledWith('暂无内容', 'error');
    expect(mocks.downloadTextFile).not.toHaveBeenCalled();
  });

  it('downloads content and shows success toast', () => {
    const toast = vi.fn();

    expect(
      exportResultText('content', 'file.txt', toast, {
        emptyMessage: '暂无内容',
        successMessage: '已导出',
      })
    ).toBe(true);
    expect(mocks.downloadTextFile).toHaveBeenCalledWith('content', 'file.txt');
    expect(toast).toHaveBeenCalledWith('已导出');
  });
});
