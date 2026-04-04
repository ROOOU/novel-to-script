import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentViewer: vi.fn(),
  getBillingSummary: vi.fn(),
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

vi.mock('@/server/billing/payments', () => ({
  getBillingSummary: (...args: unknown[]) => mocks.getBillingSummary(...args),
}));

describe('billing summary api route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentViewer.mockResolvedValue({
      user: { id: 'user_1', email: 'creator@example.com' },
      organization: { id: 'org_1' },
      workspace: { id: 'ws_1' },
      session: { locale: 'zh-CN' },
      subscription: null,
      creditAccount: null,
    });
    mocks.getBillingSummary.mockResolvedValue({
      subscription: { status: 'active' },
      creditAccount: { credits: 42 },
      paymentOrders: [],
      ledgerEntries: [],
    });
  });

  it('returns platform headers on successful summary requests', async () => {
    const { GET } = await import('@/app/api/billing/summary/route');
    const response = await GET(new NextRequest('https://app.test/api/billing/summary', {
      headers: { 'x-plan': 'creator' },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    expect(response.headers.get('x-platform-plan')).toBe('creator');
    expect(response.headers.get('x-organization-id')).toBe('org_1');
    expect(response.headers.get('x-workspace-id')).toBe('ws_1');
    await expect(response.json()).resolves.toEqual({
      ok: true,
      subscription: { status: 'active' },
      creditAccount: { credits: 42 },
      paymentOrders: [],
      ledgerEntries: [],
    });
  });

  it('returns unauthorized with platform headers when no viewer is present', async () => {
    mocks.getCurrentViewer.mockResolvedValue(null);

    const { GET } = await import('@/app/api/billing/summary/route');
    const response = await GET(new NextRequest('https://app.test/api/billing/summary'));

    expect(response.status).toBe(401);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    expect(response.headers.get('x-platform-plan')).toBe('free');
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'UNAUTHORIZED',
    });
  });
});
