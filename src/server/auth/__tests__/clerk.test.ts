import { afterEach, describe, expect, it } from 'vitest';
import { getClerkConfig } from '@/server/auth/clerk';

describe('getClerkConfig', () => {
  const originalPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const originalSecretKey = process.env.CLERK_SECRET_KEY;

  afterEach(() => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = originalPublishableKey;
    process.env.CLERK_SECRET_KEY = originalSecretKey;
  });

  it('returns the Clerk keys from env', () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_123';
    process.env.CLERK_SECRET_KEY = 'sk_test_456';

    expect(getClerkConfig()).toEqual({
      publishableKey: 'pk_test_123',
      secretKey: 'sk_test_456',
      signInUrl: '/sign-in',
      signUpUrl: '/sign-up',
      afterSignInUrl: '/projects',
      afterSignUpUrl: '/projects',
    });
  });
});
