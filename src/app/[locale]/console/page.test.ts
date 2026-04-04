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

describe('ConsolePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects authenticated viewers to the localized projects page', async () => {
    mocks.getCurrentViewer.mockResolvedValue({
      session: { locale: 'en-US' },
    });

    const ConsolePage = (await import('@/app/[locale]/console/page')).default;
    await expect(
      ConsolePage({
        params: Promise.resolve({ locale: 'zh-CN' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mocks.redirect).toHaveBeenCalledWith('/zh-CN/projects');
  });

  it('falls back to the localized root when viewers are not authenticated', async () => {
    mocks.getCurrentViewer.mockResolvedValue(null);

    const ConsolePage = (await import('@/app/[locale]/console/page')).default;
    await expect(
      ConsolePage({
        params: Promise.resolve({ locale: 'en-US' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mocks.redirect).toHaveBeenCalledWith('/en-US');
  });
});
