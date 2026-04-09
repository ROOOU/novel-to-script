import { describe, expect, it } from 'vitest';
import type {
  GenerationArtifact,
  GenerationJob,
} from '@/server/shared/platform/domain';
import {
  deriveJobPipelineStages,
  deriveProjectPipelineStages,
  summarizeJobFailure,
} from '@/features/saas/project/pipeline-state';

describe('pipeline-state', () => {
  it('anchors project progress to the latest pipeline root job instead of old artifacts', () => {
    const jobs = [
      createJob({
        id: 'script_old',
        kind: 'script-generation',
        status: 'succeeded',
        createdAt: '2026-03-24T09:00:00.000Z',
        currentStep: 'done',
        inputSnapshot: {
          payload: {},
          metadata: {
            pipelineMode: 'novel-to-storyboard',
          },
        },
      }),
      createJob({
        id: 'story_old',
        kind: 'storyboard-generation',
        status: 'succeeded',
        createdAt: '2026-03-24T09:05:00.000Z',
        currentStep: 'done',
        inputSnapshot: {
          payload: {},
          metadata: {
            upstreamJobId: 'script_old',
          },
        },
      }),
      createJob({
        id: 'script_new',
        kind: 'script-generation',
        status: 'failed',
        createdAt: '2026-03-24T10:00:00.000Z',
        currentStep: 'outlining',
        inputSnapshot: {
          payload: {},
          metadata: {
            pipelineMode: 'novel-to-storyboard',
          },
        },
      }),
    ];

    const artifacts = [
      createArtifact({
        id: 'analysis_old',
        kind: 'analysis',
        generationJobId: 'script_old',
      }),
      createArtifact({
        id: 'outline_old',
        kind: 'outline',
        generationJobId: 'script_old',
      }),
      createArtifact({
        id: 'script_old_artifact',
        kind: 'script',
        generationJobId: 'script_old',
      }),
      createArtifact({
        id: 'story_old_artifact',
        kind: 'storyboard',
        generationJobId: 'story_old',
      }),
    ];

    const stages = deriveProjectPipelineStages('zh-CN', 'source text', artifacts, jobs);

    expect(stages.find((stage) => stage.id === 'analysis')?.status).toBe('failed');
    expect(stages.find((stage) => stage.id === 'outline')?.status).toBe('failed');
    expect(stages.find((stage) => stage.id === 'storyboard')?.status).toBe('pending');
    expect(stages.find((stage) => stage.id === 'storyboard')?.artifactId).toBeNull();
  });

  it('builds a two-stage pipeline view for related script and storyboard jobs', () => {
    const scriptJob = createJob({
      id: 'script_1',
      kind: 'script-generation',
      status: 'succeeded',
      currentStep: 'done',
      inputSnapshot: {
        payload: {},
        metadata: {
          pipelineMode: 'novel-to-storyboard',
        },
      },
    });
    const storyboardJob = createJob({
      id: 'story_1',
      kind: 'storyboard-generation',
      status: 'running',
      currentStep: 'generating',
      inputSnapshot: {
        payload: {},
        metadata: {
          upstreamJobId: 'script_1',
        },
      },
    });

    const stages = deriveJobPipelineStages(scriptJob, [scriptJob, storyboardJob]);

    expect(stages).toHaveLength(2);
    expect(stages[0]).toMatchObject({ title: 'Script', status: 'succeeded' });
    expect(stages[1]).toMatchObject({ title: 'Storyboard', status: 'running' });
  });

  it('summarizes the failure stage for pipeline jobs', () => {
    const storyboardJob = createJob({
      id: 'story_1',
      kind: 'storyboard-generation',
      status: 'failed',
      currentStep: 'generating',
      errorMessage: 'MODEL_TIMEOUT',
      inputSnapshot: {
        payload: {},
        metadata: {
          upstreamJobId: 'script_1',
        },
      },
    });

    expect(summarizeJobFailure('zh-CN', storyboardJob)).toBe('分镜阶段失败: MODEL_TIMEOUT');
    expect(summarizeJobFailure('en-US', storyboardJob)).toBe('Storyboard stage failed: MODEL_TIMEOUT');
  });

  it('surfaces the failure reason directly on failed stage cards', () => {
    const jobs = [
      createJob({
        id: 'script_failed',
        kind: 'script-generation',
        status: 'failed',
        currentStep: 'analyzing',
        errorMessage: 'LLM 请求被上游拒绝（400）',
        inputSnapshot: {
          payload: {},
          metadata: {
            pipelineMode: 'novel-to-storyboard',
          },
        },
      }),
    ];

    const stages = deriveProjectPipelineStages('zh-CN', 'source text', [], jobs);

    expect(stages.find((stage) => stage.id === 'analysis')?.summary).toBe(
      '分析失败：LLM 请求被上游拒绝（400）'
    );
  });
});

function createJob(overrides: Partial<GenerationJob>): GenerationJob {
  return {
    id: 'job_1',
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    projectId: 'proj_1',
    sourceDocumentId: null,
    kind: 'script-generation',
    status: 'queued',
    billingState: 'reserved',
    reservedCredits: 12,
    settledCredits: 0,
    requestedByUserId: 'user_1',
    requestedBySessionId: null,
    inputSnapshot: {
      payload: {},
      metadata: {},
    },
    progress: 0,
    currentStep: null,
    outputSummary: null,
    errorMessage: null,
    createdAt: '2026-03-24T00:00:00.000Z',
    updatedAt: '2026-03-24T00:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    ...overrides,
  } as GenerationJob;
}

function createArtifact(overrides: Partial<GenerationArtifact>): GenerationArtifact {
  return {
    id: 'artifact_1',
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    projectId: 'proj_1',
    sourceDocumentId: null,
    generationJobId: 'job_1',
    kind: 'script',
    format: 'text/plain',
    title: 'Artifact',
    content: 'body',
    version: 1,
    versionGroupId: null,
    parentArtifactId: null,
    metadata: {},
    isEditable: true,
    createdByUserId: 'user_1',
    updatedByUserId: 'user_1',
    createdAt: '2026-03-24T00:00:00.000Z',
    updatedAt: '2026-03-24T00:00:00.000Z',
    ...overrides,
  } as GenerationArtifact;
}
