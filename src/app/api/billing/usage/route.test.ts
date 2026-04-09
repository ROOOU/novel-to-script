import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireViewerResponse: vi.fn(),
  getBillingUsageSummary: vi.fn(),
}));

vi.mock('@/server/auth/http', () => ({
  requireViewerResponse: () => mocks.requireViewerResponse(),
}));

vi.mock('@/server/billing/usage', () => ({
  getBillingUsageSummary: (...args: unknown[]) => mocks.getBillingUsageSummary(...args),
}));

import { GET } from '@/app/api/billing/usage/route';

describe('billing usage route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireViewerResponse.mockResolvedValue({
      viewer: {
        organization: { id: 'org_1' },
      },
      response: null,
    });
    mocks.getBillingUsageSummary.mockResolvedValue({
      periodStart: '2026-03-01T00:00:00.000Z',
      periodEnd: '2026-04-01T00:00:00.000Z',
      totalCreditsConsumed: 53,
      totalCapturedJobs: 2,
      byProject: [],
      byTaskType: [],
    });
  });

  it('returns the auth response for unauthenticated requests', async () => {
    const responseMarker = new Response(null, { status: 401 });
    mocks.requireViewerResponse.mockResolvedValueOnce({
      viewer: null,
      response: responseMarker,
    });

    const response = await GET();

    expect(response).toBe(responseMarker);
    expect(mocks.getBillingUsageSummary).not.toHaveBeenCalled();
  });

  it('returns aggregated organization usage', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.getBillingUsageSummary).toHaveBeenCalledWith('org_1');
    await expect(response.json()).resolves.toEqual({
      ok: true,
      usage: {
        periodStart: '2026-03-01T00:00:00.000Z',
        periodEnd: '2026-04-01T00:00:00.000Z',
        totalCreditsConsumed: 53,
        totalCapturedJobs: 2,
        byProject: [],
        byTaskType: [],
      },
    });
  });
});
