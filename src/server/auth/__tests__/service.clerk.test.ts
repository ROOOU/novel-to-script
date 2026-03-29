import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  users: {
    getByEmail: vi.fn(),
    getByAuthUserId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    getById: vi.fn(),
  },
  organizations: {
    getById: vi.fn(),
    getBySlug: vi.fn(),
    listByOwnerUserId: vi.fn(),
    create: vi.fn(),
  },
  workspaces: {
    getById: vi.fn(),
    listByOrganizationId: vi.fn(),
    create: vi.fn(),
  },
  subscriptions: {
    getCurrentByOrganizationId: vi.fn(),
    create: vi.fn(),
  },
  creditAccounts: {
    getByOrganizationId: vi.fn(),
    create: vi.fn(),
  },
  creditLedger: {
    append: vi.fn(),
  },
}));

const clerkIdentity = vi.hoisted(() => ({
  getCurrentClerkIdentity: vi.fn(),
}));

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: () => runtime,
}));

vi.mock('@/server/auth/session', () => clerkIdentity);

vi.mock('@/server/billing/catalog', () => ({
  getInitialBillingPreferences: vi.fn(() => ({
    locale: 'en-US',
    currency: 'USD',
    pricingRegion: 'global',
  })),
  getPlanCatalogEntry: vi.fn(() => ({
    key: 'free',
    billingInterval: 'monthly',
    entitlements: { monthlyCredits: 100 },
    prices: { USD: { amountCents: 0 } },
    monthlyCredits: 100,
  })),
}));

describe('Clerk auth sync', () => {
  const now = '2026-03-29T00:00:00.000Z';
  let store: {
    user: any;
    organization: any;
    workspace: any;
    subscription: any;
    creditAccount: any;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    store = {
      user: null,
      organization: null,
      workspace: null,
      subscription: null,
      creditAccount: null,
    };

    runtime.users.getByAuthUserId.mockImplementation(async (authUserId: string) => {
      if (store.user?.authUserId === authUserId) {
        return store.user;
      }

      return null;
    });
    runtime.users.getByEmail.mockImplementation(async (email: string) => {
      if (store.user?.email === email.trim().toLowerCase()) {
        return store.user;
      }

      return null;
    });
    runtime.users.create.mockImplementation(async (input: any) => {
      store.user = {
        id: 'user_1',
        email: input.email.trim().toLowerCase(),
        displayName: input.displayName.trim(),
        authProvider: input.authProvider ?? null,
        authUserId: input.authUserId ?? null,
        avatarUrl: input.avatarUrl ?? null,
        preferredLocale: input.preferredLocale ?? 'zh-CN',
        defaultOrganizationId: input.defaultOrganizationId ?? null,
        status: input.status ?? 'active',
        emailVerifiedAt: input.emailVerifiedAt ?? null,
        lastAuthSyncAt: input.lastAuthSyncAt ?? null,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
      };
      return store.user;
    });
    runtime.users.update.mockImplementation(async (id: string, input: any) => {
      if (!store.user || store.user.id !== id) {
        throw new Error('USER_NOT_FOUND_IN_TEST_STORE');
      }

      store.user = {
        ...store.user,
        ...input,
        updatedAt: now,
      };
      return store.user;
    });
    runtime.users.getById.mockImplementation(async (id: string) => (store.user?.id === id ? store.user : null));

    runtime.organizations.getBySlug.mockImplementation(async (slug: string) =>
      store.organization?.slug === slug ? store.organization : null
    );
    runtime.organizations.listByOwnerUserId.mockImplementation(async (userId: string) =>
      store.organization?.ownerUserId === userId ? [store.organization] : []
    );
    runtime.organizations.create.mockImplementation(async (input: any) => {
      store.organization = {
        id: 'org_1',
        slug: input.slug,
        name: input.name,
        ownerUserId: input.ownerUserId,
        billingLocale: input.billingLocale,
        billingCurrency: input.billingCurrency,
        pricingRegion: input.pricingRegion,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
      };
      return store.organization;
    });
    runtime.organizations.getById.mockImplementation(async (id: string) => (store.organization?.id === id ? store.organization : null));

    runtime.workspaces.listByOrganizationId.mockImplementation(async (organizationId: string) =>
      store.workspace?.organizationId === organizationId ? [store.workspace] : []
    );
    runtime.workspaces.create.mockImplementation(async (input: any) => {
      store.workspace = {
        id: 'ws_1',
        organizationId: input.organizationId,
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        status: 'active',
        defaultLocale: input.defaultLocale ?? 'zh-CN',
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
      };
      return store.workspace;
    });
    runtime.workspaces.getById.mockImplementation(async (id: string) => (store.workspace?.id === id ? store.workspace : null));

    runtime.subscriptions.getCurrentByOrganizationId.mockImplementation(async (organizationId: string) =>
      store.subscription?.organizationId === organizationId ? store.subscription : null
    );
    runtime.subscriptions.create.mockImplementation(async (input: any) => {
      store.subscription = {
        id: 'sub_1',
        organizationId: input.organizationId,
        provider: input.provider,
        planKey: input.planKey,
        status: input.status,
        billingInterval: input.billingInterval,
        entitlements: input.entitlements,
        priceCents: input.priceCents,
        currency: input.currency,
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
      };
      return store.subscription;
    });

    runtime.creditAccounts.getByOrganizationId.mockImplementation(async (organizationId: string) =>
      store.creditAccount?.organizationId === organizationId ? store.creditAccount : null
    );
    runtime.creditAccounts.create.mockImplementation(async (input: any) => {
      store.creditAccount = {
        id: 'credit_1',
        organizationId: input.organizationId,
        availableCredits: input.availableCredits,
        reservedCredits: input.reservedCredits,
        grantedCreditsTotal: input.grantedCreditsTotal,
        consumedCreditsTotal: input.consumedCreditsTotal,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
      };
      return store.creditAccount;
    });

    runtime.creditLedger.append.mockImplementation(async (input: any) => ({
      id: 'ledger_1',
      ...input,
      createdAt: now,
      updatedAt: now,
      createdByUserId: input.createdByUserId ?? null,
      updatedByUserId: input.createdByUserId ?? null,
    }));

    clerkIdentity.getCurrentClerkIdentity.mockResolvedValue(null);
  });

  it('creates a local business user and default tenancy for a new Clerk identity', async () => {
    const { syncViewerFromClerkIdentity } = await import('@/server/auth/service');

    const viewer = await syncViewerFromClerkIdentity({
      authUserId: 'clerk_user_1',
      email: 'creator@example.com',
      emailVerified: true,
      displayName: 'Creator',
      avatarUrl: 'https://example.com/avatar.png',
      locale: 'en-US',
    });

    expect(runtime.users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'creator@example.com',
        displayName: 'Creator',
        authProvider: 'clerk',
        authUserId: null,
      })
    );
    expect(runtime.users.update).toHaveBeenCalledWith(
      'user_1',
      expect.objectContaining({
        authProvider: 'clerk',
        authUserId: 'clerk_user_1',
        defaultOrganizationId: 'org_1',
      })
    );
    expect(runtime.organizations.create).toHaveBeenCalled();
    expect(runtime.workspaces.create).toHaveBeenCalled();
    expect(runtime.subscriptions.create).toHaveBeenCalled();
    expect(runtime.creditAccounts.create).toHaveBeenCalled();
    expect(runtime.creditLedger.append).toHaveBeenCalled();
    expect(viewer).toMatchObject({
      user: {
        id: 'user_1',
      },
      organization: {
        id: 'org_1',
      },
      workspace: {
        id: 'ws_1',
      },
    });
  });

  it('deduplicates concurrent first requests for the same Clerk identity', async () => {
    let releaseCreate: ((value: any) => void) | undefined;
    const createPromise = new Promise((resolve) => {
      releaseCreate = (value: any) => {
        store.user = value;
        resolve(value);
      };
    });

    runtime.users.create.mockReturnValueOnce(createPromise);

    const { syncViewerFromClerkIdentity } = await import('@/server/auth/service');

    const first = syncViewerFromClerkIdentity({
      authUserId: 'clerk_user_1',
      email: 'creator@example.com',
      emailVerified: true,
      displayName: 'Creator',
      locale: 'en-US',
    });
    const second = syncViewerFromClerkIdentity({
      authUserId: 'clerk_user_1',
      email: 'creator@example.com',
      emailVerified: true,
      displayName: 'Creator',
      locale: 'en-US',
    });

    await vi.waitFor(() => expect(runtime.users.create).toHaveBeenCalledTimes(1));
    releaseCreate?.({
      id: 'user_1',
      email: 'creator@example.com',
      displayName: 'Creator',
      authProvider: 'clerk',
      authUserId: null,
      avatarUrl: null,
      preferredLocale: 'en-US',
      defaultOrganizationId: null,
      status: 'active',
      emailVerifiedAt: now,
      lastAuthSyncAt: now,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      updatedByUserId: null,
    });

    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({
        user: expect.objectContaining({ id: 'user_1' }),
      }),
      expect.objectContaining({
        user: expect.objectContaining({ id: 'user_1' }),
      }),
    ]);
    expect(runtime.users.create).toHaveBeenCalledTimes(1);
  });

  it('repairs a partially provisioned Clerk user after a mid-flight failure', async () => {
    const partialUser = {
      id: 'user_legacy_1',
      email: 'creator@example.com',
      displayName: 'Legacy Creator',
      authProvider: 'clerk',
      authUserId: null,
      avatarUrl: null,
      preferredLocale: 'en-US',
      defaultOrganizationId: null,
      status: 'active',
      emailVerifiedAt: null,
      lastAuthSyncAt: now,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      updatedByUserId: null,
    };

    runtime.users.create.mockImplementationOnce(async () => {
      store.user = partialUser;
      return partialUser;
    });
    runtime.organizations.create.mockRejectedValueOnce(new Error('MID_FLIGHT_ORG_CREATE_FAILED'));

    const { syncViewerFromClerkIdentity } = await import('@/server/auth/service');

    await expect(
      syncViewerFromClerkIdentity({
        authUserId: 'clerk_user_1',
        email: 'creator@example.com',
        emailVerified: true,
        displayName: 'Creator',
        locale: 'en-US',
      })
    ).rejects.toThrow('MID_FLIGHT_ORG_CREATE_FAILED');

    await expect(
      syncViewerFromClerkIdentity({
        authUserId: 'clerk_user_1',
        email: 'creator@example.com',
        emailVerified: true,
        displayName: 'Creator',
        locale: 'en-US',
      })
    ).resolves.toMatchObject({
      user: expect.objectContaining({
        id: 'user_legacy_1',
        authUserId: 'clerk_user_1',
        defaultOrganizationId: 'org_1',
      }),
      organization: expect.objectContaining({
        id: 'org_1',
      }),
      workspace: expect.objectContaining({
        id: 'ws_1',
      }),
    });
    expect(runtime.users.create).toHaveBeenCalledTimes(1);
    expect(runtime.organizations.create).toHaveBeenCalled();
    expect(runtime.workspaces.create).toHaveBeenCalledTimes(1);
  });

  it('recovers when placeholder user creation loses a race on the unique email constraint', async () => {
    const racedUser = {
      id: 'user_race_1',
      email: 'creator@example.com',
      displayName: 'Creator',
      authProvider: 'clerk',
      authUserId: null,
      avatarUrl: null,
      preferredLocale: 'en-US',
      defaultOrganizationId: null,
      status: 'active',
      emailVerifiedAt: now,
      lastAuthSyncAt: now,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      updatedByUserId: null,
    };

    runtime.users.create.mockImplementationOnce(async () => {
      store.user = racedUser;
      throw new Error('duplicate key value violates unique constraint "users_email_idx"');
    });

    const { syncViewerFromClerkIdentity } = await import('@/server/auth/service');

    await expect(
      syncViewerFromClerkIdentity({
        authUserId: 'clerk_user_1',
        email: 'creator@example.com',
        emailVerified: true,
        displayName: 'Creator',
        locale: 'en-US',
      })
    ).resolves.toMatchObject({
      user: expect.objectContaining({
        id: 'user_race_1',
        authUserId: 'clerk_user_1',
      }),
      organization: expect.objectContaining({
        id: 'org_1',
      }),
      workspace: expect.objectContaining({
        id: 'ws_1',
      }),
    });
  });

  it('links a verified legacy user by email without recreating tenancy', async () => {
    store.user = {
      id: 'user_legacy_1',
      email: 'creator@example.com',
      displayName: 'Legacy Creator',
      authProvider: null,
      authUserId: null,
      avatarUrl: null,
      preferredLocale: 'zh-CN',
      defaultOrganizationId: 'org_1',
      status: 'active',
      emailVerifiedAt: null,
      lastAuthSyncAt: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      updatedByUserId: null,
    };
    store.organization = {
      id: 'org_1',
      slug: 'legacy-creator',
      name: 'Legacy Creator Studio',
      ownerUserId: 'user_legacy_1',
      billingLocale: 'en-US',
      billingCurrency: 'USD',
      pricingRegion: 'global',
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      updatedByUserId: null,
    };
    store.workspace = {
      id: 'ws_1',
      organizationId: 'org_1',
      slug: 'main',
      name: 'Main Project Space',
      description: null,
      status: 'active',
      defaultLocale: 'en-US',
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      updatedByUserId: null,
    };
    store.subscription = {
      id: 'sub_1',
      organizationId: 'org_1',
      provider: 'internal',
      planKey: 'free',
      status: 'active',
      billingInterval: 'monthly',
      entitlements: { monthlyCredits: 100 },
      priceCents: 0,
      currency: 'USD',
      currentPeriodStart: now,
      currentPeriodEnd: now,
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      updatedByUserId: null,
    };
    store.creditAccount = {
      id: 'credit_1',
      organizationId: 'org_1',
      availableCredits: 100,
      reservedCredits: 0,
      grantedCreditsTotal: 100,
      consumedCreditsTotal: 0,
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      updatedByUserId: null,
    };

    const { syncViewerFromClerkIdentity } = await import('@/server/auth/service');

    const viewer = await syncViewerFromClerkIdentity({
      authUserId: 'clerk_user_legacy',
      email: 'creator@example.com',
      emailVerified: true,
      displayName: 'Creator',
      avatarUrl: 'https://example.com/avatar.png',
      locale: 'en-US',
    });

    expect(runtime.users.create).not.toHaveBeenCalled();
    expect(runtime.organizations.create).not.toHaveBeenCalled();
    expect(runtime.workspaces.create).not.toHaveBeenCalled();
    expect(runtime.creditAccounts.create).not.toHaveBeenCalled();
    expect(runtime.users.update).toHaveBeenCalledWith(
      'user_legacy_1',
      expect.objectContaining({
        authProvider: 'clerk',
        authUserId: 'clerk_user_legacy',
        preferredLocale: 'en-US',
      })
    );
    expect(viewer).toMatchObject({
      user: {
        id: 'user_legacy_1',
        authUserId: 'clerk_user_legacy',
      },
      organization: {
        id: 'org_1',
      },
      workspace: {
        id: 'ws_1',
      },
    });
  });

  it('rejects linking when the Clerk email is not verified', async () => {
    store.user = {
      id: 'user_legacy_1',
      email: 'creator@example.com',
      displayName: 'Legacy Creator',
      authProvider: null,
      authUserId: null,
      avatarUrl: null,
      preferredLocale: 'en-US',
      defaultOrganizationId: null,
      status: 'active',
      emailVerifiedAt: null,
      lastAuthSyncAt: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      updatedByUserId: null,
    };

    const { syncViewerFromClerkIdentity } = await import('@/server/auth/service');

    await expect(
      syncViewerFromClerkIdentity({
        authUserId: 'clerk_user_2',
        email: 'creator@example.com',
        emailVerified: false,
        displayName: 'Creator',
        locale: 'en-US',
      })
    ).rejects.toThrow('AUTH_ACCOUNT_LINK_CONFLICT');
  });

  it('returns null for recoverable Clerk sync failures in read paths', async () => {
    clerkIdentity.getCurrentClerkIdentity.mockResolvedValue({
      authUserId: 'clerk_user_1',
      email: 'creator@example.com',
      emailVerified: true,
      displayName: 'Creator',
      locale: 'en-US',
    });
    store.user = {
      id: 'user_legacy_1',
      email: 'creator@example.com',
      displayName: 'Legacy Creator',
      authProvider: 'clerk',
      authUserId: 'clerk_user_2',
      avatarUrl: null,
      preferredLocale: 'en-US',
      defaultOrganizationId: null,
      status: 'active',
      emailVerifiedAt: null,
      lastAuthSyncAt: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      createdByUserId: null,
      updatedByUserId: null,
    };

    const { getCurrentViewer } = await import('@/server/auth/service');

    await expect(getCurrentViewer()).resolves.toBeNull();
  });
});
