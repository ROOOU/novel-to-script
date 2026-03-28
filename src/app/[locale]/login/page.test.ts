import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from '@/features/saas/LoginForm';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getCurrentViewer: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mocks.redirect(...args),
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

describe('login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the login form with the resolved locale only', async () => {
    mocks.getCurrentViewer.mockResolvedValue(null);

    const LoginPage = (await import('@/app/[locale]/login/page')).default;
    const page = await LoginPage({
      params: Promise.resolve({ locale: 'en-US' }),
    });

    expect(page.type).toBe(LoginForm);
    expect(page.props).toEqual({
      locale: 'en-US',
    });
  });

  it('redirects authenticated viewers to their project workspace locale', async () => {
    mocks.getCurrentViewer.mockResolvedValue({
      workspace: {
        defaultLocale: 'en-US',
      },
    });

    const LoginPage = (await import('@/app/[locale]/login/page')).default;
    await LoginPage({
      params: Promise.resolve({ locale: 'zh-CN' }),
    });

    expect(mocks.redirect).toHaveBeenCalledWith('/en-US/projects');
  });
});
