import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (handler: unknown) => handler,
  createRouteMatcher:
    (patterns: string[]) =>
    (request: NextRequest) => {
      const path = request.nextUrl.pathname;
      return patterns.some((pattern) => {
        if (pattern === '/:locale/projects(.*)') {
          return /^\/[^/]+\/projects(?:\/.*)?$/.test(path);
        }
        if (pattern === '/:locale/billing(.*)') {
          return /^\/[^/]+\/billing(?:\/.*)?$/.test(path);
        }
        if (pattern === '/api/projects(.*)') {
          return /^\/api\/projects(?:\/.*)?$/.test(path);
        }
        if (pattern === '/api/billing(.*)') {
          return /^\/api\/billing(?:\/.*)?$/.test(path);
        }
        return false;
      });
    },
}));

describe('proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it('returns 401 json for unauthenticated protected api routes', async () => {
    const proxy = (await import('@/proxy')).default as any;
    const response = (await proxy(
      async () => ({ userId: null }),
      new NextRequest('https://app.012294.xyz/api/billing/summary')
    )) as Response;

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'UNAUTHORIZED',
    });
  });

  it('redirects unauthenticated protected page routes to the localized login page', async () => {
    const proxy = (await import('@/proxy')).default as any;
    const response = (await proxy(
      async () => ({ userId: null }),
      new NextRequest('https://app.012294.xyz/zh-CN/projects')
    )) as Response;

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://app.012294.xyz/zh-CN/login');
  });

  it('allows authenticated protected page routes through', async () => {
    const proxy = (await import('@/proxy')).default as any;
    const response = (await proxy(
      async () => ({ userId: 'user_1' }),
      new NextRequest('https://app.012294.xyz/zh-CN/projects')
    )) as Response;

    expect(response.status).toBe(200);
  });

  it('does not locale-redirect Clerk handshake routes', async () => {
    const proxy = (await import('@/proxy')).default as any;
    const response = (await proxy(
      async () => ({ userId: null }),
      new NextRequest('https://app.012294.xyz/v1/client')
    )) as Response;

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('redirects production requests from vercel.app hosts back to the canonical app domain', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.012294.xyz';

    const proxy = (await import('@/proxy')).default as any;
    const response = (await proxy(
      async () => ({ userId: 'user_1' }),
      new NextRequest('https://novel-to-script-navv5desw-shengyufeis-projects.vercel.app/zh-CN/pricing?plan=pro')
    )) as Response;

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://app.012294.xyz/zh-CN/pricing?plan=pro');
  });
});
