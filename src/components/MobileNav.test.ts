import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mocks = vi.hoisted(() => ({
  useState: vi.fn(() => [true, vi.fn()]),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: mocks.useState,
  };
});

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}));

vi.mock('@/app/nav-links', () => ({
  NavLinks: () => React.createElement('nav', null, 'nav'),
}));

describe('MobileNav', () => {
  it('routes signed-out mobile auth entry through the localized login wrapper', async () => {
    const { MobileNav } = await import('@/components/MobileNav');
    const html = renderToStaticMarkup(
      React.createElement(MobileNav, {
        locale: 'en-US',
        pathname: '/en-US',
        navLabels: {
          projects: 'Projects',
          pricing: 'Pricing',
        },
        authLabels: {
          signIn: 'Sign in',
          signUp: 'Sign up',
          signOut: 'Sign out',
          credits: 'credits',
        },
        signedIn: false,
        userDisplayName: null,
        userInitials: 'NS',
        availableCredits: null,
        onSignOut: vi.fn(),
      })
    );

    expect(html).toContain('href="/en-US/login"');
    expect(html).toContain('href="/en-US/sign-up"');
    expect(html).not.toContain('href="/sign-in"');
  });
});
