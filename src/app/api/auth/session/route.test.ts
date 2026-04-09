import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateUser: vi.fn(),
  createSessionToken: vi.fn(),
}));

vi.mock('@/server/auth/service', () => ({
  authenticateUser: (...args: unknown[]) => mocks.authenticateUser(...args),
}));

vi.mock('@/server/auth/session', async () => {
  const actual = await vi.importActual<typeof import('@/server/auth/session')>('@/server/auth/session');
  return {
    ...actual,
    createSessionToken: (...args: unknown[]) => mocks.createSessionToken(...args),
  };
});

import { AUTH_COOKIE_NAME } from '@/server/auth/session';
import { DELETE, POST } from '@/app/api/auth/session/route';

describe('auth session route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateUser.mockResolvedValue({
      userId: 'user_1',
      email: 'creator@example.com',
      displayName: 'Creator',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      locale: 'zh-CN',
      issuedAt: '2026-03-24T00:00:00.000Z',
    });
    mocks.createSessionToken.mockReturnValue('signed-token');
  });

  it('creates a session cookie after authenticating', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/auth/session', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email: 'creator@example.com',
          password: 'secret123',
          displayName: 'Creator',
          locale: 'zh-CN',
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.authenticateUser).toHaveBeenCalledWith({
      email: 'creator@example.com',
      password: 'secret123',
      displayName: 'Creator',
      locale: 'zh-CN',
    });
    expect(mocks.createSessionToken).toHaveBeenCalled();
    expect(response.headers.get('set-cookie')).toContain(`${AUTH_COOKIE_NAME}=signed-token`);
  });

  it('falls back to zh-CN for unsupported locales', async () => {
    await POST(
      new NextRequest('https://app.test/api/auth/session', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email: 'creator@example.com',
          password: 'secret123',
          locale: 'fr-FR',
        }),
      })
    );

    expect(mocks.authenticateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'zh-CN',
      })
    );
  });

  it('returns 400 for invalid credentials', async () => {
    mocks.authenticateUser.mockRejectedValueOnce(new Error('INVALID_CREDENTIALS'));

    const response = await POST(
      new NextRequest('https://app.test/api/auth/session', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email: 'creator@example.com',
          password: 'secret123',
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'INVALID_CREDENTIALS',
    });
  });

  it('returns 400 for invalid request payloads without authenticating', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/auth/session', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email: 'bad-email',
          password: '123',
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.authenticateUser).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'INVALID_REQUEST',
    });
  });

  it('returns AUTH_FAILED for unexpected internal errors', async () => {
    mocks.authenticateUser.mockRejectedValueOnce(new Error('Failed query: select "data" from "users"'));

    const response = await POST(
      new NextRequest('https://app.test/api/auth/session', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email: 'creator@example.com',
          password: 'secret123',
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'AUTH_FAILED',
    });
  });

  it('clears the auth cookie on delete', async () => {
    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain(`${AUTH_COOKIE_NAME}=;`);
  });
});
