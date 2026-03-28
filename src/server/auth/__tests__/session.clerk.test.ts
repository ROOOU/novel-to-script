import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mocks.auth(),
  currentUser: () => mocks.currentUser(),
}));

describe('getCurrentClerkIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when there is no authenticated Clerk user', async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const { getCurrentClerkIdentity } = await import('@/server/auth/session');

    await expect(getCurrentClerkIdentity()).resolves.toBeNull();
  });

  it('maps the active Clerk user into a local identity payload', async () => {
    mocks.auth.mockResolvedValue({ userId: 'clerk_user_1' });
    mocks.currentUser.mockResolvedValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      username: 'ada',
      imageUrl: 'https://example.com/avatar.png',
      primaryEmailAddressId: 'email_1',
      emailAddresses: [
        {
          id: 'email_1',
          emailAddress: 'ada@example.com',
          verification: {
            status: 'verified',
          },
        },
      ],
    });

    const { getCurrentClerkIdentity } = await import('@/server/auth/session');

    await expect(getCurrentClerkIdentity()).resolves.toEqual({
      authUserId: 'clerk_user_1',
      email: 'ada@example.com',
      emailVerified: true,
      displayName: 'Ada Lovelace',
      avatarUrl: 'https://example.com/avatar.png',
      locale: 'en-US',
    });
  });
});
