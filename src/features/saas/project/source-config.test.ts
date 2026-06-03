import { describe, expect, it } from 'vitest';
import type { GenerationJob } from '@/server/shared/platform/domain';
import {
  DEFAULT_PROJECT_SOURCE_DRAFT_CONFIG,
  deriveProjectSourceDraftConfig,
} from '@/features/saas/project/source-config';

describe('deriveProjectSourceDraftConfig', () => {
  it('hydrates source config from the latest script-generation job payload', () => {
    const config = deriveProjectSourceDraftConfig({
      projectGenre: 'fantasy',
      jobs: [
        buildJob({
          id: 'job_old',
          createdAt: '2026-04-10T10:00:00.000Z',
          inputSnapshot: {
            payload: {
              config: {
                genre: 'urban',
                episodeCount: 3,
                episodeDuration: '1:30-2:00',
                style: 'dramatic',
              },
            },
          },
        }),
        buildJob({
          id: 'job_new',
          createdAt: '2026-04-12T10:00:00.000Z',
          status: 'failed',
          inputSnapshot: {
            payload: {
              config: {
                genre: 'xianxia',
                episodeCount: 1,
                episodeDuration: '1:00-1:30',
                style: 'suspense',
              },
            },
          },
        }),
      ],
    });

    expect(config).toEqual({
      genre: 'xianxia',
      episodeCount: 1,
      episodeDuration: '1:00-1:30',
      style: 'suspense',
    });
  });

  it('falls back to the project genre and defaults when no valid script config exists', () => {
    const config = deriveProjectSourceDraftConfig({
      projectGenre: 'rebirth',
      jobs: [
        buildJob({
          kind: 'storyboard-generation',
        }),
        buildJob({
          kind: 'script-generation',
          inputSnapshot: {
            payload: {
              config: {
                genre: 'invalid',
                episodeCount: 0,
                episodeDuration: '10:00-20:00',
                style: 'unknown',
              },
            },
          },
        }),
      ],
    });

    expect(config).toEqual({
      ...DEFAULT_PROJECT_SOURCE_DRAFT_CONFIG,
      genre: 'rebirth',
    });
  });
});

function buildJob(overrides: Partial<GenerationJob> = {}): GenerationJob {
  return {
    id: overrides.id ?? 'job_1',
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    projectId: 'proj_1',
    sourceDocumentId: null,
    kind: overrides.kind ?? 'script-generation',
    status: overrides.status ?? 'succeeded',
    billingState: overrides.billingState ?? 'captured',
    reservedCredits: overrides.reservedCredits ?? 0,
    settledCredits: overrides.settledCredits ?? 0,
    progress: overrides.progress ?? 100,
    currentStep: overrides.currentStep ?? 'done',
    requestedByUserId: 'user_1',
    requestedBySessionId: 'sess_1',
    modelName: 'test-model',
    inputSnapshot: overrides.inputSnapshot ?? {},
    outputSummary: overrides.outputSummary ?? null,
    errorMessage: overrides.errorMessage ?? null,
    startedAt: overrides.startedAt ?? '2026-04-10T09:00:00.000Z',
    finishedAt: overrides.finishedAt ?? '2026-04-10T09:05:00.000Z',
    cancelledAt: overrides.cancelledAt ?? null,
    createdAt: overrides.createdAt ?? '2026-04-10T09:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-04-10T09:05:00.000Z',
    createdByUserId: 'user_1',
    updatedByUserId: 'user_1',
  };
}
