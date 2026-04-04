import type { PlatformEntitlementSet, PlatformFeatureKey } from './types';
import type { PlatformPlan } from '../context';

const BASE_FEATURES: readonly PlatformFeatureKey[] = ['script-generation', 'storyboard-generation'];
const CREATOR_FEATURES: readonly PlatformFeatureKey[] = [
  ...BASE_FEATURES,
  'project-history',
];
const PRO_FEATURES: readonly PlatformFeatureKey[] = [...CREATOR_FEATURES, 'branding-export'];

export function getPlanEntitlements(plan: PlatformPlan): PlatformEntitlementSet {
  switch (plan) {
    case 'creator':
      return {
        plan,
        features: CREATOR_FEATURES,
        maxWorkspaces: 1,
        maxProjectsPerWorkspace: 15,
        maxConcurrentJobs: 2,
        maxMonthlyGenerations: 200,
        maxInputCharacters: 80_000,
        maxEpisodeCount: 8,
        maxTeamMembers: 1,
        allowBrandingRemoval: false,
        allowCustomModel: false,
        allowApiAccess: false,
        allowAuditLog: false,
        allowPriorityQueue: false,
      };
    case 'pro':
      return {
        plan,
        features: PRO_FEATURES,
        maxWorkspaces: 1,
        maxProjectsPerWorkspace: Number.POSITIVE_INFINITY,
        maxConcurrentJobs: 3,
        maxMonthlyGenerations: 600,
        maxInputCharacters: 200_000,
        maxEpisodeCount: 20,
        maxTeamMembers: 1,
        allowBrandingRemoval: false,
        allowCustomModel: false,
        allowApiAccess: false,
        allowAuditLog: false,
        allowPriorityQueue: false,
      };
    case 'free':
    default:
      return {
        plan: 'free',
        features: BASE_FEATURES,
        maxWorkspaces: 1,
        maxProjectsPerWorkspace: 2,
        maxConcurrentJobs: 1,
        maxMonthlyGenerations: 30,
        maxInputCharacters: 15_000,
        maxEpisodeCount: 5,
        maxTeamMembers: 1,
        allowBrandingRemoval: false,
        allowCustomModel: false,
        allowApiAccess: false,
        allowAuditLog: false,
        allowPriorityQueue: false,
      };
  }
}

export function hasFeatureEntitlement(
  entitlements: PlatformEntitlementSet,
  feature: PlatformFeatureKey
): boolean {
  return entitlements.features.includes(feature);
}

export function assertFeatureEntitlement(
  entitlements: PlatformEntitlementSet,
  feature: PlatformFeatureKey
): { allowed: true } | { allowed: false; reason: string } {
  if (hasFeatureEntitlement(entitlements, feature)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `当前套餐不支持 ${feature} 功能`,
  };
}
