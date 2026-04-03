import { SignUp } from '@clerk/nextjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentViewer: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mocks.redirect(...args),
}));

describe('localized sign-up page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentViewer.mockResolvedValue(null);
  });

  it('renders the localized sign-up wrapper and preserves redirect_url', async () => {
    const SignUpPage = (await import('@/app/[locale]/sign-up/page')).default;
    const page = await SignUpPage({
      params: Promise.resolve({ locale: 'en-US' }),
      searchParams: Promise.resolve({
        redirect_url: 'https://app.012294.xyz/en-US/pricing',
      }),
    });

    expect(page.type.name).toBe('SignUpForm');
    expect(page.props).toMatchObject({
      locale: 'en-US',
      redirectUrl: 'https://app.012294.xyz/en-US/pricing',
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('redirects authenticated viewers to projects', async () => {
    mocks.getCurrentViewer.mockResolvedValue({
      workspace: { defaultLocale: 'zh-CN' },
    });

    const SignUpPage = (await import('@/app/[locale]/sign-up/page')).default;
    await SignUpPage({
      params: Promise.resolve({ locale: 'en-US' }),
      searchParams: Promise.resolve({}),
    });

    expect(mocks.redirect).toHaveBeenCalledWith('/zh-CN/projects');
  });
});
