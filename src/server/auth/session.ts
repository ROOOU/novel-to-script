import { auth, currentUser } from '@clerk/nextjs/server';
import type { SupportedLocale } from '@/server/shared/platform/domain';
import type { ClerkIdentityInput } from './service';

export async function getCurrentClerkIdentity(): Promise<ClerkIdentityInput | null> {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const user = await currentUser();
  const primaryEmail = user?.emailAddresses.find(
    (candidate) => candidate.id === user.primaryEmailAddressId
  );

  if (!user || !primaryEmail?.emailAddress) {
    throw new Error('CLERK_PRIMARY_EMAIL_MISSING');
  }

  return {
    authUserId: userId,
    email: primaryEmail.emailAddress,
    emailVerified: primaryEmail.verification?.status === 'verified',
    displayName:
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.username ||
      primaryEmail.emailAddress.split('@')[0] ||
      'Creator',
    avatarUrl: user.imageUrl,
    locale: resolveClerkLocale(user.publicMetadata?.locale),
  };
}

function resolveClerkLocale(value: unknown): SupportedLocale {
  return value === 'zh-CN' ? 'zh-CN' : 'en-US';
}
