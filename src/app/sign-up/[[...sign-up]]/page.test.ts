import { SignUp } from '@clerk/nextjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
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
    const page = await SignUpPage({
      searchParams: Promise.resolve({}),
    });

    expect(page.type).toBe(SignUp);
    expect(page.props).toMatchObject({
      routing: 'path',
      path: '/sign-up',
      signInUrl: '/sign-in',
      fallbackRedirectUrl: '/en-US/projects',
    });
    expect(page.props.forceRedirectUrl).toBeUndefined();
  });

  it('prefers an explicit redirect_url from the request', async () => {
    const SignUpPage = (await import('@/app/sign-up/[[...sign-up]]/page')).default;
    const page = await SignUpPage({
      searchParams: Promise.resolve({
        redirect_url: 'https://app.012294.xyz/zh-CN/pricing',
      }),
    });

    expect(page.props.fallbackRedirectUrl).toBe('https://app.012294.xyz/zh-CN/pricing');
    expect(page.props.forceRedirectUrl).toBeUndefined();
  });
});
