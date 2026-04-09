import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireViewerResponse: vi.fn(),
  viewerOwnsArtifact: vi.fn(),
  getPlatformRuntime: vi.fn(),
}));

vi.mock('@/server/auth/http', () => ({
  requireViewerResponse: () => mocks.requireViewerResponse(),
}));

vi.mock('@/server/auth/viewer-access', () => ({
  viewerOwnsArtifact: (...args: unknown[]) => mocks.viewerOwnsArtifact(...args),
}));

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: () => mocks.getPlatformRuntime(),
}));

import { GET } from '@/app/api/artifacts/[artifactId]/download/route';

describe('artifact download route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireViewerResponse.mockResolvedValue({
      viewer: {
        organization: { id: 'org_1' },
        workspace: { id: 'ws_1' },
        user: { id: 'user_1' },
      },
      response: null,
    });
    mocks.viewerOwnsArtifact.mockReturnValue(true);
    mocks.getPlatformRuntime.mockReturnValue({
      generationArtifacts: {
        getById: vi.fn(),
      },
    });
  });

  it('returns 404 when the artifact does not exist', async () => {
    const runtime = mocks.getPlatformRuntime();
    runtime.generationArtifacts.getById.mockResolvedValueOnce(null);

    const response = await GET(new Request('https://app.test/api/artifacts/artifact_1/download'), {
      params: Promise.resolve({ artifactId: 'artifact_1' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'ARTIFACT_NOT_FOUND',
    });
  });

  it('returns 404 when the viewer cannot access the artifact', async () => {
    const runtime = mocks.getPlatformRuntime();
    runtime.generationArtifacts.getById.mockResolvedValueOnce({
      id: 'artifact_1',
      organizationId: 'org_2',
      workspaceId: 'ws_2',
      projectId: 'proj_2',
      title: 'Secret export',
      format: 'text/plain',
      content: 'hidden',
      metadata: {},
    });
    mocks.viewerOwnsArtifact.mockReturnValueOnce(false);

    const response = await GET(new Request('https://app.test/api/artifacts/artifact_1/download'), {
      params: Promise.resolve({ artifactId: 'artifact_1' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'ARTIFACT_NOT_FOUND',
    });
  });

  it.each([
    ['text/plain', 'Episode 1 Script', 'episode-1-script.txt'],
    ['text/markdown', 'Storyboard Notes', 'storyboard-notes.md'],
    ['application/json', 'Project Export', 'project-export.json'],
    ['text/csv', 'Storyboard Sheet', 'storyboard-sheet.csv'],
  ])('serves %s artifacts with the expected download filename', async (format, title, filename) => {
    const runtime = mocks.getPlatformRuntime();
    runtime.generationArtifacts.getById.mockResolvedValueOnce({
      id: 'artifact_1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      title,
      format,
      content: 'payload',
      metadata: {},
    });

    const response = await GET(new Request('https://app.test/api/artifacts/artifact_1/download'), {
      params: Promise.resolve({ artifactId: 'artifact_1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(`${format}; charset=utf-8`);
    expect(response.headers.get('Content-Disposition')).toBe(`attachment; filename="${filename}"`);
    await expect(response.text()).resolves.toBe('payload');
  });

  it('decodes base64 docx artifacts and omits utf-8 charset', async () => {
    const runtime = mocks.getPlatformRuntime();
    const docxPayload = Buffer.from('PK-docx-bytes');
    runtime.generationArtifacts.getById.mockResolvedValueOnce({
      id: 'artifact_1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      title: 'Script Export',
      format: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      content: docxPayload.toString('base64'),
      metadata: {
        contentEncoding: 'base64',
      },
    });

    const response = await GET(new Request('https://app.test/api/artifacts/artifact_1/download'), {
      params: Promise.resolve({ artifactId: 'artifact_1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="script-export.docx"');
    const arrayBuffer = await response.arrayBuffer();
    expect(Buffer.from(arrayBuffer)).toEqual(docxPayload);
  });

  it('prefers metadata download filenames over generated names', async () => {
    const runtime = mocks.getPlatformRuntime();
    runtime.generationArtifacts.getById.mockResolvedValueOnce({
      id: 'artifact_1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      title: 'Ignored title',
      format: 'application/json',
      content: '{"ok":true}',
      metadata: {
        downloadFilename: 'custom-export.json',
      },
    });

    const response = await GET(new Request('https://app.test/api/artifacts/artifact_1/download'), {
      params: Promise.resolve({ artifactId: 'artifact_1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="custom-export.json"');
  });

  it('returns the auth response when the viewer is missing', async () => {
    mocks.requireViewerResponse.mockResolvedValueOnce({
      viewer: null,
      response: NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 }),
    });

    const response = await GET(new Request('https://app.test/api/artifacts/artifact_1/download'), {
      params: Promise.resolve({ artifactId: 'artifact_1' }),
    });

    expect(response.status).toBe(401);
    expect(mocks.getPlatformRuntime).not.toHaveBeenCalled();
  });
});
