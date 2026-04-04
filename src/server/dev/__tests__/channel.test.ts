import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canAccessDeveloperChannel,
  getDeveloperChannelAllowlist,
  isDeveloperChannelEnabled,
  requireDeveloperChannelResponse,
} from '@/server/dev/channel';

const mocks = vi.hoisted(() => ({
  getCurrentViewer: vi.fn(),
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

describe('developer channel access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enables the channel automatically outside production', () => {
    expect(
      isDeveloperChannelEnabled({
        NODE_ENV: 'development',
        NOVELSCRIPT_ENABLE_DEV_CHANNEL: undefined,
        NOVELSCRIPT_DEV_EMAILS: undefined,
      })
    ).toBe(true);
  });

  it('respects the explicit flag in production', () => {
    expect(
      isDeveloperChannelEnabled({
        NODE_ENV: 'production',
        NOVELSCRIPT_ENABLE_DEV_CHANNEL: 'true',
        NOVELSCRIPT_DEV_EMAILS: undefined,
      })
    ).toBe(true);
  });

  it('filters access by allowlist when configured', () => {
    const env = {
      NODE_ENV: 'production',
      NOVELSCRIPT_ENABLE_DEV_CHANNEL: 'true',
      NOVELSCRIPT_DEV_EMAILS: 'dev@example.com,ops@example.com',
    };

    expect(getDeveloperChannelAllowlist(env)).toEqual(['dev@example.com', 'ops@example.com']);
    expect(
      canAccessDeveloperChannel(
        {
          user: {
            email: 'dev@example.com',
          },
        },
        env
      )
    ).toBe(true);
    expect(
      canAccessDeveloperChannel(
        {
          user: {
            email: 'user@example.com',
          },
        },
        env
      )
    ).toBe(false);
  });

  it('returns the shared unauthorized response when no viewer is present', async () => {
    mocks.getCurrentViewer.mockResolvedValueOnce(null);

    const result = await requireDeveloperChannelResponse();

    expect(result.viewer).toBeNull();
    expect(result.response?.status).toBe(401);
    await expect(result.response?.json()).resolves.toEqual({
      ok: false,
      error: 'UNAUTHORIZED',
    });
  });

  it('returns forbidden when the viewer is outside the developer allowlist', async () => {
    mocks.getCurrentViewer.mockResolvedValueOnce({
      user: { email: 'user@example.com' },
    });

    const previousEnv = process.env;
    process.env = {
      ...previousEnv,
      NODE_ENV: 'production',
      NOVELSCRIPT_ENABLE_DEV_CHANNEL: 'true',
      NOVELSCRIPT_DEV_EMAILS: 'dev@example.com',
    };

    try {
      const result = await requireDeveloperChannelResponse();

      expect(result.viewer).toMatchObject({
        user: { email: 'user@example.com' },
      });
      expect(result.response?.status).toBe(403);
      await expect(result.response?.json()).resolves.toEqual({
        ok: false,
        error: 'DEV_CHANNEL_DISABLED',
      });
    } finally {
      process.env = previousEnv;
    }
  });
});
