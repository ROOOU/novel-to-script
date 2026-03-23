export type PlatformPlan = 'free' | 'pro' | 'team' | 'enterprise';

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

export interface PlatformRequestContextOptions {
  defaultWorkspaceId?: string | null;
  defaultOrganizationId?: string | null;
  defaultProjectId?: string | null;
  defaultPlan?: PlatformPlan;
}

export interface PlatformRequestLike {
  headers: Headers;
  nextUrl?: URL | null;
}
