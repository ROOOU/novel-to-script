import { compare, hash } from 'bcryptjs';
import { slugify } from '@/lib/slug';
import { getInitialBillingPreferences, getPlanCatalogEntry } from '@/server/billing/catalog';
import { getPlatformRuntime } from '@/server/shared/platform';
import type { SupportedLocale } from '@/server/shared/platform/domain';
import type { AppSession } from './session';
import { getCurrentSession } from './session';

export interface AuthenticateInput {
  email: string;
  password: string;
  displayName?: string;
  locale: SupportedLocale;
}

export interface ClerkIdentityInput {
  authUserId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  avatarUrl?: string | null;
  locale: SupportedLocale;
}

export async function syncViewerFromClerkIdentity(input: ClerkIdentityInput) {
  const runtime = getPlatformRuntime();
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedAuthUserId = input.authUserId.trim();

  const existingUserByAuthId = await runtime.users.getByAuthUserId(normalizedAuthUserId);
  if (existingUserByAuthId) {
    await runtime.users.update(existingUserByAuthId.id, {
      displayName: input.displayName,
      avatarUrl: input.avatarUrl ?? existingUserByAuthId.avatarUrl ?? null,
      preferredLocale: input.locale,
      emailVerifiedAt: input.emailVerified ? new Date().toISOString() : existingUserByAuthId.emailVerifiedAt ?? null,
      lastAuthSyncAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      updatedByUserId: existingUserByAuthId.id,
    });

    return buildViewerForUser(existingUserByAuthId.id);
  }

  const existingUserByEmail = await runtime.users.getByEmail(normalizedEmail);
  if (existingUserByEmail) {
    if (!input.emailVerified || existingUserByEmail.authUserId) {
      throw new Error('AUTH_ACCOUNT_LINK_CONFLICT');
    }

    await runtime.users.update(existingUserByEmail.id, {
      authProvider: 'clerk',
      authUserId: normalizedAuthUserId,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl ?? existingUserByEmail.avatarUrl ?? null,
      preferredLocale: input.locale,
      emailVerifiedAt: new Date().toISOString(),
      lastAuthSyncAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      updatedByUserId: existingUserByEmail.id,
    });

    return buildViewerForUser(existingUserByEmail.id);
  }

  return provisionViewerFromClerk(input);
}

export async function authenticateUser(input: AuthenticateInput): Promise<AppSession> {
  const runtime = getPlatformRuntime();
  const normalizedEmail = input.email.trim().toLowerCase();
  const password = input.password.trim();

  if (!normalizedEmail || !password) {
    throw new Error('Missing email or password');
  }

  const existingUser = await runtime.users.getByEmail(normalizedEmail);
  if (existingUser) {
    if (!existingUser.passwordHash || !(await compare(password, existingUser.passwordHash))) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const organizations = await runtime.organizations.listByOwnerUserId(existingUser.id);
    const organization = organizations[0];
    if (!organization) {
      throw new Error('MISSING_ORGANIZATION');
    }
    const workspaces = await runtime.workspaces.listByOrganizationId(organization.id);
    const workspace = workspaces[0];
    if (!workspace) {
      throw new Error('MISSING_WORKSPACE');
    }

    await runtime.users.update(existingUser.id, {
      lastLoginAt: new Date().toISOString(),
      preferredLocale: input.locale,
      updatedByUserId: existingUser.id,
    });

    return {
      userId: existingUser.id,
      email: existingUser.email,
      displayName: existingUser.displayName,
      organizationId: organization.id,
      workspaceId: workspace.id,
      locale: input.locale,
      issuedAt: new Date().toISOString(),
    };
  }

  const displayName = input.displayName?.trim() || normalizedEmail.split('@')[0] || 'Creator';
  const passwordHash = await hash(password, 10);
  const billingPreferences = getInitialBillingPreferences(input.locale);

  const user = await runtime.users.create({
    email: normalizedEmail,
    displayName,
    passwordHash,
    preferredLocale: input.locale,
    status: 'active',
  });

  const organization = await runtime.organizations.create({
    slug: await uniqueSlug('org', displayName),
    name: `${displayName}'s Studio`,
    ownerUserId: user.id,
    billingLocale: billingPreferences.locale,
    billingCurrency: billingPreferences.currency,
    pricingRegion: billingPreferences.pricingRegion,
    createdByUserId: user.id,
  });

  const workspace = await runtime.workspaces.create({
    organizationId: organization.id,
    slug: 'main',
    name: input.locale === 'en-US' ? 'Main Project Space' : '默认项目空间',
    defaultLocale: input.locale,
    createdByUserId: user.id,
  });

  await runtime.users.update(user.id, {
    defaultOrganizationId: organization.id,
    lastLoginAt: new Date().toISOString(),
    updatedByUserId: user.id,
  });

  const freePlan = getPlanCatalogEntry('free');
  await runtime.subscriptions.create({
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

  const creditAccount = await runtime.creditAccounts.create({
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

  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    organizationId: organization.id,
    workspaceId: workspace.id,
    locale: input.locale,
    issuedAt: new Date().toISOString(),
  };
}

export async function getCurrentViewer() {
  const session = await getCurrentSession();
  if (!session) {
    return null;
  }

  const runtime = getPlatformRuntime();
  const [user, organization, workspace, subscription, creditAccount] = await Promise.all([
    runtime.users.getById(session.userId),
    runtime.organizations.getById(session.organizationId),
    runtime.workspaces.getById(session.workspaceId),
    runtime.subscriptions.getCurrentByOrganizationId(session.organizationId),
    runtime.creditAccounts.getByOrganizationId(session.organizationId),
  ]);

  if (!user || !organization || !workspace) {
    return null;
  }

  return {
    session,
    user,
    organization,
    workspace,
    subscription,
    creditAccount,
  };
}

export async function buildViewerForUser(userId: string) {
  const runtime = getPlatformRuntime();
  const user = await runtime.users.getById(userId);

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const organizations = await runtime.organizations.listByOwnerUserId(user.id);
  const organization =
    organizations.find((candidate) => candidate.id === user.defaultOrganizationId) ?? organizations[0] ?? null;

  if (!organization) {
    throw new Error('MISSING_ORGANIZATION');
  }

  const workspaces = await runtime.workspaces.listByOrganizationId(organization.id);
  const workspace = workspaces[0] ?? null;

  if (!workspace) {
    throw new Error('MISSING_WORKSPACE');
  }

  const [subscription, creditAccount] = await Promise.all([
    runtime.subscriptions.getCurrentByOrganizationId(organization.id),
    runtime.creditAccounts.getByOrganizationId(organization.id),
  ]);

  return {
    user,
    organization,
    workspace,
    subscription,
    creditAccount,
  };
}

async function provisionViewerFromClerk(input: ClerkIdentityInput) {
  const runtime = getPlatformRuntime();
  const normalizedEmail = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim() || normalizedEmail.split('@')[0] || 'Creator';
  const billingPreferences = getInitialBillingPreferences(input.locale);
  const now = new Date().toISOString();

  const user = await runtime.users.create({
    email: normalizedEmail,
    displayName,
    authProvider: 'clerk',
    authUserId: input.authUserId.trim(),
    avatarUrl: input.avatarUrl ?? null,
    preferredLocale: input.locale,
    status: 'active',
    emailVerifiedAt: input.emailVerified ? now : null,
    lastAuthSyncAt: now,
  });

  const organization = await runtime.organizations.create({
    slug: await uniqueSlug('org', displayName),
    name: `${displayName}'s Studio`,
    ownerUserId: user.id,
    billingLocale: billingPreferences.locale,
    billingCurrency: billingPreferences.currency,
    pricingRegion: billingPreferences.pricingRegion,
    createdByUserId: user.id,
  });

  const workspace = await runtime.workspaces.create({
    organizationId: organization.id,
    slug: 'main',
    name: input.locale === 'en-US' ? 'Main Project Space' : '默认项目空间',
    defaultLocale: input.locale,
    createdByUserId: user.id,
  });

  await runtime.users.update(user.id, {
    defaultOrganizationId: organization.id,
    lastLoginAt: now,
    lastAuthSyncAt: now,
    updatedByUserId: user.id,
  });

  const freePlan = getPlanCatalogEntry('free');
  await runtime.subscriptions.create({
    organizationId: organization.id,
    provider: 'internal',
    planKey: freePlan.key,
    status: 'active',
    billingInterval: freePlan.billingInterval,
    entitlements: freePlan.entitlements,
    priceCents: freePlan.prices.USD.amountCents,
    currency: 'USD',
    currentPeriodStart: now,
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdByUserId: user.id,
  });

  const creditAccount = await runtime.creditAccounts.create({
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

  return buildViewerForUser(user.id);
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
