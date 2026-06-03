import { beforeEach, describe, expect, it } from 'vitest';
import {
  canAccessJob,
  createInMemoryGenerationJobAccessStore,
  createInMemoryGenerationArtifactRepository,
  createInMemoryGenerationJobRepository,
  createInMemoryUsageMeter,
  evaluateUsagePreflight,
  evaluatePlatformFeatureAccess,
  getPlanEntitlements,
  getUsageBudgetFromEntitlements,
  resetInMemoryGenerationArtifacts,
  resetInMemoryGenerationJobAccessStore,
  resetInMemoryGenerationJobs,
  resetInMemoryUsageMeter,
  type PlatformRequestContext,
} from '@/server/shared/platform';

function createContext(overrides: Partial<PlatformRequestContext> = {}): PlatformRequestContext {
  return {
    requestId: 'req_test',
    traceId: 'trace_test',
    clientIp: '127.0.0.1',
    userAgent: null,
    referer: null,
    locale: null,
    workspaceId: 'ws_test',
    organizationId: 'org_test',
    projectId: 'proj_test',
    source: 'default',
    userId: 'user_test',
    sessionId: 'session_test',
    plan: 'free',
    ...overrides,
  };
}

describe('platform runtime', () => {
  beforeEach(() => {
    resetInMemoryGenerationArtifacts();
    resetInMemoryGenerationJobAccessStore();
    resetInMemoryGenerationJobs();
    resetInMemoryUsageMeter();
  });

  it('tracks generation jobs in memory', async () => {
    const jobs = createInMemoryGenerationJobRepository();
    const now = new Date().toISOString();

    const job = await jobs.create({
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      projectId: 'proj_test',
      kind: 'script-generation',
      inputSnapshot: { foo: 'bar' },
      requestedByUserId: 'user_test',
      requestedBySessionId: 'session_test',
    });

    expect(job.status).toBe('queued');

    await jobs.markRunning(job.id, now, 'user_test');
    expect((await jobs.getById(job.id))?.status).toBe('running');

    await jobs.markSucceeded(job.id, {
      progress: 100,
      currentStep: 'done',
      outputSummary: 'ok',
      updatedByUserId: 'user_test',
    });

    const stored = await jobs.getById(job.id);
    expect(stored?.status).toBe('succeeded');
    expect(stored?.progress).toBe(100);
  });

  it('stores generation artifacts in memory', async () => {
    const artifacts = createInMemoryGenerationArtifactRepository();

    const artifact = await artifacts.create({
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      projectId: 'proj_test',
      generationJobId: 'job_test',
      kind: 'script',
      format: 'text/plain',
      title: '第1集剧本',
      content: 'content',
      createdByUserId: 'user_test',
    });

    const stored = await artifacts.getById(artifact.id);
    expect(stored?.title).toBe('第1集剧本');
    expect((await artifacts.listByJobId('job_test'))).toHaveLength(1);
  });

  it('tracks usage snapshots in memory', async () => {
    const meter = createInMemoryUsageMeter();
    const occurredAt = new Date().toISOString();

    await meter.record({
      workspaceId: 'ws_test',
      feature: 'script-generation',
      unit: 'request',
      amount: 1,
      plan: 'free',
      metadata: { occurredAt },
    });
    await meter.record({
      workspaceId: 'ws_test',
      feature: 'script-generation',
      unit: 'character',
      amount: 1200,
      plan: 'free',
      metadata: { occurredAt },
    });

    const snapshot = await meter.snapshot('ws_test');
    expect(snapshot?.requests).toBe(1);
    expect(snapshot?.characters).toBe(1200);
  });

  it('denies requests when the active-job limit is reached', () => {
    const budget = getUsageBudgetFromEntitlements(getPlanEntitlements('free'));

    const result = evaluateUsagePreflight(budget, {
      snapshot: {
        workspaceId: 'ws_test',
        periodStart: '2026-03-01T00:00:00.000Z',
        periodEnd: '2026-04-01T00:00:00.000Z',
        requests: 0,
        jobs: 0,
        tokens: 0,
        characters: 0,
        exports: 0,
      },
      activeJobCount: budget.concurrentJobs,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('concurrent jobs');
  });

  it('evaluates accumulated usage against budget', () => {
    const budget = getUsageBudgetFromEntitlements(getPlanEntitlements('free'));

    const result = evaluateUsagePreflight(budget, {
      snapshot: {
        workspaceId: 'ws_test',
        periodStart: '2026-03-01T00:00:00.000Z',
        periodEnd: '2026-04-01T00:00:00.000Z',
        requests: 30,
        jobs: 1,
        tokens: 0,
        characters: 10,
        exports: 0,
      },
      pendingRequestCount: 1,
    });

    expect(result.allowed).toBe(false);
  });

  it('denies requests when episode count exceeds plan entitlement', () => {
    const context = createContext({ plan: 'free' });

    const result = evaluatePlatformFeatureAccess(context, {
      feature: 'script-generation',
      episodeCount: 99,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('套餐最多支持');
  });

  it('allows read access for matching user provenance', async () => {
    const jobs = createInMemoryGenerationJobRepository();
    const job = await jobs.create({
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      projectId: 'proj_test',
      kind: 'script-generation',
      requestedByUserId: 'user_owner',
      requestedBySessionId: null,
      inputSnapshot: { requestId: 'req_owner' },
    });

    expect(canAccessJob(job, createContext({ userId: 'user_owner' }))).toBe(true);
  });

  it('allows read access for matching session provenance', async () => {
    const jobs = createInMemoryGenerationJobRepository();
    const job = await jobs.create({
      organizationId: 'org_test',
      workspaceId: 'demo-workspace',
      projectId: 'demo-project-script',
      kind: 'script-generation',
      requestedByUserId: null,
      requestedBySessionId: 'session_demo',
      inputSnapshot: {},
    });

    expect(
      canAccessJob(job, createContext({
        userId: null,
        workspaceId: 'demo-workspace',
        sessionId: 'session_demo',
      }))
    ).toBe(true);
  });

  it('denies read access for matching workspace without actor provenance', async () => {
    const jobs = createInMemoryGenerationJobRepository();
    const job = await jobs.create({
      organizationId: 'org_test',
      workspaceId: 'demo-workspace',
      projectId: 'demo-project-script',
      kind: 'script-generation',
      requestedByUserId: null,
      requestedBySessionId: null,
      inputSnapshot: {},
    });

    expect(
      canAccessJob(job, createContext({
        userId: null,
        sessionId: null,
        workspaceId: 'demo-workspace',
      }))
    ).toBe(false);
  });

  it('issues and verifies job access tokens', () => {
    const accessStore = createInMemoryGenerationJobAccessStore();
    const token = accessStore.issue('job_test');

    expect(accessStore.verify('job_test', token)).toBe(true);
    expect(accessStore.verify('job_test', 'token_invalid')).toBe(false);

    accessStore.revoke('job_test');
    expect(accessStore.verify('job_test', token)).toBe(false);
  });
});
