import type {
  BillingInterval,
  BillingProvider,
  PlanEntitlements,
  PricingRegion,
  PurchaseKind,
  SupportedCurrency,
  SupportedLocale,
} from '@/server/shared/platform/domain';

export type PlanKey = 'trial' | 'pro' | 'studio';
export type CreditPackKey = 'credits-120' | 'credits-400' | 'credits-1000';

export interface MoneyAmount {
  amountCents: number;
  currency: SupportedCurrency;
}

export interface PlanCatalogEntry {
  key: PlanKey;
  name: Record<SupportedLocale, string>;
  description: Record<SupportedLocale, string>;
  pricingRegion: PricingRegion[];
  billingInterval: BillingInterval;
  prices: Record<SupportedCurrency, MoneyAmount>;
  monthlyCredits: number;
  entitlements: PlanEntitlements;
}

export interface CreditPackCatalogEntry {
  key: CreditPackKey;
  credits: number;
  prices: Record<SupportedCurrency, MoneyAmount>;
}

export interface PurchaseDescriptor {
  purchaseKind: PurchaseKind;
  provider: BillingProvider;
  amountCents: number;
  currency: SupportedCurrency;
  planKey?: PlanKey;
  creditPackKey?: CreditPackKey;
  creditsGranted?: number;
}

export const PLAN_CATALOG: Record<PlanKey, PlanCatalogEntry> = {
  trial: {
    key: 'trial',
    name: {
      'zh-CN': '试用版',
      'en-US': 'Trial',
    },
    description: {
      'zh-CN': '适合试用核心工作流与项目能力。',
      'en-US': 'Best for trying the core workflow and project model.',
    },
    pricingRegion: ['cn', 'global'],
    billingInterval: 'monthly',
    prices: {
      CNY: { amountCents: 0, currency: 'CNY' },
      USD: { amountCents: 0, currency: 'USD' },
    },
    monthlyCredits: 60,
    entitlements: {
      maxProjects: 3,
      maxWorkspaces: 1,
      maxMembers: 1,
      maxConcurrentJobs: 1,
      monthlyCredits: 60,
      canUseBranding: true,
      canUseApiAccess: false,
      canUsePrivateDeployment: false,
      canUseTeamCollaboration: false,
    },
  },
  pro: {
    key: 'pro',
    name: {
      'zh-CN': '专业版',
      'en-US': 'Pro',
    },
    description: {
      'zh-CN': '面向个人创作者与轻量工作室。',
      'en-US': 'For individual creators and lean studios.',
    },
    pricingRegion: ['cn', 'global'],
    billingInterval: 'monthly',
    prices: {
      CNY: { amountCents: 19_900, currency: 'CNY' },
      USD: { amountCents: 2_900, currency: 'USD' },
    },
    monthlyCredits: 300,
    entitlements: {
      maxProjects: 20,
      maxWorkspaces: 1,
      maxMembers: 1,
      maxConcurrentJobs: 2,
      monthlyCredits: 300,
      canUseBranding: true,
      canUseApiAccess: false,
      canUsePrivateDeployment: false,
      canUseTeamCollaboration: false,
    },
  },
  studio: {
    key: 'studio',
    name: {
      'zh-CN': '工作室版',
      'en-US': 'Studio',
    },
    description: {
      'zh-CN': '面向稳定产出的短剧工作室团队。',
      'en-US': 'For short-drama studios with consistent production needs.',
    },
    pricingRegion: ['cn', 'global'],
    billingInterval: 'monthly',
    prices: {
      CNY: { amountCents: 69_900, currency: 'CNY' },
      USD: { amountCents: 9_900, currency: 'USD' },
    },
    monthlyCredits: 1_200,
    entitlements: {
      maxProjects: 100,
      maxWorkspaces: 5,
      maxMembers: 10,
      maxConcurrentJobs: 3,
      monthlyCredits: 1_200,
      canUseBranding: true,
      canUseApiAccess: true,
      canUsePrivateDeployment: false,
      canUseTeamCollaboration: true,
    },
  },
};

export const CREDIT_PACK_CATALOG: Record<CreditPackKey, CreditPackCatalogEntry> = {
  'credits-120': {
    key: 'credits-120',
    credits: 120,
    prices: {
      CNY: { amountCents: 9_900, currency: 'CNY' },
      USD: { amountCents: 1_500, currency: 'USD' },
    },
  },
  'credits-400': {
    key: 'credits-400',
    credits: 400,
    prices: {
      CNY: { amountCents: 29_900, currency: 'CNY' },
      USD: { amountCents: 3_900, currency: 'USD' },
    },
  },
  'credits-1000': {
    key: 'credits-1000',
    credits: 1000,
    prices: {
      CNY: { amountCents: 69_900, currency: 'CNY' },
      USD: { amountCents: 8_900, currency: 'USD' },
    },
  },
};

export function getPlanCatalogEntry(planKey: string): PlanCatalogEntry {
  const entry = PLAN_CATALOG[planKey as PlanKey];
  if (!entry) {
    throw new Error(`Unknown plan: ${planKey}`);
  }
  return entry;
}

export function getCreditPackCatalogEntry(creditPackKey: string): CreditPackCatalogEntry {
  const entry = CREDIT_PACK_CATALOG[creditPackKey as CreditPackKey];
  if (!entry) {
    throw new Error(`Unknown credit pack: ${creditPackKey}`);
  }
  return entry;
}

export function getPlanEntitlements(planKey: string): PlanEntitlements {
  return getPlanCatalogEntry(planKey).entitlements;
}

export function getInitialBillingPreferences(locale: SupportedLocale): {
  locale: SupportedLocale;
  currency: SupportedCurrency;
  pricingRegion: PricingRegion;
} {
  if (locale === 'en-US') {
    return {
      locale,
      currency: 'USD',
      pricingRegion: 'global',
    };
  }

  return {
    locale: 'zh-CN',
    currency: 'CNY',
    pricingRegion: 'cn',
  };
}

export function buildSubscriptionPurchase(
  planKey: PlanKey,
  currency: SupportedCurrency,
  provider: BillingProvider
): PurchaseDescriptor {
  const plan = getPlanCatalogEntry(planKey);
  const price = plan.prices[currency];

  return {
    purchaseKind: 'subscription',
    provider,
    planKey,
    amountCents: price.amountCents,
    currency,
    creditsGranted: plan.monthlyCredits,
  };
}

export function buildCreditPackPurchase(
  creditPackKey: CreditPackKey,
  currency: SupportedCurrency,
  provider: BillingProvider
): PurchaseDescriptor {
  const pack = getCreditPackCatalogEntry(creditPackKey);
  const price = pack.prices[currency];

  return {
    purchaseKind: 'credit-pack',
    provider,
    creditPackKey,
    amountCents: price.amountCents,
    currency,
    creditsGranted: pack.credits,
  };
}

export function estimateJobCredits(
  kind: 'script-generation' | 'storyboard-generation',
  options: {
    episodeCount?: number;
  } = {}
): number {
  if (kind === 'storyboard-generation') {
    return Math.max(8, (options.episodeCount ?? 1) * 8);
  }

  return 30 + Math.max(1, options.episodeCount ?? 1) * 15;
}
