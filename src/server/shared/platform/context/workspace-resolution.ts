import type {
  PlatformRequestLike,
  PlatformWorkspaceRef,
  PlatformWorkspaceSource,
} from './types';

const WORKSPACE_ID_HEADERS = ['x-workspace-id', 'x-tenant-id', 'x-org-id'] as const;
const ORGANIZATION_ID_HEADERS = ['x-organization-id', 'x-org-id'] as const;
const PROJECT_ID_HEADERS = ['x-project-id', 'x-project'] as const;

const WORKSPACE_ID_QUERY_KEYS = ['workspaceId', 'workspace', 'tenantId', 'tenant'] as const;
const ORGANIZATION_ID_QUERY_KEYS = ['organizationId', 'organization', 'orgId'] as const;
const PROJECT_ID_QUERY_KEYS = ['projectId', 'project'] as const;

export interface WorkspaceResolutionOptions {
  defaultWorkspaceId?: string | null;
  defaultOrganizationId?: string | null;
  defaultProjectId?: string | null;
}

export function resolveWorkspaceContext(
  request: PlatformRequestLike,
  options: WorkspaceResolutionOptions = {}
): PlatformWorkspaceRef {
  const query = request.nextUrl?.searchParams ?? null;

  const workspaceId = resolveScopedIdentifier(
    request,
    query,
    WORKSPACE_ID_HEADERS,
    WORKSPACE_ID_QUERY_KEYS,
    options.defaultWorkspaceId ?? null
  );

  const organizationId =
    resolveScopedIdentifier(
      request,
      query,
      ORGANIZATION_ID_HEADERS,
      ORGANIZATION_ID_QUERY_KEYS,
      options.defaultOrganizationId ?? null
    ) ?? workspaceId;

  const projectId = resolveScopedIdentifier(
    request,
    query,
    PROJECT_ID_HEADERS,
    PROJECT_ID_QUERY_KEYS,
    options.defaultProjectId
  );

  return {
    workspaceId,
    organizationId,
    projectId,
    source: detectWorkspaceSource(request, query, workspaceId, organizationId, projectId),
  };
}

function resolveScopedIdentifier(
  request: PlatformRequestLike,
  query: URLSearchParams | null,
  headerKeys: readonly string[],
  queryKeys: readonly string[],
  fallback: string | null | undefined
): string | null {
  for (const key of headerKeys) {
    const value = request.headers.get(key)?.trim();
    if (value) {
      return value;
    }
  }

  if (query) {
    for (const key of queryKeys) {
      const value = query.get(key)?.trim();
      if (value) {
        return value;
      }
    }
  }

  return fallback ?? null;
}

function detectWorkspaceSource(
  request: PlatformRequestLike,
  query: URLSearchParams | null,
  workspaceId: string | null,
  organizationId: string | null,
  projectId: string | null
): PlatformWorkspaceSource {
  if (hasHeaderValue(request, WORKSPACE_ID_HEADERS, ORGANIZATION_ID_HEADERS, PROJECT_ID_HEADERS)) {
    return 'header';
  }

  if (hasQueryValue(query, WORKSPACE_ID_QUERY_KEYS, ORGANIZATION_ID_QUERY_KEYS, PROJECT_ID_QUERY_KEYS)) {
    return 'query';
  }

  if (workspaceId || organizationId || projectId) {
    return 'default';
  }

  return 'none';
}

function hasHeaderValue(
  request: PlatformRequestLike,
  ...groups: readonly (readonly string[])[]
): boolean {
  return groups.some((group) =>
    group.some((key) => Boolean(request.headers.get(key)?.trim()))
  );
}

function hasQueryValue(
  query: URLSearchParams | null,
  ...groups: readonly (readonly string[])[]
): boolean {
  if (!query) {
    return false;
  }

  return groups.some((group) =>
    group.some((key) => Boolean(query.get(key)?.trim()))
  );
}
