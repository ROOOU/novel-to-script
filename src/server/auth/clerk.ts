export interface ClerkRuntimeConfig {
  publishableKey: string;
  secretKey: string;
  signInUrl: string;
  signUpUrl: string;
  afterSignInUrl: string;
  afterSignUpUrl: string;
}

export function getClerkConfig(): ClerkRuntimeConfig {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();

  if (!publishableKey || !secretKey) {
    throw new Error(
      'CLERK_NOT_CONFIGURED: missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or CLERK_SECRET_KEY'
    );
  }

  return {
    publishableKey,
    secretKey,
    signInUrl: '/sign-in',
    signUpUrl: '/sign-up',
    afterSignInUrl: '/projects',
    afterSignUpUrl: '/projects',
  };
}
