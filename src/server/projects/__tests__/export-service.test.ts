import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { buildProjectExportPayload } from '@/server/projects/export-service';
import { buildProjectArtifactInsights } from '@/server/projects/insights';

const bundle = {
  project: {
    id: 'proj_1',
    organizationId: 'org_1',
    workspaceId: 'ws_1',
    slug: 'sample-project',
    name: 'Sample Project',
    description: 'Project description',
    status: 'active' as const,
    genre: 'urban',
    createdAt: '2026-03-23T00:00:00.000Z',
    updatedAt: '2026-03-23T00:00:00.000Z',
  },
  sourceDocuments: [
    {
      id: 'src_1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      title: 'Source',
      kind: 'novel' as const,
      status: 'ready' as const,
      mimeType: 'text/plain',
      textContent: 'source text',
      wordCount: 2,
      createdAt: '2026-03-23T00:00:00.000Z',
      updatedAt: '2026-03-23T00:00:00.000Z',
    },
  ],
  jobs: [
    {
      id: 'job_1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      kind: 'script-generation' as const,
      status: 'succeeded' as const,
      billingState: 'captured' as const,
      progress: 100,
      currentStep: 'done',
      inputSnapshot: {},
      createdAt: '2026-03-23T00:00:00.000Z',
      updatedAt: '2026-03-23T00:00:00.000Z',
    },
  ],
  artifacts: [
    {
      id: 'artifact_1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      generationJobId: 'job_1',
      kind: 'script' as const,
      format: 'text/markdown' as const,
      title: 'Episode 1',
      version: 1,
      content: 'script content',
      createdAt: '2026-03-23T00:00:00.000Z',
      updatedAt: '2026-03-23T00:00:00.000Z',
    },
    {
      id: 'artifact_2',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      generationJobId: 'job_1',
      kind: 'storyboard' as const,
      format: 'text/plain' as const,
      title: 'Storyboard 1',
      version: 1,
      content: 'shot list',
      metadata: {
        sourceScriptArtifactIds: ['artifact_1'],
        shotCount: 1,
        shots: [
          {
            sceneId: 'S1',
            shotId: 'S1-1',
            shotType: 'wide',
            camera: 'static',
            composition: 'centered',
            motion: 'push-in',
            subject: 'Lead actor',
            environment: 'Warehouse',
            lighting: 'moody',
            audioHint: 'footsteps',
            videoPrompt: 'A slow push-in on the protagonist in a warehouse.',
          },
        ],
      },
      createdAt: '2026-03-23T01:00:00.000Z',
      updatedAt: '2026-03-23T01:00:00.000Z',
    },
  ],
  artifactRelations: [
    {
      id: 'relation_1',
      projectId: 'proj_1',
      upstreamArtifactId: 'artifact_0',
      downstreamArtifactId: 'artifact_1',
      relationType: 'derived_from' as const,
      createdAt: '2026-03-23T00:00:00.000Z',
      updatedAt: '2026-03-23T00:00:00.000Z',
    },
  ],
};

const bundleWithInsights = {
  ...bundle,
  insights: buildProjectArtifactInsights(bundle.artifacts),
};

describe('buildProjectExportPayload', () => {
  it('builds markdown exports', async () => {
    const payload = await buildProjectExportPayload(bundleWithInsights, 'markdown');
    expect(payload.format).toBe('text/markdown');
    expect(payload.extension).toBe('md');
    expect(payload.content).toContain('# Sample Project');
    expect(payload.content).toContain('## Artifacts');
    expect(payload.content).toContain('Episode 1');
  });

  it('builds json exports', async () => {
    const payload = await buildProjectExportPayload(bundleWithInsights, 'json');
    expect(payload.format).toBe('application/json');
    expect(payload.extension).toBe('json');
    expect(JSON.parse(payload.content)).toMatchObject({
      project: {
        name: 'Sample Project',
      },
    });
    const parsed = JSON.parse(payload.content) as {
      artifacts: Array<{ title: string }>;
      artifactRelations: Array<{ id: string }>;
    };
    expect(parsed.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Episode 1',
        }),
      ])
    );
    expect(parsed.artifactRelations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'relation_1',
        }),
      ])
    );
  });

  it('builds plain text exports', async () => {
    const payload = await buildProjectExportPayload(bundleWithInsights, 'text');
    expect(payload.format).toBe('text/plain');
    expect(payload.extension).toBe('txt');
    expect(payload.content).toContain('SOURCE DOCUMENTS');
    expect(payload.content).toContain('[script v1] Episode 1');
    expect(payload.content).toContain('ARTIFACT RELATIONS');
    expect(payload.content).toContain('artifact_0 -> artifact_1');
  });

  it('builds docx exports for script and storyboard artifacts', async () => {
    const payload = await buildProjectExportPayload(bundleWithInsights, 'docx');
    const docxBuffer = Buffer.from(payload.content, 'base64');

    expect(payload.format).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(payload.extension).toBe('docx');
    expect(payload.contentEncoding).toBe('base64');
    expect(docxBuffer.subarray(0, 2).toString('utf8')).toBe('PK');
    expect(payload.metadata).toMatchObject({
      exportTargetKinds: ['script', 'storyboard'],
    });
  });

  it('builds csv exports from structured storyboard shots', async () => {
    const payload = await buildProjectExportPayload(bundleWithInsights, 'csv');
    const parsed = Papa.parse<Record<string, string>>(payload.content, {
      header: true,
      skipEmptyLines: true,
    });

    expect(payload.format).toBe('text/csv');
    expect(payload.extension).toBe('csv');
    expect(payload.metadata).toMatchObject({
      csvRowCount: 1,
      exportTargetKinds: ['storyboard'],
      includedStoryboardArtifactIds: ['artifact_2'],
    });
    expect(parsed.data).toEqual([
      expect.objectContaining({
        storyboardArtifactId: 'artifact_2',
        storyboardTitle: 'Storyboard 1',
        storyboardVersion: '1',
        sourceScriptArtifactIds: 'artifact_1',
        sceneId: 'S1',
        shotId: 'S1-1',
        shotType: 'wide',
        camera: 'static',
        videoPrompt: 'A slow push-in on the protagonist in a warehouse.',
      }),
    ]);
  });
});
