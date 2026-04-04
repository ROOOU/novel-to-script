import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireViewerPlatformContext: vi.fn(),
  getPlatformRuntime: vi.fn(),
  grantCredits: vi.fn(),
}));

vi.mock('@/server/auth/http', () => ({
  requireViewerPlatformContext: (...args: unknown[]) => mocks.requireViewerPlatformContext(...args),
}));

vi.mock('@/server/shared/platform', async () => {
  const actual = await vi.importActual<typeof import('@/server/shared/platform')>(
    '@/server/shared/platform'
  );

  return {
    ...actual,
    getPlatformRuntime: () => mocks.getPlatformRuntime(),
  };
});

vi.mock('@/server/billing/service', () => ({
  grantCredits: (...args: unknown[]) => mocks.grantCredits(...args),
}));

describe('redeem codes route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireViewerPlatformContext.mockResolvedValue({
      viewer: {
        user: { id: 'user_1' },
        organization: { id: 'org_1' },
        workspace: { id: 'ws_1' },
      },
      response: null,
      context: {
        requestId: 'req_1',
        traceId: 'trace_1',
        clientIp: '127.0.0.1',
        userAgent: null,
        referer: null,
        locale: null,
        workspaceId: 'ws_1',
        organizationId: 'org_1',
        projectId: null,
        source: 'session',
        userId: 'user_1',
        sessionId: null,
        plan: 'creator',
      },
    });
  });

  it('redeems codes with platform headers', async () => {
    mocks.getPlatformRuntime.mockReturnValue({
      redeemCodes: {
        getByCode: vi.fn().mockResolvedValue({
          id: 'redeem_1',
          campaignId: 'campaign_1',
          code: 'NS-ABC123',
          status: 'active',
          expiresAt: null,
          redeemedCount: 0,
          maxRedemptions: 1,
          creditsGranted: 100,
        }),
        update: vi.fn(),
      },
      redeemCodeRedemptions: {
        listByRedeemCodeId: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'redemption_1' }),
      },
      redeemCodeCampaigns: {
        getById: vi.fn().mockResolvedValue({
          id: 'campaign_1',
          status: 'active',
          endsAt: null,
        }),
      },
    });
    mocks.grantCredits.mockResolvedValue({
      account: { id: 'credit_account_1' },
      ledgerEntry: { id: 'ledger_1' },
    });

    const { POST } = await import('@/app/api/redeem-codes/redeem/route');
    const response = await POST(
      new NextRequest('https://app.test/api/redeem-codes/redeem', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'NS-ABC123' }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('req_1');
    expect(response.headers.get('x-trace-id')).toBe('trace_1');
    await expect(response.json()).resolves.toEqual({
      ok: true,
      redemption: { id: 'redemption_1' },
      creditAccount: { id: 'credit_account_1' },
    });
  });

  it('rejects repeat redemptions from the same organization without granting credits again', async () => {
    const getByCode = vi.fn().mockResolvedValue({
      id: 'redeem_1',
      campaignId: 'campaign_1',
      code: 'NS-ABC123',
      status: 'active',
      expiresAt: null,
      redeemedCount: 1,
      maxRedemptions: 10,
      creditsGranted: 100,
    });
    const listByRedeemCodeId = vi.fn().mockResolvedValue([
      {
        id: 'redemption_0',
        organizationId: 'org_1',
        userId: 'user_2',
      },
    ]);
    const update = vi.fn();
    const create = vi.fn();
    const getById = vi.fn();

    mocks.getPlatformRuntime.mockReturnValue({
      redeemCodes: {
        getByCode,
        update,
      },
      redeemCodeRedemptions: {
        listByRedeemCodeId,
        create,
      },
      redeemCodeCampaigns: {
        getById,
      },
    });

    const { POST } = await import('@/app/api/redeem-codes/redeem/route');
    const response = await POST(
      new NextRequest('https://app.test/api/redeem-codes/redeem', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'NS-ABC123' }),
      })
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('x-request-id')).toBe('req_1');
    expect(response.headers.get('x-trace-id')).toBe('trace_1');
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'REDEEM_CODE_ALREADY_USED',
    });
    expect(mocks.grantCredits).not.toHaveBeenCalled();
    expect(getById).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('returns platform headers for invalid codes', async () => {
    mocks.getPlatformRuntime.mockReturnValue({
      redeemCodes: {
        getByCode: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
      redeemCodeRedemptions: {
        listByRedeemCodeId: vi.fn(),
        create: vi.fn(),
      },
      redeemCodeCampaigns: {
        getById: vi.fn(),
      },
    });

    const { POST } = await import('@/app/api/redeem-codes/redeem/route');
    const response = await POST(
      new NextRequest('https://app.test/api/redeem-codes/redeem', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'MISSING' }),
      })
    );

    expect(response.status).toBe(400);
    expect(response.headers.get('x-request-id')).toBe('req_1');
    expect(response.headers.get('x-trace-id')).toBe('trace_1');
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'REDEEM_CODE_NOT_FOUND',
    });
  });

  it('rolls back provisional credits when redemption create hits unique conflict', async () => {
    const create = vi.fn().mockRejectedValue({ code: '23505' });
    const update = vi.fn();
    mocks.getPlatformRuntime.mockReturnValue({
      redeemCodes: {
        getByCode: vi.fn().mockResolvedValue({
          id: 'redeem_1',
          campaignId: 'campaign_1',
          code: 'NS-ABC123',
          status: 'active',
          expiresAt: null,
          redeemedCount: 0,
          maxRedemptions: 2,
          creditsGranted: 100,
        }),
        update,
      },
      redeemCodeRedemptions: {
        listByRedeemCodeId: vi.fn().mockResolvedValue([]),
        create,
      },
      redeemCodeCampaigns: {
        getById: vi.fn().mockResolvedValue({
          id: 'campaign_1',
          status: 'active',
          endsAt: null,
        }),
      },
    });

    mocks.grantCredits
      .mockResolvedValueOnce({
        account: { id: 'credit_account_1' },
        ledgerEntry: { id: 'ledger_1' },
      })
      .mockResolvedValueOnce({
        account: { id: 'credit_account_1' },
        ledgerEntry: { id: 'ledger_rollback_1' },
      });

    const { POST } = await import('@/app/api/redeem-codes/redeem/route');
    const response = await POST(
      new NextRequest('https://app.test/api/redeem-codes/redeem', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'NS-ABC123' }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'REDEEM_CODE_ALREADY_USED',
    });
    expect(update).not.toHaveBeenCalled();
    expect(mocks.grantCredits).toHaveBeenCalledTimes(2);
    expect(mocks.grantCredits).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        kind: 'manual_adjustment',
        credits: -100,
        redeemCodeId: 'redeem_1',
      })
    );
  });
});
