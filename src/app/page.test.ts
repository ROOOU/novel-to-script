import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mocks.redirect(...args),
}));

vi.mock('next/headers', () => ({
  cookies: () => mocks.cookies(),
  headers: () => mocks.headers(),
}));

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects the bare root to the locale from the request cookie', async () => {
    mocks.cookies.mockResolvedValue({
      get: (name: string) => (name === 'novelscript_locale' ? { value: 'en-US' } : undefined),
    });
    mocks.headers.mockResolvedValue(new Headers({ 'accept-language': 'zh-CN' }));

    const Home = (await import('@/app/page')).default;
    await Home();

    expect(mocks.redirect).toHaveBeenCalledWith('/en-US');
  });

  it('falls back to accept-language when no locale cookie exists', async () => {
    mocks.cookies.mockResolvedValue({
      get: () => undefined,
    });
    mocks.headers.mockResolvedValue(new Headers({ 'accept-language': 'en-US,en;q=0.9' }));

    const Home = (await import('@/app/page')).default;
    await Home();

    expect(mocks.redirect).toHaveBeenCalledWith('/en-US');
  });
});
