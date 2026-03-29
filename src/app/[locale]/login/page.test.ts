import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getCurrentViewer: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mocks.redirect(...args),
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

describe('login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated viewers to the global sign-in route', async () => {
    mocks.getCurrentViewer.mockResolvedValue(null);

    const LoginPage = (await import('@/app/[locale]/login/page')).default;
    await LoginPage({
      params: Promise.resolve({ locale: 'en-US' }),
    });

    expect(mocks.redirect).toHaveBeenCalledWith('/sign-in');
  });

  it('redirects authenticated viewers to their project workspace locale', async () => {
    mocks.getCurrentViewer.mockResolvedValue({
      workspace: {
        defaultLocale: 'en-US',
      },
    });

    const LoginPage = (await import('@/app/[locale]/login/page')).default;
    await LoginPage({
      params: Promise.resolve({ locale: 'zh-CN' }),
    });

    expect(mocks.redirect).toHaveBeenCalledWith('/en-US/projects');
  });

  it('renders the login form when auth lookup fails', async () => {
    mocks.getCurrentViewer.mockRejectedValue(new Error('CLERK_PRIMARY_EMAIL_MISSING'));

    const LoginPage = (await import('@/app/[locale]/login/page')).default;
    await LoginPage({
      params: Promise.resolve({ locale: 'en-US' }),
    });

    expect(mocks.redirect).toHaveBeenCalledWith('/sign-in');
  });
});
