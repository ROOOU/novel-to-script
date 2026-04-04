import type {
  PlatformRequestContext,
  PlatformRequestContextOptions,
  PlatformRequestLike,
  PlatformPlan,
} from './types';
import { createPlatformRequestIdentity, resolveActorIdentity } from './request-identity';
import { resolveWorkspaceContext } from './workspace-resolution';

export function createPlatformRequestContext(
  request: PlatformRequestLike,
  options: PlatformRequestContextOptions = {}
): PlatformRequestContext {
  const identity = createPlatformRequestIdentity(request);
  const actor = resolveActorIdentity(request);
  const workspace = resolveWorkspaceContext(request, {
    defaultWorkspaceId: options.defaultWorkspaceId,
    defaultOrganizationId: options.defaultOrganizationId,
    defaultProjectId: options.defaultProjectId,
  });
  const viewerDefaults = options.viewerDefaults;

  const userId = actor.userId ?? viewerDefaults?.userId ?? null;
  const sessionId = actor.sessionId ?? viewerDefaults?.sessionId ?? null;
  const workspaceId = workspace.workspaceId ?? viewerDefaults?.workspaceId ?? null;
  const organizationId =
    workspace.organizationId ?? viewerDefaults?.organizationId ?? workspaceId;
  const projectId = workspace.projectId ?? viewerDefaults?.projectId ?? null;
  const plan = normalizePlan(options.defaultPlan ?? viewerDefaults?.plan);
  const source = resolveWorkspaceSource(workspace.source, {
    viewerDefaults,
    baseWorkspaceId: workspace.workspaceId,
    baseOrganizationId: workspace.organizationId,
    baseProjectId: workspace.projectId,
    resolvedWorkspaceId: workspaceId,
    resolvedOrganizationId: organizationId,
    resolvedProjectId: projectId,
    resolvedUserId: userId,
    resolvedSessionId: sessionId,
    resolvedPlan: plan,
    explicitPlan: options.defaultPlan,
  });

  return {
    ...identity,
    workspaceId,
    organizationId,
    projectId,
    source,
    userId,
    sessionId,
    plan,
  };
}

export function normalizePlan(plan: PlatformPlan | string | null | undefined): PlatformPlan {
  switch (plan) {
    case 'creator':
    case 'pro':
      return plan;
    case 'free':
    default:
      return 'free';
  }
}

function resolveWorkspaceSource(
  baseSource: PlatformRequestContext['source'],
  options: {
    viewerDefaults?: NonNullable<PlatformRequestContextOptions['viewerDefaults']>;
    baseWorkspaceId: string | null;
    baseOrganizationId: string | null;
    baseProjectId: string | null;
    resolvedWorkspaceId: string | null;
    resolvedOrganizationId: string | null;
    resolvedProjectId: string | null;
    resolvedUserId: string | null;
    resolvedSessionId: string | null;
    resolvedPlan: PlatformPlan;
    explicitPlan?: PlatformPlan;
  }
): PlatformRequestContext['source'] {
  if (baseSource === 'header' || baseSource === 'query') {
    return baseSource;
  }

  if (!options.viewerDefaults) {
    return baseSource;
  }

  const viewerDefaultsUsed =
    (options.viewerDefaults.userId != null && options.resolvedUserId === options.viewerDefaults.userId) ||
    (options.viewerDefaults.sessionId != null &&
      options.resolvedSessionId === options.viewerDefaults.sessionId) ||
    (options.viewerDefaults.workspaceId != null &&
      options.resolvedWorkspaceId === options.viewerDefaults.workspaceId &&
      options.baseWorkspaceId !== options.resolvedWorkspaceId) ||
    (options.viewerDefaults.organizationId != null &&
      options.resolvedOrganizationId === options.viewerDefaults.organizationId &&
      options.baseOrganizationId !== options.resolvedOrganizationId) ||
    (options.viewerDefaults.projectId != null &&
      options.resolvedProjectId === options.viewerDefaults.projectId &&
      options.baseProjectId !== options.resolvedProjectId) ||
    (options.viewerDefaults.plan != null &&
      options.explicitPlan == null &&
      options.resolvedPlan === normalizePlan(options.viewerDefaults.plan));

  return viewerDefaultsUsed ? 'session' : baseSource;
}
