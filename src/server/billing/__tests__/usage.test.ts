import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPlatformRuntime: vi.fn(),
}));

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: () => mocks.getPlatformRuntime(),
}));

import { getBillingUsageSummary } from '@/server/billing/usage';

function createRuntimeMock() {
  return {
    projects: {
      listByOrganizationId: vi.fn(),
    },
    creditLedger: {
      listByOrganizationId: vi.fn(),
    },
    generationJobs: {
      getById: vi.fn(),
    },
  };
}

describe('billing usage aggregation', () => {
  let runtime: ReturnType<typeof createRuntimeMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    runtime = createRuntimeMock();
    mocks.getPlatformRuntime.mockReturnValue(runtime);
  });

  it('aggregates current-month captured credits by project and task type', async () => {
    runtime.projects.listByOrganizationId.mockResolvedValue([
      { id: 'proj_1', name: 'Project Alpha' },
      { id: 'proj_2', name: 'Project Beta' },
    ]);
    runtime.creditLedger.listByOrganizationId.mockResolvedValue([
      {
        id: 'ledger_1',
        organizationId: 'org_1',
        creditAccountId: 'credit_1',
        kind: 'job_capture',
        deltaCredits: 0,
        balanceAfter: 55,
        generationJobId: 'job_script',
        createdAt: '2026-03-04T08:00:00.000Z',
        updatedAt: '2026-03-04T08:00:00.000Z',
      },
      {
        id: 'ledger_2',
        organizationId: 'org_1',
        creditAccountId: 'credit_1',
        kind: 'job_capture',
        deltaCredits: 0,
        balanceAfter: 47,
        generationJobId: 'job_storyboard',
        createdAt: '2026-03-04T09:00:00.000Z',
        updatedAt: '2026-03-04T09:00:00.000Z',
      },
      {
        id: 'ledger_3',
        organizationId: 'org_1',
        creditAccountId: 'credit_1',
        kind: 'job_capture',
        deltaCredits: 0,
        balanceAfter: 35,
        generationJobId: 'job_analysis',
        createdAt: '2026-03-10T09:00:00.000Z',
        updatedAt: '2026-03-10T09:00:00.000Z',
      },
      {
        id: 'ledger_4',
        organizationId: 'org_1',
        creditAccountId: 'credit_1',
        kind: 'job_reserve',
        deltaCredits: -12,
        balanceAfter: 35,
        generationJobId: 'job_reserved_only',
        createdAt: '2026-03-11T09:00:00.000Z',
        updatedAt: '2026-03-11T09:00:00.000Z',
      },
      {
        id: 'ledger_5',
        organizationId: 'org_1',
        creditAccountId: 'credit_1',
        kind: 'job_capture',
        deltaCredits: 0,
        balanceAfter: 12,
        generationJobId: 'job_previous_month',
        createdAt: '2026-02-28T09:00:00.000Z',
        updatedAt: '2026-02-28T09:00:00.000Z',
      },
    ]);
    runtime.generationJobs.getById.mockImplementation(async (jobId: string) => {
      switch (jobId) {
        case 'job_script':
          return {
            id: 'job_script',
            organizationId: 'org_1',
            projectId: 'proj_1',
            kind: 'script-generation',
            billingState: 'captured',
            settledCredits: 45,
            reservedCredits: 45,
          };
        case 'job_storyboard':
          return {
            id: 'job_storyboard',
            organizationId: 'org_1',
            projectId: 'proj_1',
            kind: 'storyboard-generation',
            billingState: 'captured',
            settledCredits: 8,
            reservedCredits: 8,
          };
        case 'job_analysis':
          return {
            id: 'job_analysis',
            organizationId: 'org_1',
            projectId: 'proj_2',
            kind: 'analysis-generation',
            billingState: 'captured',
            settledCredits: 12,
            reservedCredits: 12,
          };
        default:
          return null;
      }
    });

    const usage = await getBillingUsageSummary('org_1', new Date('2026-03-24T12:00:00.000Z'));

    expect(usage).toMatchObject({
      periodStart: '2026-03-01T00:00:00.000Z',
      periodEnd: '2026-04-01T00:00:00.000Z',
      totalCreditsConsumed: 65,
      totalCapturedJobs: 3,
    });
    expect(usage.byProject).toEqual([
      {
        projectId: 'proj_1',
        projectName: 'Project Alpha',
        creditsConsumed: 53,
        jobCount: 2,
        share: 53 / 65,
      },
      {
        projectId: 'proj_2',
        projectName: 'Project Beta',
        creditsConsumed: 12,
        jobCount: 1,
        share: 12 / 65,
      },
    ]);
    expect(usage.byTaskType).toEqual([
      {
        jobKind: 'script-generation',
        creditsConsumed: 45,
        jobCount: 1,
        share: 45 / 65,
      },
      {
        jobKind: 'analysis-generation',
        creditsConsumed: 12,
        jobCount: 1,
        share: 12 / 65,
      },
      {
        jobKind: 'storyboard-generation',
        creditsConsumed: 8,
        jobCount: 1,
        share: 8 / 65,
      },
    ]);
  });

  it('returns empty usage when the current month has no captured jobs', async () => {
    runtime.projects.listByOrganizationId.mockResolvedValue([]);
    runtime.creditLedger.listByOrganizationId.mockResolvedValue([]);

    const usage = await getBillingUsageSummary('org_1', new Date('2026-03-24T12:00:00.000Z'));

    expect(usage).toEqual({
      periodStart: '2026-03-01T00:00:00.000Z',
      periodEnd: '2026-04-01T00:00:00.000Z',
      totalCreditsConsumed: 0,
      totalCapturedJobs: 0,
      byProject: [],
      byTaskType: [],
    });
    expect(runtime.generationJobs.getById).not.toHaveBeenCalled();
  });
});
