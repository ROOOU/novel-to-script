import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentViewer: vi.fn(),
  getPlatformRuntime: vi.fn(),
  getProjectBundle: vi.fn(),
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
  getProjectBundle: (...args: unknown[]) => mocks.getProjectBundle(...args),
}));

describe('project api route', () => {
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
    mocks.getPlatformRuntime.mockReturnValue({});
    mocks.getProjectBundle.mockResolvedValue({
      project: {
        id: 'project_1',
        organizationId: 'org_2',
      },
    });
  });

  it('returns platform headers on not found responses', async () => {
    const { GET } = await import('@/app/api/projects/[projectId]/route');
    const response = (await GET(
      new NextRequest('https://app.test/api/projects/project_1'),
      {
        params: Promise.resolve({ projectId: 'project_1' }),
      }
    )) as Response;

    expect(response.status).toBe(404);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(response.headers.get('x-trace-id')).toBeTruthy();
    expect(response.headers.get('x-platform-plan')).toBe('free');
    expect(response.headers.get('x-organization-id')).toBe('org_1');
    expect(response.headers.get('x-workspace-id')).toBe('ws_1');
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'PROJECT_NOT_FOUND',
    });
  });
});
