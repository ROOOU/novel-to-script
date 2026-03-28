import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDictionary: vi.fn(),
  getCurrentViewer: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => mocks.notFound(),
}));

vi.mock('@/i18n/get-dictionary', () => ({
  getDictionary: (...args: unknown[]) => mocks.getDictionary(...args),
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

describe('LocaleLayout', () => {
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
      },
    });
  });

  it('renders the public shell when auth lookup fails', async () => {
    mocks.getCurrentViewer.mockRejectedValue(new Error('CLERK_PRIMARY_EMAIL_MISSING'));

    const LocaleLayout = (await import('@/app/[locale]/layout')).default;
    const page = await LocaleLayout({
      children: <div>child</div>,
      params: Promise.resolve({ locale: 'zh-CN' }),
    });

    const header = Array.isArray(page.props.children) ? page.props.children[0] : page.props.children;
    expect(header.props.signedIn).toBe(false);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
