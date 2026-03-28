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

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: () => runtime,
}));

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

describe('syncViewerFromClerkIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.users.getByAuthUserId.mockResolvedValue(null);
    runtime.users.getByEmail.mockResolvedValue(null);
    runtime.organizations.getBySlug.mockResolvedValue(null);
    runtime.organizations.listByOwnerUserId.mockResolvedValue([
      {
        id: 'org_1',
        ownerUserId: 'user_1',
      },
    ]);
    runtime.workspaces.listByOrganizationId.mockResolvedValue([
      {
        id: 'ws_1',
        organizationId: 'org_1',
      },
    ]);
    runtime.users.create.mockResolvedValue({
      id: 'user_1',
      email: 'creator@example.com',
      displayName: 'Creator',
      authProvider: 'clerk',
      authUserId: 'clerk_user_1',
    });
    runtime.organizations.create.mockResolvedValue({
      id: 'org_1',
      ownerUserId: 'user_1',
    });
    runtime.workspaces.create.mockResolvedValue({
      id: 'ws_1',
      organizationId: 'org_1',
    });
    runtime.creditAccounts.create.mockResolvedValue({
      id: 'credit_1',
      organizationId: 'org_1',
      availableCredits: 100,
    });
    runtime.subscriptions.getCurrentByOrganizationId.mockResolvedValue(null);
    runtime.creditAccounts.getByOrganizationId.mockResolvedValue(null);
    runtime.users.getById.mockResolvedValue({
      id: 'user_1',
      email: 'creator@example.com',
      displayName: 'Creator',
    });
    runtime.organizations.getById.mockResolvedValue({
      id: 'org_1',
      ownerUserId: 'user_1',
    });
    runtime.workspaces.getById.mockResolvedValue({
      id: 'ws_1',
      organizationId: 'org_1',
    });
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
        authUserId: 'clerk_user_1',
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

  it('rejects linking when the Clerk email is not verified', async () => {
    runtime.users.getByEmail.mockResolvedValueOnce({
      id: 'user_legacy_1',
      email: 'creator@example.com',
      displayName: 'Legacy Creator',
      authUserId: null,
    });

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
});
