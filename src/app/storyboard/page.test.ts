import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentViewer: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mocks.redirect(...args);
    throw new Error('NEXT_REDIRECT');
  },
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

describe('StoryboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects authenticated viewers to their locale-specific projects page', async () => {
    mocks.getCurrentViewer.mockResolvedValue({
      session: { locale: 'en-US' },
    });

    const StoryboardPage = (await import('@/app/storyboard/page')).default;
    await expect(StoryboardPage()).rejects.toThrow('NEXT_REDIRECT');

    expect(mocks.redirect).toHaveBeenCalledWith('/en-US/projects');
  });

  it('falls back to zh-CN for viewers that are not authenticated', async () => {
    mocks.getCurrentViewer.mockResolvedValue(null);

    const StoryboardPage = (await import('@/app/storyboard/page')).default;
    await expect(StoryboardPage()).rejects.toThrow('NEXT_REDIRECT');

    expect(mocks.redirect).toHaveBeenCalledWith('/zh-CN');
  });
});
