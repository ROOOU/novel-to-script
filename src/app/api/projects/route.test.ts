import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentViewer: vi.fn(),
  getPlatformRuntime: vi.fn(),
  createProject: vi.fn(),
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

vi.mock('@/server/shared/platform', async () => {
  const actual = await vi.importActual<typeof import('@/server/shared/platform')>(
    '@/server/shared/platform'
  );

  return {
    ...actual,
    getPlatformRuntime: () => mocks.getPlatformRuntime(),
  };
});

vi.mock('@/server/projects/service', () => ({
  createProject: (...args: unknown[]) => mocks.createProject(...args),
}));

describe('projects api route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentViewer.mockResolvedValue({
      user: { id: 'user_1', email: 'creator@example.com' },
      organization: { id: 'org_1' },
      workspace: { id: 'ws_1' },
      session: { locale: 'zh-CN' },
      subscription: null,
      creditAccount: null,
    });
    mocks.getPlatformRuntime.mockReturnValue({
      projects: {
        listByWorkspaceId: vi.fn().mockResolvedValue([{ id: 'project_1', name: 'Demo Project' }]),
      },
    });
    mocks.createProject.mockResolvedValue({
      id: 'project_2',
      name: 'New Project',
    });
  });

  it('returns platform headers for project listing', async () => {
    const { GET } = await import('@/app/api/projects/route');
    const response = (await GET(
      new NextRequest('https://app.test/api/projects', {
        headers: {
          'x-plan': 'creator',
        },
      })
    )) as Response;

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    expect(response.headers.get('x-platform-plan')).toBe('creator');
    expect(response.headers.get('x-organization-id')).toBe('org_1');
    expect(response.headers.get('x-workspace-id')).toBe('ws_1');
    await expect(response.json()).resolves.toEqual({
      ok: true,
      projects: [{ id: 'project_1', name: 'Demo Project' }],
    });
  });

  it('returns platform headers for project creation', async () => {
    const { POST } = await import('@/app/api/projects/route');
    const response = (await POST(
      new NextRequest('https://app.test/api/projects', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-plan': 'creator',
        },
        body: JSON.stringify({
          name: 'New Project',
          description: 'A short description',
          genre: 'drama',
        }),
      })
    )) as Response;

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    expect(response.headers.get('x-platform-plan')).toBe('creator');
    expect(response.headers.get('x-organization-id')).toBe('org_1');
    expect(response.headers.get('x-workspace-id')).toBe('ws_1');
    await expect(response.json()).resolves.toEqual({
      ok: true,
      project: {
        id: 'project_2',
        name: 'New Project',
      },
    });
  });
});
