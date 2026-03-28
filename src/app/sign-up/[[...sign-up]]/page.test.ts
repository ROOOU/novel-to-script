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

  it('uses the resolved locale for deterministic post-auth redirect', async () => {
    const SignUpPage = (await import('@/app/sign-up/[[...sign-up]]/page')).default;
    const page = await SignUpPage();

    expect(page.type).toBe(SignUp);
    expect(page.props).toMatchObject({
      routing: 'path',
      path: '/sign-up',
      signInUrl: '/sign-in',
      fallbackRedirectUrl: '/en-US/projects',
      forceRedirectUrl: '/en-US/projects',
    });
  });
});
