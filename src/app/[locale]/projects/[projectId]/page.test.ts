import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
  getCurrentViewer: vi.fn(),
  getDictionary: vi.fn(),
  getProjectBundle: vi.fn(),
  ProjectWorkspaceClient: vi.fn(({ locale }: { locale: string }) => ({
    type: 'mock-project-workspace-client',
    props: { locale },
  })),
}));

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mocks.redirect(...args);
    throw new Error('NEXT_REDIRECT');
  },
  notFound: (...args: unknown[]) => mocks.notFound(...args),
}));

vi.mock('@/server/auth/service', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

vi.mock('@/server/projects/service', () => ({
  getProjectBundle: (...args: unknown[]) => mocks.getProjectBundle(...args),
}));

vi.mock('@/i18n/get-dictionary', () => ({
  getDictionary: (...args: unknown[]) => mocks.getDictionary(...args),
}));

vi.mock('@/features/saas/ProjectWorkspaceClient', () => ({
  ProjectWorkspaceClient: (props: { locale: string }) => mocks.ProjectWorkspaceClient(props),
}));

describe('project detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated viewers to the localized login wrapper with the project path preserved', async () => {
    mocks.getCurrentViewer.mockResolvedValue(null);

    const ProjectDetailPage = (await import('@/app/[locale]/projects/[projectId]/page')).default;
    await expect(
      ProjectDetailPage({
        params: Promise.resolve({ locale: 'zh-CN', projectId: 'project_123' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mocks.redirect).toHaveBeenCalledWith(
      '/zh-CN/login?redirect_url=%2Fzh-CN%2Fprojects%2Fproject_123'
    );
    expect(mocks.getDictionary).not.toHaveBeenCalled();
    expect(mocks.getProjectBundle).not.toHaveBeenCalled();
  });

  it('keeps authenticated project viewers on the project detail page', async () => {
    mocks.getCurrentViewer.mockResolvedValue({
      organization: { id: 'org_1' },
    });
    mocks.getDictionary.mockResolvedValue({
      projectDetail: {},
      common: { backToProjects: 'Back' },
    });
    mocks.getProjectBundle.mockResolvedValue({
      project: { organizationId: 'org_1', name: 'Project A' },
      sourceDocuments: [],
      jobs: [],
      artifacts: [],
      artifactRelations: [],
    });

    const ProjectDetailPage = (await import('@/app/[locale]/projects/[projectId]/page')).default;
    const page = await ProjectDetailPage({
      params: Promise.resolve({ locale: 'en-US', projectId: 'project_123' }),
    });

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(page).toMatchObject({
      props: { locale: 'en-US' },
    });
  });
});
