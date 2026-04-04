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
  it('builds markdown exports', () => {
    const payload = buildProjectExportPayload(bundleWithInsights, 'markdown');
    expect(payload.format).toBe('text/markdown');
    expect(payload.extension).toBe('md');
    expect(payload.content).toContain('# Sample Project');
    expect(payload.content).toContain('## Artifacts');
    expect(payload.content).toContain('Episode 1');
  });

  it('builds json exports', () => {
    const payload = buildProjectExportPayload(bundleWithInsights, 'json');
    expect(payload.format).toBe('application/json');
    expect(payload.extension).toBe('json');
    expect(JSON.parse(payload.content)).toMatchObject({
      project: {
        name: 'Sample Project',
      },
      artifacts: [
        {
          title: 'Episode 1',
        },
      ],
      artifactRelations: [
        {
          id: 'relation_1',
        },
      ],
    });
  });

  it('builds plain text exports', () => {
    const payload = buildProjectExportPayload(bundleWithInsights, 'text');
    expect(payload.format).toBe('text/plain');
    expect(payload.extension).toBe('txt');
    expect(payload.content).toContain('SOURCE DOCUMENTS');
    expect(payload.content).toContain('[script v1] Episode 1');
    expect(payload.content).toContain('ARTIFACT RELATIONS');
    expect(payload.content).toContain('artifact_0 -> artifact_1');
  });
});
