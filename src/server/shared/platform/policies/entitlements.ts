import type { PlatformEntitlementSet, PlatformFeatureKey } from './types';
import type { PlatformPlan } from '../context';

const BASE_FEATURES: readonly PlatformFeatureKey[] = ['script-generation', 'storyboard-generation'];
const PRO_PLUS_FEATURES: readonly PlatformFeatureKey[] = [
  ...BASE_FEATURES,
  'project-history',
  'branding-export',
  'api-access',
];
const TEAM_FEATURES: readonly PlatformFeatureKey[] = [
  ...PRO_PLUS_FEATURES,
  'workspace-sharing',
  'team-collaboration',
  'audit-log',
  'priority-queue',
];
const ENTERPRISE_FEATURES: readonly PlatformFeatureKey[] = [
  ...TEAM_FEATURES,
  'custom-model',
];

export function getPlanEntitlements(plan: PlatformPlan): PlatformEntitlementSet {
  switch (plan) {
    case 'pro':
      return {
        plan,
        features: PRO_PLUS_FEATURES,
        maxWorkspaces: 1,
        maxProjectsPerWorkspace: 20,
        maxConcurrentJobs: 2,
        maxMonthlyGenerations: 200,
        maxInputCharacters: 80_000,
        maxEpisodeCount: 8,
        maxTeamMembers: 1,
        allowBrandingRemoval: false,
        allowCustomModel: false,
        allowApiAccess: true,
        allowAuditLog: false,
        allowPriorityQueue: false,
      };
    case 'team':
      return {
        plan,
        features: TEAM_FEATURES,
        maxWorkspaces: 10,
        maxProjectsPerWorkspace: 100,
        maxConcurrentJobs: 5,
        maxMonthlyGenerations: 1_000,
        maxInputCharacters: 200_000,
        maxEpisodeCount: 20,
        maxTeamMembers: 20,
        allowBrandingRemoval: true,
        allowCustomModel: false,
        allowApiAccess: true,
        allowAuditLog: true,
        allowPriorityQueue: true,
      };
    case 'enterprise':
      return {
        plan,
        features: ENTERPRISE_FEATURES,
        maxWorkspaces: Number.POSITIVE_INFINITY,
        maxProjectsPerWorkspace: Number.POSITIVE_INFINITY,
        maxConcurrentJobs: Number.POSITIVE_INFINITY,
        maxMonthlyGenerations: Number.POSITIVE_INFINITY,
        maxInputCharacters: Number.POSITIVE_INFINITY,
        maxEpisodeCount: Number.POSITIVE_INFINITY,
        maxTeamMembers: Number.POSITIVE_INFINITY,
        allowBrandingRemoval: true,
        allowCustomModel: true,
        allowApiAccess: true,
        allowAuditLog: true,
        allowPriorityQueue: true,
      };
    case 'free':
    default:
      return {
        plan: 'free',
        features: BASE_FEATURES,
        maxWorkspaces: 1,
        maxProjectsPerWorkspace: 3,
        maxConcurrentJobs: 1,
        maxMonthlyGenerations: 20,
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
