import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  cookies: vi.fn(),
  headers: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mocks.redirect(...args),
}));

vi.mock('next/headers', () => ({
  cookies: () => mocks.cookies(),
  headers: () => mocks.headers(),
}));

describe('sign-in page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({
      get: (name: string) => (name === 'novelscript_locale' ? { value: 'en-US' } : undefined),
    });
    mocks.headers.mockResolvedValue(
      new Headers({
        'accept-language': 'zh-CN',
        origin: 'https://app.012294.xyz',
      })
    );
  });

  it('uses the resolved locale for deterministic post-auth redirect without forcing an existing session away', async () => {
    const SignInPage = (await import('@/app/sign-in/[[...sign-in]]/page')).default;
    await SignInPage({
      searchParams: Promise.resolve({}),
    });

    expect(mocks.redirect).toHaveBeenCalledWith('/en-US/login?redirect_url=%2Fen-US%2Fprojects');
  });

  it('prefers an explicit redirect_url from the request', async () => {
    const SignInPage = (await import('@/app/sign-in/[[...sign-in]]/page')).default;
    await SignInPage({
      searchParams: Promise.resolve({
        redirect_url: 'https://app.012294.xyz/zh-CN/pricing',
      }),
    });

    expect(mocks.redirect).toHaveBeenCalledWith('/en-US/login?redirect_url=%2Fzh-CN%2Fpricing');
  });

  it('rejects off-site redirect targets', async () => {
    const SignInPage = (await import('@/app/sign-in/[[...sign-in]]/page')).default;
    await SignInPage({
      searchParams: Promise.resolve({
        redirect_url: 'https://evil.example/zh-CN/pricing',
      }),
    });

    expect(mocks.redirect).toHaveBeenCalledWith('/en-US/login?redirect_url=%2Fen-US%2Fprojects');
  });
});
