import type { PlatformPlan } from '../context';

export type PlatformFeatureKey =
  | 'script-generation'
  | 'storyboard-generation'
  | 'project-history'
  | 'workspace-sharing'
  | 'team-collaboration'
  | 'branding-export'
  | 'custom-model'
  | 'api-access'
  | 'audit-log'
  | 'priority-queue';

export interface PlatformEntitlementSet {
  plan: PlatformPlan;
  features: readonly PlatformFeatureKey[];
  maxWorkspaces: number;
  maxProjectsPerWorkspace: number;
  maxConcurrentJobs: number;
  maxMonthlyGenerations: number;
  maxInputCharacters: number;
  maxEpisodeCount: number;
  maxTeamMembers: number;
  allowBrandingRemoval: boolean;
  allowCustomModel: boolean;
  allowApiAccess: boolean;
  allowAuditLog: boolean;
  allowPriorityQueue: boolean;
}

export type UsageMeterUnit = 'request' | 'job' | 'token' | 'character' | 'export';

export interface PlatformUsageEvent {
  workspaceId?: string | null;
  feature: PlatformFeatureKey;
  unit: UsageMeterUnit;
  amount: number;
  requestId?: string;
  userId?: string | null;
  projectId?: string | null;
  plan: PlatformPlan;
  metadata?: Record<string, unknown>;
}

export interface PlatformUsageSnapshot {
  workspaceId: string;
  periodStart: string;
  periodEnd: string;
  requests: number;
  jobs: number;
  tokens: number;
  characters: number;
  exports: number;
}
