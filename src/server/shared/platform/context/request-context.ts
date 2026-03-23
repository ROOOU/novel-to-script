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

  return {
    ...identity,
    ...workspace,
    ...actor,
    plan: normalizePlan(options.defaultPlan),
  };
}

export function normalizePlan(plan: PlatformPlan | string | null | undefined): PlatformPlan {
  switch (plan) {
    case 'pro':
    case 'team':
    case 'enterprise':
      return plan;
    case 'free':
    default:
      return 'free';
  }
}
