import { describe, expect, it } from 'vitest';

describe('legacy auth cleanup', () => {
  it('does not expose password-login helpers from the active auth service', async () => {
    const authService = await import('@/server/auth/service');

    expect('authenticateUser' in authService).toBe(false);
  });

  it('does not expose signed-cookie session helpers from the active session module', async () => {
    const authSession = await import('@/server/auth/session');

    expect('createSessionToken' in authSession).toBe(false);
    expect('verifySessionToken' in authSession).toBe(false);
    expect('parseSessionFromCookieHeader' in authSession).toBe(false);
    expect('getCurrentSession' in authSession).toBe(false);
    expect('AUTH_COOKIE_NAME' in authSession).toBe(false);
  });
});
