import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateTrustedUser: vi.fn(),
  createSessionToken: vi.fn(),
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
import { POST } from '@/app/api/auth/session/dev/route';

describe('dev auth session route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NOVELSCRIPT_ENABLE_DEV_AUTH', 'true');
    vi.stubEnv('NOVELSCRIPT_DEV_AUTH_EMAIL', 'local-dev@example.com');
    vi.stubEnv('NOVELSCRIPT_DEV_AUTH_DISPLAY_NAME', 'Local Dev');

    mocks.authenticateTrustedUser.mockResolvedValue({
      userId: 'user_dev_1',
      email: 'local-dev@example.com',
      displayName: 'Local Dev',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      locale: 'zh-CN',
      issuedAt: '2026-04-14T00:00:00.000Z',
    });
    mocks.createSessionToken.mockReturnValue('dev-signed-token');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates a trusted local development session cookie when enabled', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/auth/session/dev', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          locale: 'zh-CN',
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.authenticateTrustedUser).toHaveBeenCalledWith({
      email: 'local-dev@example.com',
      displayName: 'Local Dev',
      locale: 'zh-CN',
    });
    expect(response.headers.get('set-cookie')).toContain(`${AUTH_COOKIE_NAME}=dev-signed-token`);
  });

  it('falls back to zh-CN for unsupported locales', async () => {
    await POST(
      new NextRequest('https://app.test/api/auth/session/dev', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          locale: 'fr-FR',
        }),
      })
    );

    expect(mocks.authenticateTrustedUser).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'zh-CN',
      })
    );
  });

  it('returns 403 when the development access entry is disabled', async () => {
    vi.stubEnv('NOVELSCRIPT_ENABLE_DEV_AUTH', 'false');

    const response = await POST(
      new NextRequest('https://app.test/api/auth/session/dev', {
        method: 'POST',
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.authenticateTrustedUser).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'DEV_AUTH_DISABLED',
    });
  });
});
