import { getPlatformRuntime } from '@/server/shared/platform';
import type { GenerationJobKind } from '@/server/shared/platform/domain';

export interface BillingUsageProjectSummary {
  projectId: string;
  projectName: string;
  creditsConsumed: number;
  jobCount: number;
  share: number;
}

export interface BillingUsageTaskTypeSummary {
  jobKind: GenerationJobKind;
  creditsConsumed: number;
  jobCount: number;
  share: number;
}

export interface BillingUsageSummary {
  periodStart: string;
  periodEnd: string;
  totalCreditsConsumed: number;
  totalCapturedJobs: number;
  byProject: BillingUsageProjectSummary[];
  byTaskType: BillingUsageTaskTypeSummary[];
}

interface AggregationBucket {
  creditsConsumed: number;
  jobCount: number;
}

export async function getBillingUsageSummary(
  organizationId: string,
  asOf: Date = new Date()
): Promise<BillingUsageSummary> {
  const runtime = getPlatformRuntime();
  const { periodStart, periodEnd } = getUtcMonthBounds(asOf);
  const [projects, ledgerEntries] = await Promise.all([
    runtime.projects.listByOrganizationId(organizationId),
    runtime.creditLedger.listByOrganizationId(organizationId),
  ]);

  const capturedJobIds = Array.from(
    new Set(
      ledgerEntries
        .filter((entry) => {
          return (
            entry.kind === 'job_capture' &&
            Boolean(entry.generationJobId) &&
            entry.createdAt >= periodStart &&
            entry.createdAt < periodEnd
          );
        })
        .map((entry) => entry.generationJobId as string)
    )
  );

  if (capturedJobIds.length === 0) {
    return {
      periodStart,
      periodEnd,
      totalCreditsConsumed: 0,
      totalCapturedJobs: 0,
      byProject: [],
      byTaskType: [],
    };
  }

  const jobs = await Promise.all(capturedJobIds.map((jobId) => runtime.generationJobs.getById(jobId)));
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const byProject = new Map<string, AggregationBucket>();
  const byTaskType = new Map<GenerationJobKind, AggregationBucket>();

  let totalCreditsConsumed = 0;
  let totalCapturedJobs = 0;

  for (const job of jobs) {
    if (!job || job.organizationId !== organizationId || job.billingState !== 'captured') {
      continue;
    }

    const creditsConsumed = Math.max(0, job.settledCredits ?? job.reservedCredits ?? 0);
    if (creditsConsumed === 0) {
      continue;
    }

    totalCreditsConsumed += creditsConsumed;
    totalCapturedJobs += 1;

    const projectBucket = byProject.get(job.projectId) ?? { creditsConsumed: 0, jobCount: 0 };
    projectBucket.creditsConsumed += creditsConsumed;
    projectBucket.jobCount += 1;
    byProject.set(job.projectId, projectBucket);

    const taskBucket = byTaskType.get(job.kind) ?? { creditsConsumed: 0, jobCount: 0 };
    taskBucket.creditsConsumed += creditsConsumed;
    taskBucket.jobCount += 1;
    byTaskType.set(job.kind, taskBucket);
  }

  return {
    periodStart,
    periodEnd,
    totalCreditsConsumed,
    totalCapturedJobs,
    byProject: Array.from(byProject.entries())
      .map(([projectId, bucket]) => ({
        projectId,
        projectName: projectNames.get(projectId) ?? projectId,
        creditsConsumed: bucket.creditsConsumed,
        jobCount: bucket.jobCount,
        share: totalCreditsConsumed > 0 ? bucket.creditsConsumed / totalCreditsConsumed : 0,
      }))
      .sort(sortByCreditsThenCount),
    byTaskType: Array.from(byTaskType.entries())
      .map(([jobKind, bucket]) => ({
        jobKind,
        creditsConsumed: bucket.creditsConsumed,
        jobCount: bucket.jobCount,
        share: totalCreditsConsumed > 0 ? bucket.creditsConsumed / totalCreditsConsumed : 0,
      }))
      .sort(sortByCreditsThenCount),
  };
}

function getUtcMonthBounds(asOf: Date) {
  const periodStart = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1)).toISOString();
  const periodEnd = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + 1, 1)).toISOString();
  return { periodStart, periodEnd };
}

function sortByCreditsThenCount(
  left: AggregationBucket & { creditsConsumed: number; jobCount: number },
  right: AggregationBucket & { creditsConsumed: number; jobCount: number }
) {
  if (right.creditsConsumed !== left.creditsConsumed) {
    return right.creditsConsumed - left.creditsConsumed;
  }

  return right.jobCount - left.jobCount;
}
