import { describe, expect, it } from 'vitest';
import type { GenerationArtifact } from '@/server/shared/platform/domain';
import {
  buildStoryboardGenerationPayload,
  deriveDefaultStoryboardSourceArtifactIds,
  deriveStoryboardScopeEpisodeOptions,
  deriveStoryboardScopeSceneOptions,
  deriveStoryboardScopeSourceOptions,
} from '@/features/saas/project/storyboard-scope';

function createScriptArtifact(
  overrides: Partial<GenerationArtifact> & Pick<GenerationArtifact, 'id' | 'title' | 'version' | 'createdAt'>
): GenerationArtifact {
  return {
    id: overrides.id,
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    projectId: 'proj_1',
    generationJobId: 'job_1',
    kind: 'script',
    format: 'text/plain',
    title: overrides.title,
    version: overrides.version,
    content: overrides.content ?? null,
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt ?? overrides.createdAt,
    metadata: overrides.metadata ?? undefined,
  };
}

describe('storyboard scope helpers', () => {
  it('prefers the latest script version per episode as the default storyboard source set', () => {
    const sourceOptions = deriveStoryboardScopeSourceOptions([
      createScriptArtifact({
        id: 'script_ep1_v1',
        title: '第1集剧本',
        version: 1,
        createdAt: '2026-03-20T10:00:00.000Z',
        metadata: { episode: 1 },
      }),
      createScriptArtifact({
        id: 'script_ep1_v2',
        title: '第1集剧本',
        version: 2,
        createdAt: '2026-03-21T10:00:00.000Z',
        metadata: { episode: 1 },
      }),
      createScriptArtifact({
        id: 'script_ep2_v1',
        title: '第2集剧本',
        version: 1,
        createdAt: '2026-03-22T10:00:00.000Z',
        metadata: { episode: 2 },
      }),
    ]);

    expect(deriveDefaultStoryboardSourceArtifactIds(sourceOptions)).toEqual([
      'script_ep2_v1',
      'script_ep1_v2',
    ]);
  });

  it('derives episode and scene filters from the currently selected source versions', () => {
    const sourceOptions = deriveStoryboardScopeSourceOptions([
      createScriptArtifact({
        id: 'script_ep1_v2',
        title: '第1集剧本',
        version: 2,
        createdAt: '2026-03-21T10:00:00.000Z',
        metadata: { episode: 1 },
        content: `1-1 日 内 客厅
阿明：进门

1-2 夜 外 楼下
阿明：抬头`,
      }),
      createScriptArtifact({
        id: 'script_ep2_v1',
        title: '第2集剧本',
        version: 1,
        createdAt: '2026-03-22T10:00:00.000Z',
        metadata: { episode: 2 },
        content: `2-1 夜 内 办公室
林晚：停下`,
      }),
    ]);

    expect(
      deriveStoryboardScopeEpisodeOptions(sourceOptions, ['script_ep1_v2'])
    ).toEqual([1]);
    expect(
      deriveStoryboardScopeSceneOptions(sourceOptions, ['script_ep1_v2'])
    ).toEqual([
      {
        artifactId: 'script_ep1_v2',
        id: '1-1',
        heading: '1-1 日 内 客厅',
        episodeNumber: 1,
      },
      {
        artifactId: 'script_ep1_v2',
        id: '1-2',
        heading: '1-2 夜 外 楼下',
        episodeNumber: 1,
      },
    ]);
  });

  it('builds storyboard generation payloads with selection filters only when needed', () => {
    expect(
      buildStoryboardGenerationPayload({
        artifactIds: [' script_ep1_v2 ', 'script_ep2_v1'],
        episodeNumbers: [],
        sceneIds: [],
      })
    ).toEqual({
      scriptArtifactIds: ['script_ep1_v2', 'script_ep2_v1'],
    });

    expect(
      buildStoryboardGenerationPayload({
        artifactIds: ['script_ep1_v2', 'script_ep2_v1'],
        episodeNumbers: [2, 1, 2],
        sceneIds: [' 1-1 ', '2-1'],
      })
    ).toEqual({
      scope: 'selection',
      scriptArtifactIds: ['script_ep1_v2', 'script_ep2_v1'],
      selection: {
        artifactIds: [],
        episodeNumbers: [1, 2],
        sceneIds: ['1-1', '2-1'],
      },
    });
  });
});
