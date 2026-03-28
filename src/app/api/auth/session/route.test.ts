import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentViewer: vi.fn(),
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

describe('auth session route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the current viewer for an authenticated request', async () => {
    mocks.getCurrentViewer.mockResolvedValue({
      user: { id: 'user_1', email: 'creator@example.com' },
      organization: { id: 'org_1' },
      workspace: { id: 'ws_1' },
      subscription: null,
      creditAccount: null,
    });

    const { GET } = await import('@/app/api/auth/session/route');
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      viewer: {
        user: { id: 'user_1', email: 'creator@example.com' },
        organization: { id: 'org_1' },
        workspace: { id: 'ws_1' },
        subscription: null,
        creditAccount: null,
      },
    });
  });

  it('returns 401 when there is no authenticated viewer', async () => {
    mocks.getCurrentViewer.mockResolvedValueOnce(null);

    const { GET } = await import('@/app/api/auth/session/route');
    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'UNAUTHORIZED',
    });
  });
});
