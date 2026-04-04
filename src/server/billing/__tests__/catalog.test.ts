import { describe, expect, it } from 'vitest';
import {
  CREDIT_PACK_CATALOG,
  CREDIT_PACK_CATALOG_ENTRIES,
  PLAN_CATALOG,
  PLAN_CATALOG_ENTRIES,
} from '@/server/billing/catalog';

describe('billing catalog invariants', () => {
  it('keeps only the free, creator, and pro plans with USD pricing', () => {
    expect(Object.keys(PLAN_CATALOG)).toEqual(['free', 'creator', 'pro']);
    expect(PLAN_CATALOG_ENTRIES.map((plan) => plan.key)).toEqual(['free', 'creator', 'pro']);

    expect(
      Object.fromEntries(
        Object.values(PLAN_CATALOG).map((plan) => [
          plan.key,
          {
            monthlyCredits: plan.monthlyCredits,
            maxMembers: plan.entitlements.maxMembers,
            canUseTeamCollaboration: plan.entitlements.canUseTeamCollaboration,
            currencies: Object.keys(plan.prices),
          },
        ])
      )
    ).toEqual({
      free: {
        monthlyCredits: 30,
        maxMembers: 1,
        canUseTeamCollaboration: false,
        currencies: ['USD'],
      },
      creator: {
        monthlyCredits: 200,
        maxMembers: 1,
        canUseTeamCollaboration: false,
        currencies: ['USD'],
      },
      pro: {
        monthlyCredits: 600,
        maxMembers: 1,
        canUseTeamCollaboration: false,
        currencies: ['USD'],
      },
    });
  });

  it('keeps only the USD credit packs for 50, 200, and 500 credits', () => {
    expect(CREDIT_PACK_CATALOG_ENTRIES.map((pack) => pack.key)).toEqual([
      'credits-50',
      'credits-200',
      'credits-500',
    ]);

    expect(
      Object.fromEntries(
        Object.values(CREDIT_PACK_CATALOG).map((pack) => [
          pack.key,
          {
            credits: pack.credits,
            currencies: Object.keys(pack.prices),
          },
        ])
      )
    ).toEqual({
      'credits-50': {
        credits: 50,
        currencies: ['USD'],
      },
      'credits-200': {
        credits: 200,
        currencies: ['USD'],
      },
      'credits-500': {
        credits: 500,
        currencies: ['USD'],
      },
    });
  });
});
