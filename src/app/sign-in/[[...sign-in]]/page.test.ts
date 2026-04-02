import { SignIn } from '@clerk/nextjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
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
    mocks.headers.mockResolvedValue(new Headers({ 'accept-language': 'zh-CN' }));
  });

  it('uses the resolved locale for deterministic post-auth redirect without forcing an existing session away', async () => {
    const SignInPage = (await import('@/app/sign-in/[[...sign-in]]/page')).default;
    const page = await SignInPage({
      searchParams: Promise.resolve({}),
    });

    expect(page.type).toBe(SignIn);
    expect(page.props).toMatchObject({
      routing: 'path',
      path: '/sign-in',
      signUpUrl: '/sign-up',
      fallbackRedirectUrl: '/en-US/projects',
    });
    expect(page.props.forceRedirectUrl).toBeUndefined();
  });

  it('prefers an explicit redirect_url from the request', async () => {
    const SignInPage = (await import('@/app/sign-in/[[...sign-in]]/page')).default;
    const page = await SignInPage({
      searchParams: Promise.resolve({
        redirect_url: 'https://app.012294.xyz/zh-CN/pricing',
      }),
    });

    expect(page.props.fallbackRedirectUrl).toBe('https://app.012294.xyz/zh-CN/pricing');
    expect(page.props.forceRedirectUrl).toBeUndefined();
  });
});
