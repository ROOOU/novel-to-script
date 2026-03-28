import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  authProtect: vi.fn(),
  authFactory: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (handler: (auth: () => Promise<{ userId: string | null }>, request: Request) => Promise<Response | undefined>) =>
    (request: Request) =>
      handler(
        Object.assign(
          () => mocks.authFactory(),
          {
            protect: (...args: unknown[]) => mocks.authProtect(...args),
          }
        ),
        request
      ),
  createRouteMatcher:
    (patterns: string[]) =>
    (request: Request) => {
      const pathname = new URL(request.url).pathname;
      return patterns.some((pattern) => {
        if (pattern === '/api/projects(.*)') return pathname.startsWith('/api/projects');
        if (pattern === '/api/billing(.*)') return pathname.startsWith('/api/billing');
        if (pattern === '/:locale/projects(.*)') return /^\/[^/]+\/projects(?:\/.*)?$/.test(pathname);
        if (pattern === '/:locale/billing(.*)') return /^\/[^/]+\/billing(?:\/.*)?$/.test(pathname);
        return false;
      });
    },
}));

describe('proxy auth handling', () => {
  function createRequest(url: string) {
    const request = new Request(url);
    return Object.assign(request, {
      nextUrl: new URL(url),
    }) as unknown as NextRequest;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authFactory.mockResolvedValue({ userId: null });
  });

  it('returns a machine-readable 401 for protected API routes', async () => {
    const { default: proxy } = await import('@/proxy');

    const response = await proxy(createRequest('https://app.012294.xyz/api/billing/summary'), {} as never);

    expect(response?.status).toBe(401);
    await expect(response?.json()).resolves.toEqual({
      ok: false,
      error: 'UNAUTHORIZED',
    });
    expect(mocks.authProtect).not.toHaveBeenCalled();
  });

  it('redirects protected pages to sign-in', async () => {
    mocks.authProtect.mockResolvedValue(undefined);
    const { default: proxy } = await import('@/proxy');

    await proxy(createRequest('https://app.012294.xyz/zh-CN/projects'), {} as never);

    expect(mocks.authProtect).toHaveBeenCalledWith(
      expect.objectContaining({
        unauthenticatedUrl: expect.stringContaining('/sign-in'),
      })
    );
  });
});
