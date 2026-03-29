import { slugify } from '@/lib/slug';
import { getInitialBillingPreferences, getPlanCatalogEntry } from '@/server/billing/catalog';
import { getPlatformRuntime } from '@/server/shared/platform';
import type { SupportedLocale } from '@/server/shared/platform/domain';
import { getCurrentClerkIdentity } from './session';

export interface ClerkIdentityInput {
  authUserId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  avatarUrl?: string | null;
  locale: SupportedLocale;
}

const activeSyncs = new Map<string, Promise<Awaited<ReturnType<typeof buildViewerForUser>>>>();

export async function syncViewerFromClerkIdentity(input: ClerkIdentityInput) {
  const normalizedAuthUserId = input.authUserId.trim();
  const existingSync = activeSyncs.get(normalizedAuthUserId);
  if (existingSync) {
    return existingSync;
  }

  const sync = syncViewerFromClerkIdentityUnlocked(input).finally(() => {
    activeSyncs.delete(normalizedAuthUserId);
  });

  activeSyncs.set(normalizedAuthUserId, sync);
  return sync;
}

async function syncViewerFromClerkIdentityUnlocked(input: ClerkIdentityInput) {
  const runtime = getPlatformRuntime();
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedAuthUserId = input.authUserId.trim();

  const existingUserByAuthId = await runtime.users.getByAuthUserId(normalizedAuthUserId);
  if (existingUserByAuthId) {
    return finalizeOrRecoverClerkUser(existingUserByAuthId, input);
  }

  const existingUserByEmail = await runtime.users.getByEmail(normalizedEmail);
  if (existingUserByEmail) {
    if (!input.emailVerified || existingUserByEmail.authUserId) {
      throw new Error('AUTH_ACCOUNT_LINK_CONFLICT');
    }

    return finalizeOrRecoverClerkUser(existingUserByEmail, input);
  }

  try {
    return await finalizeClerkUser(await createClerkPlaceholderUser(input), input);
  } catch (error) {
    const recoveredViewer = await recoverViewerFromConcurrentIdentityWrite(input, error);
    if (recoveredViewer) {
      return recoveredViewer;
    }

    throw error;
  }
}

export async function getCurrentViewer() {
  try {
    const clerkIdentity = await getCurrentClerkIdentity();
    if (!clerkIdentity) {
      return null;
    }

    return await syncViewerFromClerkIdentity(clerkIdentity);
  } catch {
    return null;
  }
}

export async function buildViewerForUser(userId: string) {
  const runtime = getPlatformRuntime();
  const user = await runtime.users.getById(userId);

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const { organization, workspace, subscription, creditAccount } = await ensureViewerReady(runtime, user);

  const locale = user.preferredLocale ?? workspace.defaultLocale ?? 'zh-CN';

  return {
    session: {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      organizationId: organization.id,
      workspaceId: workspace.id,
      locale,
      issuedAt: new Date().toISOString(),
    },
    user,
    organization,
    workspace,
    subscription,
    creditAccount,
  };
}

async function finalizeClerkUser(user: Awaited<ReturnType<typeof createClerkPlaceholderUser>>, input: ClerkIdentityInput) {
  const runtime = getPlatformRuntime();
  const normalizedEmail = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim() || normalizedEmail.split('@')[0] || 'Creator';
  const now = new Date().toISOString();
  const { organization } = await ensureViewerReady(runtime, user, input, displayName);

  await runtime.users.update(user.id, {
    defaultOrganizationId: organization.id,
    authProvider: 'clerk',
    authUserId: input.authUserId.trim(),
    displayName,
    avatarUrl: input.avatarUrl ?? user.avatarUrl ?? null,
    preferredLocale: input.locale,
    emailVerifiedAt: input.emailVerified ? now : user.emailVerifiedAt ?? null,
    lastAuthSyncAt: now,
    lastLoginAt: now,
    updatedByUserId: user.id,
  });

  return buildViewerForUser(user.id);
}

async function finalizeOrRecoverClerkUser(
  user: Awaited<ReturnType<typeof createClerkPlaceholderUser>>,
  input: ClerkIdentityInput
) {
  try {
    return await finalizeClerkUser(user, input);
  } catch (error) {
    const recoveredViewer = await recoverViewerFromConcurrentIdentityWrite(input, error);
    if (recoveredViewer) {
      return recoveredViewer;
    }

    throw error;
  }
}

async function recoverViewerFromConcurrentIdentityWrite(input: ClerkIdentityInput, error: unknown) {
  if (!isLikelyUserIdentityConstraintError(error)) {
    return null;
  }

  const runtime = getPlatformRuntime();
  const normalizedAuthUserId = input.authUserId.trim();
  const normalizedEmail = input.email.trim().toLowerCase();

  const userByAuthId = await runtime.users.getByAuthUserId(normalizedAuthUserId);
  if (userByAuthId) {
    return buildViewerForUser(userByAuthId.id);
  }

  const userByEmail = await runtime.users.getByEmail(normalizedEmail);
  if (!userByEmail) {
    return null;
  }

  if (userByEmail.authUserId && userByEmail.authUserId !== normalizedAuthUserId) {
    throw new Error('AUTH_ACCOUNT_LINK_CONFLICT');
  }

  return finalizeClerkUser(userByEmail, input);
}

function isLikelyUserIdentityConstraintError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('unique constraint') ||
    message.includes('duplicate key') ||
    message.includes('already exists')
  );
}

async function ensureViewerReady(
  runtime: ReturnType<typeof getPlatformRuntime>,
  user: Awaited<ReturnType<typeof createClerkPlaceholderUser>>,
  input?: ClerkIdentityInput,
  displayName?: string
) {
  const canRepairClerkManagedUser = Boolean(input || user.authProvider === 'clerk' || user.authUserId);
  const effectiveLocale = input?.locale ?? user.preferredLocale ?? 'zh-CN';
  const billingPreferences = canRepairClerkManagedUser ? getInitialBillingPreferences(effectiveLocale) : null;
  const resolvedDisplayName = displayName?.trim() || user.displayName.trim() || user.email.split('@')[0] || 'Creator';

  const organizations = await runtime.organizations.listByOwnerUserId(user.id);
  let organization = organizations.find((candidate) => candidate.id === user.defaultOrganizationId) ?? organizations[0] ?? null;

  if (!organization) {
    if (!billingPreferences) {
      throw new Error('MISSING_ORGANIZATION');
    }

    organization = await runtime.organizations.create({
      slug: await uniqueSlug('org', resolvedDisplayName),
      name: `${resolvedDisplayName}'s Studio`,
      ownerUserId: user.id,
      billingLocale: billingPreferences.locale,
      billingCurrency: billingPreferences.currency,
      pricingRegion: billingPreferences.pricingRegion,
      createdByUserId: user.id,
    });
  }

  const workspaces = await runtime.workspaces.listByOrganizationId(organization.id);
  let workspace = workspaces[0] ?? null;

  if (!workspace) {
    if (!canRepairClerkManagedUser) {
      throw new Error('MISSING_WORKSPACE');
    }

    workspace = await runtime.workspaces.create({
      organizationId: organization.id,
      slug: 'main',
      name: effectiveLocale === 'en-US' ? 'Main Project Space' : '默认项目空间',
      defaultLocale: effectiveLocale,
      createdByUserId: user.id,
    });
  }

  let subscription = await runtime.subscriptions.getCurrentByOrganizationId(organization.id);
  if (!subscription) {
    if (!billingPreferences) {
      subscription = null;
    } else {
      const freePlan = getPlanCatalogEntry('free');
      subscription = await runtime.subscriptions.create({
        organizationId: organization.id,
        provider: 'internal',
        planKey: freePlan.key,
        status: 'active',
        billingInterval: freePlan.billingInterval,
        entitlements: freePlan.entitlements,
        priceCents: freePlan.prices.USD.amountCents,
        currency: 'USD',
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdByUserId: user.id,
      });
    }
  }

  let creditAccount = await runtime.creditAccounts.getByOrganizationId(organization.id);
  if (!creditAccount) {
    if (!billingPreferences) {
      creditAccount = null;
    } else {
      const freePlan = getPlanCatalogEntry('free');
      creditAccount = await runtime.creditAccounts.create({
        organizationId: organization.id,
        availableCredits: freePlan.monthlyCredits,
        reservedCredits: 0,
        grantedCreditsTotal: freePlan.monthlyCredits,
        consumedCreditsTotal: 0,
        createdByUserId: user.id,
      });

      await runtime.creditLedger.append({
        organizationId: organization.id,
        creditAccountId: creditAccount.id,
        kind: 'subscription_grant',
        deltaCredits: freePlan.monthlyCredits,
        balanceAfter: freePlan.monthlyCredits,
        note: 'Initial free credits',
        createdByUserId: user.id,
      });
    }
  }

  return {
    organization,
    workspace,
    subscription,
    creditAccount,
  };
}

async function createClerkPlaceholderUser(input: ClerkIdentityInput) {
  const runtime = getPlatformRuntime();
  return runtime.users.create({
    email: input.email.trim().toLowerCase(),
    displayName: resolveClerkDisplayName(input, input.email),
    authProvider: 'clerk',
    authUserId: null,
    avatarUrl: input.avatarUrl ?? null,
    preferredLocale: input.locale,
    status: 'active',
    emailVerifiedAt: input.emailVerified ? new Date().toISOString() : null,
    lastAuthSyncAt: new Date().toISOString(),
  });
}

function resolveClerkDisplayName(input: ClerkIdentityInput, fallbackEmail: string): string {
  const normalizedEmail = fallbackEmail.trim().toLowerCase();
  return input.displayName.trim() || normalizedEmail.split('@')[0] || 'Creator';
}

async function uniqueSlug(prefix: string, base: string): Promise<string> {
  const runtime = getPlatformRuntime();
  const slugBase = slugify(base);
  let suffix = 0;

  while (true) {
    const candidate = suffix === 0 ? slugBase : `${slugBase}-${suffix}`;
    const organization = await runtime.organizations.getBySlug(candidate);
    if (!organization) {
      return candidate || prefix;
    }
    suffix += 1;
  }
}
