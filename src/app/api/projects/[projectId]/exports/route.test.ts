import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireViewerResponse: vi.fn(),
  viewerOwnsProject: vi.fn(),
  getPlatformRuntime: vi.fn(),
  createProjectExportArtifact: vi.fn(),
}));

vi.mock('@/server/auth/http', () => ({
  requireViewerResponse: () => mocks.requireViewerResponse(),
}));

vi.mock('@/server/auth/viewer-access', () => ({
  viewerOwnsProject: (...args: unknown[]) => mocks.viewerOwnsProject(...args),
}));

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: () => mocks.getPlatformRuntime(),
}));

vi.mock('@/server/projects/export-service', () => ({
  createProjectExportArtifact: (...args: unknown[]) => mocks.createProjectExportArtifact(...args),
}));

import { POST } from '@/app/api/projects/[projectId]/exports/route';

describe('project exports route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireViewerResponse.mockResolvedValue({
      viewer: {
        organization: { id: 'org_1' },
        workspace: { id: 'ws_viewer' },
        user: { id: 'user_1' },
      },
      response: null,
    });
    mocks.viewerOwnsProject.mockReturnValue(true);
    mocks.getPlatformRuntime.mockReturnValue({
      projects: {
        getById: vi.fn().mockResolvedValue({
          id: 'proj_1',
          organizationId: 'org_1',
          workspaceId: 'ws_project',
        }),
      },
    });
    mocks.createProjectExportArtifact.mockResolvedValue({
      id: 'artifact_export_1',
      kind: 'export',
      format: 'text/markdown',
      title: 'Project export',
    });
  });

  it('returns 404 when the project does not exist', async () => {
    const runtime = mocks.getPlatformRuntime();
    runtime.projects.getById.mockResolvedValueOnce(null);

    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/exports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ format: 'markdown' }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'PROJECT_NOT_FOUND',
    });
    expect(mocks.createProjectExportArtifact).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid export payloads', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/exports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ format: 'pdf' }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
    });
    expect(mocks.createProjectExportArtifact).not.toHaveBeenCalled();
  });

  it('accepts csv exports', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/exports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ format: 'csv' }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.createProjectExportArtifact).toHaveBeenCalledWith({
      projectId: 'proj_1',
      organizationId: 'org_1',
      workspaceId: 'ws_project',
      userId: 'user_1',
      format: 'csv',
    });
  });

  it('creates exports with the project workspace and returns a download url', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/exports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ format: 'json' }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      artifact: { id: 'artifact_export_1' },
      downloadUrl: '/api/artifacts/artifact_export_1/download',
    });
    expect(mocks.createProjectExportArtifact).toHaveBeenCalledWith({
      projectId: 'proj_1',
      organizationId: 'org_1',
      workspaceId: 'ws_project',
      userId: 'user_1',
      format: 'json',
    });
  });

  it('maps export-service project misses to 404', async () => {
    mocks.createProjectExportArtifact.mockRejectedValueOnce(new Error('PROJECT_NOT_FOUND'));

    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/exports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ format: 'text' }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'PROJECT_NOT_FOUND',
    });
  });
});
