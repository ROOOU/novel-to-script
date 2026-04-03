import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}));

vi.mock('@/server/billing/catalog', () => ({
  PLAN_CATALOG_ENTRIES: [
    {
      key: 'starter',
      name: { 'en-US': 'Starter', 'zh-CN': '入门版' },
      description: { 'en-US': 'Starter plan', 'zh-CN': '入门方案' },
      prices: { USD: { amountCents: 0 } },
      monthlyCredits: 10,
      entitlements: { maxConcurrentJobs: 1 },
    },
  ],
}));

describe('LandingPage', () => {
  it('routes the sign-in CTA through the localized login wrapper', async () => {
    const { LandingPage } = await import('@/features/landing/LandingPage');
    const html = renderToStaticMarkup(
      React.createElement(LandingPage, {
        locale: 'en-US',
        dictionary: {
          common: {
            brandBadge: 'Badge',
            language: 'Language',
            signIn: 'Sign in',
            signUp: 'Sign up',
            signOut: 'Sign out',
            pricing: 'Pricing',
            projects: 'Projects',
            billing: 'Billing',
            redeem: 'Redeem',
            admin: 'Admin',
            create: 'Create',
            cancel: 'Cancel',
            save: 'Save',
            loading: 'Loading',
            status: 'Status',
            credits: 'Credits',
            amount: 'Amount',
            backToProjects: 'Back to projects',
          },
          landing: {
            eyebrow: 'Eyebrow',
            title: 'Title',
            subtitle: 'Subtitle',
            primaryCta: 'Primary CTA',
            secondaryCta: 'Secondary CTA',
            bullets: ['One', 'Two', 'Three'],
          },
          pricingPage: {
            title: 'Pricing',
            subtitle: 'Subtitle',
            billingHint: 'Billing hint',
            packsTitle: 'Packs',
            manualHint: 'Manual hint',
            subscribe: 'Subscribe',
            buyCredits: 'Buy credits',
          },
        },
      })
    );

    expect(html).toContain('href="/en-US/login"');
    expect(html).toContain('href="/en-US/sign-up"');
    expect(html).not.toContain('href="/sign-in"');
  });
});
