import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getCurrentViewer: vi.fn(),
  getDictionary: vi.fn(),
  getBillingSummary: vi.fn(),
  RedeemClient: vi.fn(({ locale }: { locale: string }) => ({
    type: 'mock-redeem-client',
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

vi.mock('@/features/saas/RedeemClient', () => ({
  RedeemClient: (props: { locale: string }) => mocks.RedeemClient(props),
}));

describe('redeem page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated viewers to the localized login wrapper with the redeem path preserved', async () => {
    mocks.getCurrentViewer.mockResolvedValue(null);

    const RedeemPage = (await import('@/app/[locale]/redeem/page')).default;
    await expect(
      RedeemPage({
        params: Promise.resolve({ locale: 'en-US' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mocks.redirect).toHaveBeenCalledWith('/en-US/login?redirect_url=%2Fen-US%2Fredeem');
    expect(mocks.getDictionary).not.toHaveBeenCalled();
    expect(mocks.getBillingSummary).not.toHaveBeenCalled();
  });

  it('keeps authenticated redeem viewers on the redeem page', async () => {
    mocks.getCurrentViewer.mockResolvedValue({
      organization: { id: 'org_1' },
    });
    mocks.getDictionary.mockResolvedValue({ redeemPage: {} });
    mocks.getBillingSummary.mockResolvedValue({ ledgerEntries: [] });

    const RedeemPage = (await import('@/app/[locale]/redeem/page')).default;
    const page = await RedeemPage({
      params: Promise.resolve({ locale: 'zh-CN' }),
    });

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(page).toMatchObject({
      props: { locale: 'zh-CN' },
    });
  });
});
