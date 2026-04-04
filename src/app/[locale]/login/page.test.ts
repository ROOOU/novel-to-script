import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getCurrentViewer: vi.fn(),
  headers: vi.fn(),
  LoginForm: vi.fn(({ locale, redirectUrl }: { locale: string; redirectUrl?: string }) => ({
    type: 'mock-login-form',
    props: { locale, redirectUrl },
  })),
}));

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mocks.redirect(...args),
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

vi.mock('next/headers', () => ({
  headers: () => mocks.headers(),
}));

vi.mock('@/features/saas/LoginForm', () => ({
  LoginForm: (props: { locale: string; redirectUrl?: string }) => mocks.LoginForm(props),
}));

describe('login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers({ origin: 'https://app.012294.xyz' }));
  });

  it('renders the branded localized login wrapper for unauthenticated viewers', async () => {
    mocks.getCurrentViewer.mockResolvedValue(null);

    const LoginPage = (await import('@/app/[locale]/login/page')).default;
    const page = await LoginPage({
      params: Promise.resolve({ locale: 'en-US' }),
    });

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(page).toMatchObject({
      props: { locale: 'en-US' },
    });
  });

  it('passes redirect_url through to the localized login wrapper', async () => {
    mocks.getCurrentViewer.mockResolvedValue(null);

    const LoginPage = (await import('@/app/[locale]/login/page')).default;
    const page = await LoginPage({
      params: Promise.resolve({ locale: 'en-US' }),
      searchParams: Promise.resolve({
        redirect_url: '/en-US/pricing',
      }),
    });

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(page).toMatchObject({
      props: {
        locale: 'en-US',
        redirectUrl: '/en-US/pricing',
      },
    });
  });

  it('rejects off-site redirect targets', async () => {
    mocks.getCurrentViewer.mockResolvedValue(null);

    const LoginPage = (await import('@/app/[locale]/login/page')).default;
    const page = await LoginPage({
      params: Promise.resolve({ locale: 'en-US' }),
      searchParams: Promise.resolve({
        redirect_url: 'https://evil.example/en-US/pricing',
      }),
    });

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(page).toMatchObject({
      props: {
        locale: 'en-US',
        redirectUrl: '/en-US/projects',
      },
    });
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

  it('renders the branded wrapper when auth lookup fails', async () => {
    mocks.getCurrentViewer.mockRejectedValue(new Error('CLERK_PRIMARY_EMAIL_MISSING'));

    const LoginPage = (await import('@/app/[locale]/login/page')).default;
    const page = await LoginPage({
      params: Promise.resolve({ locale: 'en-US' }),
    });

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(page).toMatchObject({
      props: { locale: 'en-US' },
    });
  });
});
