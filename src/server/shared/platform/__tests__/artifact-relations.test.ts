import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('artifact relation repository', () => {
  let previousStorePath: string | undefined;
  let tempDir: string | null = null;

  beforeEach(() => {
    previousStorePath = process.env.NOVELSCRIPT_STORE_PATH;
  });

  afterEach(async () => {
    if (previousStorePath === undefined) {
      delete process.env.NOVELSCRIPT_STORE_PATH;
    } else {
      process.env.NOVELSCRIPT_STORE_PATH = previousStorePath;
    }

    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('creates, batches, and queries artifact relations', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'novelscript-artifact-relations-'));
    process.env.NOVELSCRIPT_STORE_PATH = path.join(tempDir, 'store.json');

    vi.resetModules();
    const { createPersistentPlatformRuntime, readPlatformStore } = await import('@/server/shared/platform/runtime');
    const runtime = createPersistentPlatformRuntime();

    const singleRelation = await runtime.artifactRelations.create({
      projectId: 'proj_1',
      upstreamArtifactId: 'analysis_1',
      downstreamArtifactId: 'outline_1',
      createdByUserId: 'user_1',
    });
    const batchedRelations = await runtime.artifactRelations.createMany([
      {
        projectId: 'proj_1',
        upstreamArtifactId: 'outline_1',
        downstreamArtifactId: 'script_1',
        createdByUserId: 'user_1',
      },
      {
        projectId: 'proj_1',
        upstreamArtifactId: 'script_1',
        downstreamArtifactId: 'storyboard_1',
        createdByUserId: 'user_1',
      },
      {
        projectId: 'proj_2',
        upstreamArtifactId: 'analysis_other',
        downstreamArtifactId: 'outline_other',
        createdByUserId: 'user_2',
      },
    ]);

    const projectRelations = await runtime.artifactRelations.listByProjectId('proj_1');
    const downstreamRelations = await runtime.artifactRelations.listByDownstreamArtifactId('storyboard_1');
    const stored = await readPlatformStore();

    expect(singleRelation.relationType).toBe('derived_from');
    expect(batchedRelations).toHaveLength(3);
    expect(projectRelations.map((relation) => relation.downstreamArtifactId)).toEqual([
      'outline_1',
      'script_1',
      'storyboard_1',
    ]);
    expect(downstreamRelations).toMatchObject([
      {
        upstreamArtifactId: 'script_1',
        downstreamArtifactId: 'storyboard_1',
      },
    ]);
    expect(stored.artifactRelations).toHaveLength(4);
    expect(stored.artifactRelations.map((relation) => relation.projectId)).toEqual([
      'proj_1',
      'proj_1',
      'proj_1',
      'proj_2',
    ]);
  });
});
