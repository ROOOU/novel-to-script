import type {
  BillingInterval,
  BillingProvider,
  PlanEntitlements,
  PricingRegion,
  PurchaseKind,
  SupportedCurrency,
  SupportedLocale,
} from '@/server/shared/platform/domain';

export type PlanKey = 'free' | 'creator' | 'pro';
export type CreditPackKey = 'credits-50' | 'credits-200' | 'credits-500';

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

interface PlanCatalogDefinition extends Omit<PlanCatalogEntry, 'prices'> {
  monthlyPriceCents: number;
}

interface CreditPackCatalogDefinition extends Omit<CreditPackCatalogEntry, 'prices'> {
  priceCents: number;
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

export const PLAN_ORDER: readonly PlanKey[] = ['free', 'creator', 'pro'];
export const CREDIT_PACK_ORDER: readonly CreditPackKey[] = [
  'credits-50',
  'credits-200',
  'credits-500',
];

const PLAN_DEFINITIONS: Record<PlanKey, PlanCatalogDefinition> = {
  free: {
    key: 'free',
    name: {
      'zh-CN': '免费版',
      'en-US': 'Free',
    },
    description: {
      'zh-CN': '适合体验完整流程并开始第一个项目。',
      'en-US': 'Best for trying the full workflow and launching a first project.',
    },
    pricingRegion: ['global'],
    billingInterval: 'monthly',
    monthlyPriceCents: 0,
    monthlyCredits: 30,
    entitlements: {
      maxProjects: 2,
      maxWorkspaces: 1,
      maxMembers: 1,
      maxConcurrentJobs: 1,
      monthlyCredits: 30,
      canUseBranding: true,
      canUseApiAccess: false,
      canUsePrivateDeployment: false,
      canUseTeamCollaboration: false,
    },
  },
  creator: {
    key: 'creator',
    name: {
      'zh-CN': '创作者版',
      'en-US': 'Creator',
    },
    description: {
      'zh-CN': '面向个人创作者的日常改编与快速出稿。',
      'en-US': 'For daily adaptation work and faster drafts.',
    },
    pricingRegion: ['global'],
    billingInterval: 'monthly',
    monthlyPriceCents: 990,
    monthlyCredits: 200,
    entitlements: {
      maxProjects: 15,
      maxWorkspaces: 1,
      maxMembers: 1,
      maxConcurrentJobs: 2,
      monthlyCredits: 200,
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
      'zh-CN': '面向高产创作者的批量生成与持续迭代。',
      'en-US': 'For high-volume creators who need batch generation and steady iteration.',
    },
    pricingRegion: ['global'],
    billingInterval: 'monthly',
    monthlyPriceCents: 2_900,
    monthlyCredits: 600,
    entitlements: {
      maxProjects: null,
      maxWorkspaces: 1,
      maxMembers: 1,
      maxConcurrentJobs: 3,
      monthlyCredits: 600,
      canUseBranding: true,
      canUseApiAccess: false,
      canUsePrivateDeployment: false,
      canUseTeamCollaboration: false,
    },
  },
};

const CREDIT_PACK_DEFINITIONS: Record<CreditPackKey, CreditPackCatalogDefinition> = {
  'credits-50': {
    key: 'credits-50',
    credits: 50,
    priceCents: 490,
  },
  'credits-200': {
    key: 'credits-200',
    credits: 200,
    priceCents: 1_490,
  },
  'credits-500': {
    key: 'credits-500',
    credits: 500,
    priceCents: 2_990,
  },
};

export const PLAN_CATALOG: Record<PlanKey, PlanCatalogEntry> = createPlanCatalog(PLAN_DEFINITIONS);
export const PLAN_CATALOG_ENTRIES: PlanCatalogEntry[] = PLAN_ORDER.map((key) => PLAN_CATALOG[key]);
export const CREDIT_PACK_CATALOG: Record<CreditPackKey, CreditPackCatalogEntry> =
  createCreditPackCatalog(CREDIT_PACK_DEFINITIONS);
export const CREDIT_PACK_CATALOG_ENTRIES: CreditPackCatalogEntry[] = CREDIT_PACK_ORDER.map(
  (key) => CREDIT_PACK_CATALOG[key]
);

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
  return {
    locale,
    currency: 'USD',
    pricingRegion: 'global',
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

function createPlanCatalog(
  definitions: Record<PlanKey, PlanCatalogDefinition>
): Record<PlanKey, PlanCatalogEntry> {
  return PLAN_ORDER.reduce(
    (catalog, key) => {
      const { monthlyPriceCents, ...definition } = definitions[key];
      catalog[key] = {
        ...definition,
        prices: createUsdPriceMap(monthlyPriceCents),
      };
      return catalog;
    },
    {} as Record<PlanKey, PlanCatalogEntry>
  );
}

function createCreditPackCatalog(
  definitions: Record<CreditPackKey, CreditPackCatalogDefinition>
): Record<CreditPackKey, CreditPackCatalogEntry> {
  return CREDIT_PACK_ORDER.reduce(
    (catalog, key) => {
      const { priceCents, ...definition } = definitions[key];
      catalog[key] = {
        ...definition,
        prices: createUsdPriceMap(priceCents),
      };
      return catalog;
    },
    {} as Record<CreditPackKey, CreditPackCatalogEntry>
  );
}

function createUsdPriceMap(amountCents: number): Record<SupportedCurrency, MoneyAmount> {
  return {
    USD: {
      amountCents,
      currency: 'USD',
    },
  };
}
