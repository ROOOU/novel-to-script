import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({
  useClerk: vi.fn(() => ({ signOut: vi.fn() })),
  useUser: vi.fn((): any => ({
    isLoaded: true,
    isSignedIn: false,
    user: null,
  })),
  usePathname: vi.fn(() => '/en-US'),
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

vi.mock('@clerk/nextjs', () => ({
  useClerk: mocks.useClerk,
  useUser: mocks.useUser,
}));

vi.mock('next/navigation', () => ({
  usePathname: mocks.usePathname,
  useRouter: mocks.useRouter,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}));

vi.mock('@/app/nav-links', () => ({
  NavLinks: () => React.createElement('nav', null, 'nav'),
}));

vi.mock('@/components/MobileNav', () => ({
  MobileNav: ({ signedIn }: { signedIn: boolean }) => React.createElement('div', { 'data-mobile-signed-in': signedIn }),
}));

describe('AppShellHeader', () => {
  it('only loads billing summary when the server confirmed auth state', async () => {
    const { shouldFetchBillingSummary } = await import('@/components/AppShellHeader');

    expect(shouldFetchBillingSummary(false)).toBe(false);
    expect(shouldFetchBillingSummary(true)).toBe(true);
  });

  it('routes signed-out header auth entry through the localized login wrapper', async () => {
    mocks.useUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
      user: null,
    });

    const { AppShellHeader } = await import('@/components/AppShellHeader');
    const html = renderToStaticMarkup(
      React.createElement(AppShellHeader, {
        locale: 'zh-CN',
        signedIn: false,
        labels: {
          brandBadge: 'Beta',
          signIn: '登录',
          signUp: '注册',
          signOut: '退出',
          home: '首页',
          pricing: '价格',
          projects: '项目',
          billing: '账单',
          redeem: '兑换',
          admin: '管理',
        },
        userDisplayName: null,
        initialCredits: null,
      })
    );

    expect(html).toContain('href="/zh-CN/login"');
    expect(html).toContain('href="/zh-CN/sign-up"');
    expect(html).not.toContain('href="/sign-in"');
  });

  it('shows the signed-in account state when Clerk is signed in on the client', async () => {
    mocks.useUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: {
        firstName: 'Sheng',
        lastName: 'Yu',
        username: null,
        primaryEmailAddress: { emailAddress: 'sheng@example.com' },
      },
    });

    const { AppShellHeader } = await import('@/components/AppShellHeader');
    const html = renderToStaticMarkup(
      React.createElement(AppShellHeader, {
        locale: 'en-US',
        signedIn: false,
        labels: {
          brandBadge: 'Beta',
          signIn: 'Sign in',
          signUp: 'Sign up',
          signOut: 'Sign out',
          home: 'Home',
          pricing: 'Pricing',
          projects: 'Projects',
          billing: 'Billing',
          redeem: 'Redeem',
          admin: 'Admin',
        },
        userDisplayName: null,
        initialCredits: null,
      })
    );

    expect(html).toContain('Sign out');
    expect(html).toContain('Sheng Yu');
    expect(html).not.toContain('href="/sign-in"');
    expect(html).not.toContain('href="/sign-up"');
  });
});
