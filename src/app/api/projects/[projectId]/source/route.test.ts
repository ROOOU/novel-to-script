import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireViewerResponse: vi.fn(),
  getPlatformRuntime: vi.fn(),
  saveProjectSource: vi.fn(),
  isSupportedTextFile: vi.fn(),
  readTextFile: vi.fn(),
}));

vi.mock('@/server/auth/http', () => ({
  requireViewerResponse: () => mocks.requireViewerResponse(),
}));

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: () => mocks.getPlatformRuntime(),
}));

vi.mock('@/server/projects/service', () => ({
  saveProjectSource: (...args: unknown[]) => mocks.saveProjectSource(...args),
}));

vi.mock('@/lib/file-text', async () => {
  const actual = await vi.importActual<typeof import('@/lib/file-text')>('@/lib/file-text');
  return {
    ...actual,
    isSupportedTextFile: (...args: Parameters<typeof actual.isSupportedTextFile>) =>
      mocks.isSupportedTextFile(...args),
    readTextFile: (...args: Parameters<typeof actual.readTextFile>) =>
      mocks.readTextFile(...args),
  };
});

import { POST } from '@/app/api/projects/[projectId]/source/route';

describe('project source route', () => {
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
    mocks.getPlatformRuntime.mockReturnValue({
      projects: {
        getById: vi.fn().mockResolvedValue({
          id: 'proj_1',
          organizationId: 'org_1',
          workspaceId: 'ws_1',
        }),
      },
    });
    mocks.saveProjectSource.mockResolvedValue({
      id: 'source_1',
      title: 'Novel Source',
      textContent: '正文',
    });
    mocks.isSupportedTextFile.mockReturnValue(true);
    mocks.readTextFile.mockResolvedValue('提取后的正文');
  });

  it('rejects blank titles before source persistence', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/source', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          title: '   ',
          textContent: '正文',
        }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
    });
    expect(mocks.saveProjectSource).not.toHaveBeenCalled();
  });

  it('rejects blank source bodies before source persistence', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/source', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Novel Source',
          textContent: '   ',
        }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
    });
    expect(mocks.saveProjectSource).not.toHaveBeenCalled();
  });

  it('returns 404 when the project is outside the viewer workspace', async () => {
    const runtime = mocks.getPlatformRuntime();
    runtime.projects.getById.mockResolvedValueOnce({
      id: 'proj_1',
      organizationId: 'org_1',
      workspaceId: 'ws_other',
    });

    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/source', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Novel Source',
          textContent: '正文',
        }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'PROJECT_NOT_FOUND',
    });
    expect(mocks.saveProjectSource).not.toHaveBeenCalled();
  });

  it('persists a valid source document', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/source', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Novel Source',
          textContent: '正文',
        }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.saveProjectSource).toHaveBeenCalledWith({
      projectId: 'proj_1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      userId: 'user_1',
      title: 'Novel Source',
      textContent: '正文',
    });
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      sourceDocument: {
        id: 'source_1',
      },
    });
  });

  it('persists extracted text from multipart file uploads', async () => {
    const formData = new FormData();
    formData.append('title', '  Uploaded Source  ');
    formData.append(
      'file',
      new File(['ignored'], 'uploaded-source.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
    );

    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/source', {
        method: 'POST',
        body: formData,
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.isSupportedTextFile).toHaveBeenCalled();
    expect(mocks.readTextFile).toHaveBeenCalled();
    expect(mocks.saveProjectSource).toHaveBeenCalledWith({
      projectId: 'proj_1',
      organizationId: 'org_1',
      workspaceId: 'ws_1',
      userId: 'user_1',
      title: 'Uploaded Source',
      textContent: '提取后的正文',
    });
  });

  it('derives the title from the uploaded filename when form title is absent', async () => {
    const formData = new FormData();
    formData.append(
      'file',
      new File(['plain text'], 'uploaded-source.txt', {
        type: 'text/plain',
      })
    );

    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/source', {
        method: 'POST',
        body: formData,
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.saveProjectSource).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'uploaded-source',
      })
    );
  });

  it('rejects unsupported multipart source files', async () => {
    mocks.isSupportedTextFile.mockReturnValue(false);
    const formData = new FormData();
    formData.append(
      'file',
      new File(['%PDF'], 'uploaded-source.pdf', {
        type: 'application/pdf',
      })
    );

    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/source', {
        method: 'POST',
        body: formData,
      }),
      { params: Promise.resolve({ projectId: 'proj_1' }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'UNSUPPORTED_SOURCE_FILE',
    });
    expect(mocks.saveProjectSource).not.toHaveBeenCalled();
  });
});
