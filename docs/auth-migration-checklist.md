# Auth Migration Checklist

1. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
2. Enable Google sign-in and email auth inside Clerk.
3. Verify a legacy user can sign in with a matching verified email and keep the same local projects and credits.
4. Verify `/api/auth/session` returns a viewer payload for a Clerk-authenticated session.
5. Verify PayPal checkout still records orders against the expected local organization.
6. Remove legacy auth secrets from deployment configs after production traffic is stable on Clerk.
