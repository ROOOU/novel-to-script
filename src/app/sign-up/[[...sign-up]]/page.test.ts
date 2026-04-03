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

describe('sign-up page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookies.mockResolvedValue({
      get: (name: string) => undefined,
    });
    mocks.headers.mockResolvedValue(new Headers({ 'accept-language': 'en-US,en;q=0.9' }));
  });

  it('uses the resolved locale for deterministic post-auth redirect without forcing an existing session away', async () => {
    const SignUpPage = (await import('@/app/sign-up/[[...sign-up]]/page')).default;
    await SignUpPage({
      searchParams: Promise.resolve({}),
    });

    expect(mocks.redirect).toHaveBeenCalledWith('/en-US/sign-up?redirect_url=%2Fen-US%2Fprojects');
  });

  it('prefers an explicit redirect_url from the request', async () => {
    const SignUpPage = (await import('@/app/sign-up/[[...sign-up]]/page')).default;
    await SignUpPage({
      searchParams: Promise.resolve({
        redirect_url: 'https://app.012294.xyz/zh-CN/pricing',
      }),
    });

    expect(mocks.redirect).toHaveBeenCalledWith(
      '/en-US/sign-up?redirect_url=https%3A%2F%2Fapp.012294.xyz%2Fzh-CN%2Fpricing'
    );
  });
});
