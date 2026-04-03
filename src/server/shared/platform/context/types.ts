export type PlatformPlan = 'free' | 'creator' | 'pro';

export type PlatformWorkspaceSource =
  | 'header'
  | 'query'
  | 'session'
  | 'route'
  | 'default'
  | 'none';

export interface PlatformRequestIdentity {
  requestId: string;
  traceId: string;
  clientIp: string;
  userAgent: string | null;
  referer: string | null;
  locale: string | null;
}

export interface PlatformWorkspaceRef {
  workspaceId: string | null;
  organizationId: string | null;
  projectId: string | null;
  source: PlatformWorkspaceSource;
}

export interface PlatformRequestContext extends PlatformRequestIdentity, PlatformWorkspaceRef {
  userId: string | null;
  sessionId: string | null;
  plan: PlatformPlan;
}

export interface PlatformRequestViewerDefaults {
  userId?: string | null;
  sessionId?: string | null;
  organizationId?: string | null;
  workspaceId?: string | null;
  projectId?: string | null;
  plan?: PlatformPlan | null;
}

export interface PlatformRequestContextOptions {
  defaultWorkspaceId?: string | null;
  defaultOrganizationId?: string | null;
  defaultProjectId?: string | null;
  defaultPlan?: PlatformPlan;
  viewerDefaults?: PlatformRequestViewerDefaults;
}

export interface PlatformRequestLike {
  headers: Headers;
  nextUrl?: URL | null;
}
