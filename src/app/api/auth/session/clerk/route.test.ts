import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  clerkClient: vi.fn(),
  usersGetUser: vi.fn(),
  authenticateTrustedUser: vi.fn(),
  createSessionToken: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  verifyToken: (...args: unknown[]) => mocks.verifyToken(...args),
  clerkClient: () => mocks.clerkClient(),
}));

vi.mock('@/server/auth/service', () => ({
  authenticateTrustedUser: (...args: unknown[]) => mocks.authenticateTrustedUser(...args),
}));

vi.mock('@/server/auth/session', async () => {
  const actual = await vi.importActual<typeof import('@/server/auth/session')>('@/server/auth/session');
  return {
    ...actual,
    createSessionToken: (...args: unknown[]) => mocks.createSessionToken(...args),
  };
});

import { AUTH_COOKIE_NAME } from '@/server/auth/session';
import { POST } from '@/app/api/auth/session/clerk/route';

describe('auth session clerk route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyToken.mockResolvedValue({ sub: 'user_clerk_1' });
    mocks.usersGetUser.mockResolvedValue({
      primaryEmailAddressId: 'email_1',
      emailAddresses: [{ id: 'email_1', emailAddress: 'creator@example.com' }],
      externalAccounts: [{ provider: 'google' }],
      firstName: 'Novel',
      lastName: 'Creator',
      fullName: 'Novel Creator',
      username: 'creator',
    });
    mocks.clerkClient.mockResolvedValue({
      users: {
        getUser: (...args: unknown[]) => mocks.usersGetUser(...args),
      },
    });
    mocks.authenticateTrustedUser.mockResolvedValue({
      userId: 'user_1',
      email: 'creator@example.com',
      displayName: 'Novel Creator',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      locale: 'zh-CN',
      issuedAt: '2026-04-07T00:00:00.000Z',
    });
    mocks.createSessionToken.mockReturnValue('signed-token');
  });

  it('bridges clerk user into app session', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/auth/session/clerk?locale=zh-CN', {
        method: 'POST',
        headers: {
          cookie: '__session=fake-token',
        },
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.authenticateTrustedUser).toHaveBeenCalledWith({
      email: 'creator@example.com',
      displayName: 'Novel Creator',
      locale: 'zh-CN',
    });
    expect(response.headers.get('set-cookie')).toContain(`${AUTH_COOKIE_NAME}=signed-token`);
  });

  it('returns 401 when clerk session is missing', async () => {
    const response = await POST(new NextRequest('https://app.test/api/auth/session/clerk?locale=zh-CN', { method: 'POST' }));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'UNAUTHORIZED',
    });
  });

  it('supports bearer token when cookie is missing', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/auth/session/clerk?locale=zh-CN', {
        method: 'POST',
        headers: {
          authorization: 'Bearer explicit-token',
        },
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.verifyToken).toHaveBeenCalledWith('explicit-token', expect.any(Object));
  });

  it('returns 403 when account is not linked to google oauth', async () => {
    mocks.usersGetUser.mockResolvedValueOnce({
      primaryEmailAddressId: 'email_1',
      emailAddresses: [{ id: 'email_1', emailAddress: 'creator@example.com' }],
      externalAccounts: [{ provider: 'github' }],
      firstName: 'Novel',
      lastName: 'Creator',
      fullName: 'Novel Creator',
      username: 'creator',
    });

    const response = await POST(
      new NextRequest('https://app.test/api/auth/session/clerk?locale=zh-CN', {
        method: 'POST',
        headers: {
          cookie: '__session=fake-token',
        },
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'GOOGLE_ACCOUNT_REQUIRED',
    });
  });
});
