import { describe, expect, it } from 'vitest';
import type {
  GenerationArtifact,
  GenerationJob,
} from '@/server/shared/platform/domain';
import {
  buildProjectWorkspaceOnboardingSteps,
  buildProjectsOnboardingSteps,
} from '@/features/saas/project/onboarding';

const labels = {
  createProjectTitle: 'Create a project',
  createProjectDescription: 'Set up the workspace for your first adaptation.',
  saveSourceTitle: 'Save source text',
  saveSourceDescription: 'Paste or upload the novel before running jobs.',
  generateScriptTitle: 'Generate script',
  generateScriptDescription: 'Run the script pipeline and review the first version.',
  generateStoryboardTitle: 'Generate storyboard',
  generateStoryboardDescription: 'Continue from script into storyboard output.',
};

function createArtifact(kind: GenerationArtifact['kind']): GenerationArtifact {
  return {
    id: `artifact_${kind}`,
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    projectId: 'proj_1',
    generationJobId: 'job_1',
    kind,
    format: 'text/plain',
    title: kind,
    version: 1,
    content: kind,
    createdAt: '2026-03-24T10:00:00.000Z',
    updatedAt: '2026-03-24T10:00:00.000Z',
  };
}

function createJob(
  kind: GenerationJob['kind'],
  status: GenerationJob['status']
): GenerationJob {
  return {
    id: `job_${kind}`,
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    projectId: 'proj_1',
    kind,
    status,
    billingState: 'none',
    progress: 0,
    inputSnapshot: {},
    createdAt: '2026-03-24T10:00:00.000Z',
    updatedAt: '2026-03-24T10:00:00.000Z',
  };
}

describe('onboarding helpers', () => {
  it('builds project list quick-start steps with create-project first', () => {
    expect(buildProjectsOnboardingSteps(labels)).toEqual([
      expect.objectContaining({ id: 'create-project', tone: 'current' }),
      expect.objectContaining({ id: 'save-source', tone: 'pending' }),
      expect.objectContaining({ id: 'generate-script', tone: 'pending' }),
      expect.objectContaining({ id: 'generate-storyboard', tone: 'pending' }),
    ]);
  });

  it('marks source as current when a new workspace has no saved content yet', () => {
    expect(
      buildProjectWorkspaceOnboardingSteps({
        locale: 'zh-CN',
        sourceText: '',
        artifacts: [],
        jobs: [],
        labels,
      })
    ).toEqual([
      expect.objectContaining({ id: 'save-source', tone: 'current' }),
      expect.objectContaining({ id: 'generate-script', tone: 'pending' }),
      expect.objectContaining({ id: 'generate-storyboard', tone: 'pending' }),
    ]);
  });

  it('advances the checklist as script and storyboard assets appear', () => {
    expect(
      buildProjectWorkspaceOnboardingSteps({
        locale: 'zh-CN',
        sourceText: 'novel text',
        artifacts: [createArtifact('script')],
        jobs: [createJob('script-generation', 'succeeded')],
        labels,
      })
    ).toEqual([
      expect.objectContaining({ id: 'save-source', tone: 'completed' }),
      expect.objectContaining({ id: 'generate-script', tone: 'completed' }),
      expect.objectContaining({ id: 'generate-storyboard', tone: 'current' }),
    ]);

    expect(
      buildProjectWorkspaceOnboardingSteps({
        locale: 'zh-CN',
        sourceText: 'novel text',
        artifacts: [createArtifact('script'), createArtifact('storyboard')],
        jobs: [
          createJob('script-generation', 'succeeded'),
          createJob('storyboard-generation', 'succeeded'),
        ],
        labels,
      })
    ).toEqual([
      expect.objectContaining({ id: 'save-source', tone: 'completed' }),
      expect.objectContaining({ id: 'generate-script', tone: 'completed' }),
      expect.objectContaining({ id: 'generate-storyboard', tone: 'completed' }),
    ]);
  });
});
