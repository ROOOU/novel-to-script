import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getCurrentViewer: vi.fn(),
  getDictionary: vi.fn(),
  listRedeemCodeCampaigns: vi.fn(),
  listPaymentOrdersByOrganizationId: vi.fn(),
  AdminClient: vi.fn(({ locale }: { locale: string }) => ({
    type: 'mock-admin-client',
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

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: () => ({
    redeemCodeCampaigns: {
      list: (...args: unknown[]) => mocks.listRedeemCodeCampaigns(...args),
    },
    paymentOrders: {
      listByOrganizationId: (...args: unknown[]) => mocks.listPaymentOrdersByOrganizationId(...args),
    },
  }),
}));

vi.mock('@/i18n/get-dictionary', () => ({
  getDictionary: (...args: unknown[]) => mocks.getDictionary(...args),
}));

vi.mock('@/features/saas/AdminClient', () => ({
  AdminClient: (props: { locale: string }) => mocks.AdminClient(props),
}));

describe('admin page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated viewers to the localized login wrapper with the admin path preserved', async () => {
    mocks.getCurrentViewer.mockResolvedValue(null);

    const AdminPage = (await import('@/app/[locale]/admin/page')).default;
    await expect(
      AdminPage({
        params: Promise.resolve({ locale: 'zh-CN' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mocks.redirect).toHaveBeenCalledWith('/zh-CN/login?redirect_url=%2Fzh-CN%2Fadmin');
    expect(mocks.getDictionary).not.toHaveBeenCalled();
    expect(mocks.listRedeemCodeCampaigns).not.toHaveBeenCalled();
    expect(mocks.listPaymentOrdersByOrganizationId).not.toHaveBeenCalled();
  });

  it('keeps authenticated admin viewers on the admin page', async () => {
    mocks.getCurrentViewer.mockResolvedValue({
      organization: { id: 'org_1' },
    });
    mocks.getDictionary.mockResolvedValue({ adminPage: {} });
    mocks.listRedeemCodeCampaigns.mockResolvedValue([]);
    mocks.listPaymentOrdersByOrganizationId.mockResolvedValue([]);

    const AdminPage = (await import('@/app/[locale]/admin/page')).default;
    const page = await AdminPage({
      params: Promise.resolve({ locale: 'en-US' }),
    });

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(page).toMatchObject({
      props: { locale: 'en-US' },
    });
  });
});
