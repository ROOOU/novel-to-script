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

  it('uses the resolved locale for deterministic post-auth redirect', async () => {
    const SignInPage = (await import('@/app/sign-in/[[...sign-in]]/page')).default;
    const page = await SignInPage();

    expect(page.type).toBe(SignIn);
    expect(page.props).toMatchObject({
      routing: 'path',
      path: '/sign-in',
      signUpUrl: '/sign-up',
      fallbackRedirectUrl: '/en-US/projects',
      forceRedirectUrl: '/en-US/projects',
    });
  });
});
