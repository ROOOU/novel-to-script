import {
  createPlatformRequestContext,
  type PlatformPlan,
  type PlatformRequestContext,
  type PlatformRequestContextOptions,
  type PlatformRequestLike,
} from './context';
import {
  assertFeatureEntitlement,
  getPlanEntitlements,
  type PlatformEntitlementSet,
  type PlatformFeatureKey,
} from './policies';

export interface PlatformFeatureAccessOptions {
  feature: PlatformFeatureKey;
  episodeCount?: number;
}

export interface PlatformFeatureAccessResult {
  allowed: boolean;
  context: PlatformRequestContext;
  entitlements: PlatformEntitlementSet;
  status?: number;
  reason?: string;
}

export function resolvePlatformRequestContext(
  request: PlatformRequestLike,
  options: PlatformRequestContextOptions = {}
): PlatformRequestContext {
  return createPlatformRequestContext(request, options);
}

export function evaluatePlatformFeatureAccess(
  context: PlatformRequestContext,
  options: PlatformFeatureAccessOptions
): PlatformFeatureAccessResult {
  const entitlements = getPlanEntitlements(context.plan);
  const entitlementCheck = assertFeatureEntitlement(entitlements, options.feature);

  if (!entitlementCheck.allowed) {
    return denied(context, entitlements, 403, entitlementCheck.reason);
  }

  if (
    typeof options.episodeCount === 'number' &&
    options.episodeCount > entitlements.maxEpisodeCount
  ) {
    return denied(
      context,
      entitlements,
      403,
      `${context.plan} 套餐最多支持 ${entitlements.maxEpisodeCount} 集`
    );
  }

  return {
    allowed: true,
    context,
    entitlements,
  };
}

export function applyPlatformResponseHeaders(
  response: Response,
  context: PlatformRequestContext
): Response {
  response.headers.set('X-Request-Id', context.requestId);
  response.headers.set('X-Trace-Id', context.traceId);
  response.headers.set('X-Platform-Plan', context.plan);

  if (context.organizationId) {
    response.headers.set('X-Organization-Id', context.organizationId);
  }

  if (context.workspaceId) {
    response.headers.set('X-Workspace-Id', context.workspaceId);
  }

  if (context.projectId) {
    response.headers.set('X-Project-Id', context.projectId);
  }

  return response;
}

export function createPlatformJsonErrorResponse(
  context: PlatformRequestContext,
  error: string,
  status: number
): Response {
  return applyPlatformResponseHeaders(
    new Response(
      JSON.stringify({
        error,
        requestId: context.requestId,
        plan: context.plan,
      }),
      {
        status,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    ),
    context
  );
}

export function getPlanHeaderDefault(
  request: PlatformRequestLike
): PlatformPlan | undefined {
  const headerPlan = request.headers.get('x-plan')?.trim();
  if (
    headerPlan === 'free' ||
    headerPlan === 'pro' ||
    headerPlan === 'team' ||
    headerPlan === 'enterprise'
  ) {
    return headerPlan;
  }

  return undefined;
}

function denied(
  context: PlatformRequestContext,
  entitlements: PlatformEntitlementSet,
  status: number,
  reason: string
): PlatformFeatureAccessResult {
  return {
    allowed: false,
    context,
    entitlements,
    status,
    reason,
  };
}
