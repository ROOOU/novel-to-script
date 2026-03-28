import { LandingPage } from '@/features/landing/LandingPage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDictionary: vi.fn(),
  getCurrentViewer: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mocks.redirect(...args),
}));

vi.mock('@/i18n/get-dictionary', () => ({
  getDictionary: (...args: unknown[]) => mocks.getDictionary(...args),
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

describe('LocalizedHomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDictionary.mockResolvedValue({
      common: {
        brandBadge: 'badge',
        signIn: 'sign in',
        signUp: 'sign up',
        signOut: 'sign out',
      },
      nav: {
        home: 'home',
        pricing: 'pricing',
        projects: 'projects',
        billing: 'billing',
        redeem: 'redeem',
        admin: 'admin',
      },
      landing: {
        eyebrow: 'eyebrow',
        subtitle: 'subtitle',
        headline: 'headline',
        description: 'description',
      },
    });
  });

  it('renders the landing page when auth lookup fails', async () => {
    mocks.getCurrentViewer.mockRejectedValue(new Error('AUTH_ACCOUNT_LINK_CONFLICT'));

    const LocalizedHomePage = (await import('@/app/[locale]/page')).default;
    const page = await LocalizedHomePage({
      params: Promise.resolve({ locale: 'zh-CN' }),
    });

    expect(page.type).toBe(LandingPage);
  });
});
