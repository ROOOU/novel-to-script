import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getCurrentViewer: vi.fn(),
  getDictionary: vi.fn(),
  canAccessDeveloperChannel: vi.fn(),
  DevTestingClient: vi.fn(({ locale }: { locale: string }) => ({
    type: 'mock-dev-testing-client',
    props: { locale },
  })),
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

vi.mock('@/server/dev/channel', () => ({
  canAccessDeveloperChannel: (...args: unknown[]) => mocks.canAccessDeveloperChannel(...args),
}));

vi.mock('@/i18n/get-dictionary', () => ({
  getDictionary: (...args: unknown[]) => mocks.getDictionary(...args),
}));

vi.mock('@/features/saas/DevTestingClient', () => ({
  DevTestingClient: (props: { locale: string }) => mocks.DevTestingClient(props),
}));

describe('dev-testing page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated viewers to the localized login wrapper with the dev-testing path preserved', async () => {
    mocks.getCurrentViewer.mockResolvedValue(null);

    const DevTestingPage = (await import('@/app/[locale]/dev-testing/page')).default;
    await expect(
      DevTestingPage({
        params: Promise.resolve({ locale: 'zh-CN' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mocks.redirect).toHaveBeenCalledWith(
      '/zh-CN/login?redirect_url=%2Fzh-CN%2Fdev-testing'
    );
    expect(mocks.getDictionary).not.toHaveBeenCalled();
    expect(mocks.canAccessDeveloperChannel).not.toHaveBeenCalled();
  });

  it('redirects signed-in viewers without developer access to the localized admin page', async () => {
    mocks.getCurrentViewer.mockResolvedValue({
      organization: { id: 'org_1' },
      workspace: { id: 'workspace_1' },
    });
    mocks.canAccessDeveloperChannel.mockReturnValue(false);

    const DevTestingPage = (await import('@/app/[locale]/dev-testing/page')).default;
    await expect(
      DevTestingPage({
        params: Promise.resolve({ locale: 'en-US' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mocks.redirect).toHaveBeenCalledWith('/en-US/admin');
    expect(mocks.getDictionary).not.toHaveBeenCalled();
    expect(mocks.DevTestingClient).not.toHaveBeenCalled();
  });

  it('keeps signed-in developer viewers on the dev-testing page', async () => {
    mocks.getCurrentViewer.mockResolvedValue({
      organization: { id: 'org_1' },
      workspace: { id: 'workspace_1' },
    });
    mocks.canAccessDeveloperChannel.mockReturnValue(true);
    mocks.getDictionary.mockResolvedValue({ devTestingPage: {} });

    const DevTestingPage = (await import('@/app/[locale]/dev-testing/page')).default;
    const page = await DevTestingPage({
      params: Promise.resolve({ locale: 'en-US' }),
    });

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(page).toMatchObject({
      props: { locale: 'en-US' },
    });
  });
});
