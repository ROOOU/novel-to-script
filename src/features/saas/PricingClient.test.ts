import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  useRouter: vi.fn(() => ({
    push: mocks.push,
    refresh: mocks.refresh,
  })),
  useState: vi.fn((initial: unknown) => [initial, vi.fn()]),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: mocks.useState,
    startTransition: (callback: () => void) => callback(),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: mocks.useRouter,
}));

function asElement(node: unknown): React.ReactElement<{ children?: React.ReactNode }> {
  if (!React.isValidElement(node)) {
    throw new Error('Expected a React element');
  }

  return node as React.ReactElement<{ children?: React.ReactNode }>;
}

function childrenOf(node: unknown): React.ReactNode[] {
  return React.Children.toArray(asElement(node).props.children);
}

describe('PricingClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', {
      location: {
        origin: 'https://app.012294.xyz',
        assign: vi.fn(),
      },
    } as never);
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.012294.xyz';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it('redirects 401 pricing checkout failures through the localized login wrapper', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ ok: false }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { PricingClient } = await import('@/features/saas/PricingClient');
    const tree = PricingClient({
      locale: 'en-US',
      plans: [
        {
          key: 'creator',
          name: { 'en-US': 'Creator', 'zh-CN': '创作者版' },
          description: { 'en-US': 'Creator plan', 'zh-CN': '创作者方案' },
          prices: { USD: { amountCents: 1000 } },
          monthlyCredits: 100,
        } as never,
      ],
      creditPacks: [],
      labels: {
        title: 'Pricing',
        subtitle: 'Subtitle',
        billingHint: 'Billing hint',
        packsTitle: 'Packs',
        manualHint: 'Manual hint',
        subscribe: 'Subscribe',
        buyCredits: 'Buy credits',
      },
    });

    const button = childrenOf(tree)
      .flatMap((child) => childrenOf(child))
      .flatMap((child) => childrenOf(child))
      .find((child) => React.isValidElement(child) && child.type === 'button');

    if (!button || !React.isValidElement(button)) {
      throw new Error('Expected checkout button');
    }

    await (button.props as { onClick: () => Promise<void> }).onClick();
    await Promise.resolve();

    expect((window.location.assign as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      'https://app.012294.xyz/en-US/login?redirect_url=https%3A%2F%2Fapp.012294.xyz%2Fen-US%2Fpricing'
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/billing/paypal/create-subscription', expect.any(Object));
  });
});
