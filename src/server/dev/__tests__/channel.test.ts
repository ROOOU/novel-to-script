import { describe, expect, it } from 'vitest';
import {
  canAccessDeveloperChannel,
  getDeveloperChannelAllowlist,
  isDeveloperChannelEnabled,
} from '@/server/dev/channel';

describe('developer channel access', () => {
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
});
