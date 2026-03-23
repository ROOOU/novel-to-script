import type {
  GenerationJob,
  GenerationJobRepository,
  Timestamp,
  UpdateGenerationJobInput,
} from '@/server/shared/platform';

const jobs = new Map<string, GenerationJob>();

export function createInMemoryGenerationJobRepository(): GenerationJobRepository {
  return {
    async getById(id) {
      return jobs.get(id) ?? null;
    },
    async listByProjectId(projectId) {
      return Array.from(jobs.values()).filter((job) => job.projectId === projectId);
    },
    async listByWorkspaceId(workspaceId) {
      return Array.from(jobs.values()).filter((job) => job.workspaceId === workspaceId);
    },
    async listActiveByWorkspaceId(workspaceId) {
      return Array.from(jobs.values()).filter((job) => {
        return (
          job.workspaceId === workspaceId &&
          (job.status === 'queued' || job.status === 'running')
        );
      });
    },
    async create(input) {
      const now = new Date().toISOString();
      const id = createJobId();
      const job: GenerationJob = {
        id,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        sourceDocumentId: input.sourceDocumentId ?? null,
        kind: input.kind,
        status: 'queued',
        billingState: input.billingState ?? 'none',
        reservedCredits: input.reservedCredits ?? null,
        settledCredits: input.settledCredits ?? null,
        progress: 0,
        currentStep: null,
        requestedByUserId: input.requestedByUserId ?? null,
        requestedBySessionId: input.requestedBySessionId ?? null,
        modelName: input.modelName ?? null,
        inputSnapshot: input.inputSnapshot,
        outputSummary: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
        cancelledAt: null,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.requestedByUserId ?? null,
        updatedByUserId: input.requestedByUserId ?? null,
      };

      jobs.set(id, job);
      return job;
    },
    async update(id, input) {
      return updateJob(id, input);
    },
    async markQueued(id, updatedByUserId) {
      return updateJob(id, {
        status: 'queued',
        updatedByUserId,
      });
    },
    async markRunning(id, startedAt, updatedByUserId) {
      return updateJob(id, {
        status: 'running',
        startedAt: startedAt ?? new Date().toISOString(),
        updatedByUserId,
      });
    },
    async markSucceeded(id, input) {
      return updateJob(id, {
        ...input,
        status: 'succeeded',
        finishedAt: input.finishedAt ?? new Date().toISOString(),
      });
    },
    async markFailed(id, input) {
      return updateJob(id, {
        ...input,
        status: 'failed',
        finishedAt: input.finishedAt ?? new Date().toISOString(),
      });
    },
    async cancel(id, cancelledAt, updatedByUserId) {
      return updateJob(id, {
        status: 'cancelled',
        cancelledAt: cancelledAt ?? new Date().toISOString(),
        updatedByUserId,
      });
    },
  };
}

function updateJob(id: string, input: UpdateGenerationJobInput): GenerationJob {
  const current = jobs.get(id);
  if (!current) {
    throw new Error(`Generation job not found: ${id}`);
  }

  const next: GenerationJob = {
    ...current,
    ...input,
    updatedAt: new Date().toISOString(),
    updatedByUserId:
      input.updatedByUserId !== undefined ? input.updatedByUserId : current.updatedByUserId,
  };

  jobs.set(id, next);
  return next;
}

function createJobId(): string {
  return `job_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
}

export function resolveRuntimeWorkspaceId(workspaceId: string | null | undefined): string {
  return workspaceId || 'demo-workspace';
}

export function resolveRuntimeOrganizationId(organizationId: string | null | undefined): string {
  return organizationId || 'demo-organization';
}

export function resolveRuntimeProjectId(projectId: string | null | undefined, feature: string): string {
  return projectId || `demo-project-${feature}`;
}

export function getJobTimestamp(): Timestamp {
  return new Date().toISOString();
}

export function resetInMemoryGenerationJobs(): void {
  jobs.clear();
}
