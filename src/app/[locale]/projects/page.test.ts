import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  getCurrentViewer: vi.fn(),
  getDictionary: vi.fn(),
  listByWorkspaceId: vi.fn(),
  ProjectListClient: vi.fn(({ locale }: { locale: string }) => ({
    type: 'mock-project-list-client',
    props: { locale },
  })),
}));

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mocks.redirect(...args);
    throw new Error('NEXT_REDIRECT');
  },
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: () => ({
    projects: {
      listByWorkspaceId: (...args: unknown[]) => mocks.listByWorkspaceId(...args),
    },
  }),
}));

vi.mock('@/i18n/get-dictionary', () => ({
  getDictionary: (...args: unknown[]) => mocks.getDictionary(...args),
}));

vi.mock('@/features/saas/ProjectListClient', () => ({
  ProjectListClient: (props: { locale: string }) => mocks.ProjectListClient(props),
}));

describe('projects page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated viewers to the localized login wrapper with the projects path preserved', async () => {
    mocks.getCurrentViewer.mockResolvedValue(null);

    const ProjectsPage = (await import('@/app/[locale]/projects/page')).default;
    await expect(
      ProjectsPage({
        params: Promise.resolve({ locale: 'en-US' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mocks.redirect).toHaveBeenCalledWith('/en-US/login?redirect_url=%2Fen-US%2Fprojects');
    expect(mocks.getDictionary).not.toHaveBeenCalled();
    expect(mocks.listByWorkspaceId).not.toHaveBeenCalled();
  });

  it('keeps authenticated project viewers on the projects page', async () => {
    mocks.getCurrentViewer.mockResolvedValue({
      workspace: { id: 'workspace_1' },
    });
    mocks.getDictionary.mockResolvedValue({ projectsPage: {} });
    mocks.listByWorkspaceId.mockResolvedValue([]);

    const ProjectsPage = (await import('@/app/[locale]/projects/page')).default;
    const page = await ProjectsPage({
      params: Promise.resolve({ locale: 'zh-CN' }),
    });

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(page).toMatchObject({
      props: { locale: 'zh-CN' },
    });
  });
});
