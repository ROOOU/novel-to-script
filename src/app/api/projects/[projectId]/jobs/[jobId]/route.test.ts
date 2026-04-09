import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireViewerResponse: vi.fn(),
  getPlatformRuntime: vi.fn(),
  retryProjectGenerationJob: vi.fn(),
  cancelProjectGenerationJob: vi.fn(),
}));

vi.mock('@/server/auth/http', () => ({
  requireViewerResponse: () => mocks.requireViewerResponse(),
}));

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: () => mocks.getPlatformRuntime(),
}));

vi.mock('@/server/projects/job-actions', () => ({
  retryProjectGenerationJob: (...args: unknown[]) => mocks.retryProjectGenerationJob(...args),
  cancelProjectGenerationJob: (...args: unknown[]) => mocks.cancelProjectGenerationJob(...args),
}));

import { POST } from '@/app/api/projects/[projectId]/jobs/[jobId]/route';

describe('project job action route', () => {
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
  });

  it('rejects invalid payloads with 400 before invoking job actions', async () => {
    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/jobs/job_1', {
        method: 'POST',
        body: JSON.stringify({ action: 'pause' }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1', jobId: 'job_1' }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: expect.any(String),
    });
    expect(mocks.retryProjectGenerationJob).not.toHaveBeenCalled();
    expect(mocks.cancelProjectGenerationJob).not.toHaveBeenCalled();
  });

  it('returns 404 when the project is not found', async () => {
    const runtime = mocks.getPlatformRuntime();
    runtime.projects.getById.mockResolvedValueOnce(null);

    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/jobs/job_1', {
        method: 'POST',
        body: JSON.stringify({ action: 'retry' }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1', jobId: 'job_1' }) }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'PROJECT_NOT_FOUND',
    });
    expect(mocks.retryProjectGenerationJob).not.toHaveBeenCalled();
    expect(mocks.cancelProjectGenerationJob).not.toHaveBeenCalled();
  });

  it('returns 404 when the retry target job is missing', async () => {
    mocks.retryProjectGenerationJob.mockRejectedValueOnce(new Error('PROJECT_JOB_NOT_FOUND'));

    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/jobs/job_1', {
        method: 'POST',
        body: JSON.stringify({ action: 'retry' }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1', jobId: 'job_1' }) }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'PROJECT_JOB_NOT_FOUND',
    });
  });

  it('returns 409 when retrying a non-retryable job', async () => {
    mocks.retryProjectGenerationJob.mockRejectedValueOnce(new Error('JOB_RETRY_NOT_ALLOWED'));

    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/jobs/job_1', {
        method: 'POST',
        body: JSON.stringify({ action: 'retry' }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1', jobId: 'job_1' }) }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'JOB_RETRY_NOT_ALLOWED',
    });
  });

  it('returns 409 when cancelling a non-cancelable job', async () => {
    mocks.cancelProjectGenerationJob.mockRejectedValueOnce(new Error('JOB_CANCEL_NOT_ALLOWED'));

    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/jobs/job_1', {
        method: 'POST',
        body: JSON.stringify({ action: 'cancel' }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1', jobId: 'job_1' }) }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'JOB_CANCEL_NOT_ALLOWED',
    });
  });

  it('routes retry actions to the retry service', async () => {
    mocks.retryProjectGenerationJob.mockResolvedValue({
      action: 'retry',
      originalJob: { id: 'job_1' },
      job: { id: 'job_2' },
    });

    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/jobs/job_1', {
        method: 'POST',
        body: JSON.stringify({ action: 'retry' }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1', jobId: 'job_1' }) }
    );

    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: true,
      action: 'retry',
      job: { id: 'job_2' },
    });
    expect(mocks.retryProjectGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        projectId: 'proj_1',
        userId: 'user_1',
        jobId: 'job_1',
      })
    );
  });

  it('routes cancel actions to the cancel service', async () => {
    mocks.cancelProjectGenerationJob.mockResolvedValue({
      action: 'cancel',
      job: { id: 'job_1', status: 'cancelled' },
    });

    const response = await POST(
      new NextRequest('https://app.test/api/projects/proj_1/jobs/job_1', {
        method: 'POST',
        body: JSON.stringify({ action: 'cancel' }),
      }),
      { params: Promise.resolve({ projectId: 'proj_1', jobId: 'job_1' }) }
    );

    const payload = await response.json();
    expect(payload).toMatchObject({
      ok: true,
      action: 'cancel',
      job: { id: 'job_1', status: 'cancelled' },
    });
    expect(mocks.cancelProjectGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        projectId: 'proj_1',
        userId: 'user_1',
        jobId: 'job_1',
      })
    );
  });

});
