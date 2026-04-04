import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getBillingSummary: vi.fn(),
  getCurrentViewer: vi.fn(),
  getDictionary: vi.fn(),
  BillingClient: vi.fn(({ locale }: { locale: string }) => ({
    type: 'mock-billing-client',
    props: { locale },
  })),
}));

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mocks.redirect(...args);
    throw new Error('NEXT_REDIRECT');
  },
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

vi.mock('@/server/billing/payments', () => ({
  getBillingSummary: (...args: unknown[]) => mocks.getBillingSummary(...args),
}));

vi.mock('@/i18n/get-dictionary', () => ({
  getDictionary: (...args: unknown[]) => mocks.getDictionary(...args),
}));

vi.mock('@/features/saas/BillingClient', () => ({
  BillingClient: (props: { locale: string }) => mocks.BillingClient(props),
}));

describe('billing page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated viewers to the localized login wrapper with the billing path preserved', async () => {
    mocks.getCurrentViewer.mockResolvedValue(null);

    const BillingPage = (await import('@/app/[locale]/billing/page')).default;
    await expect(
      BillingPage({
        params: Promise.resolve({ locale: 'zh-CN' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mocks.redirect).toHaveBeenCalledWith('/zh-CN/login?redirect_url=%2Fzh-CN%2Fbilling');
    expect(mocks.getDictionary).not.toHaveBeenCalled();
    expect(mocks.getBillingSummary).not.toHaveBeenCalled();
  });

  it('keeps authenticated billing viewers on the billing page', async () => {
    mocks.getCurrentViewer.mockResolvedValue({
      organization: { id: 'org_1' },
    });
    mocks.getDictionary.mockResolvedValue({ billingPage: {} });
    mocks.getBillingSummary.mockResolvedValue({
      subscription: null,
      creditAccount: null,
      paymentOrders: [],
      ledgerEntries: [],
    });

    const BillingPage = (await import('@/app/[locale]/billing/page')).default;
    const page = await BillingPage({
      params: Promise.resolve({ locale: 'en-US' }),
      searchParams: Promise.resolve({}),
    });

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(page).toMatchObject({
      props: { locale: 'en-US' },
    });
  });
});
