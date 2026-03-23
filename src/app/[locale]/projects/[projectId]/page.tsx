import { notFound, redirect } from 'next/navigation';
import { ProjectWorkspaceClient } from '@/features/saas/ProjectWorkspaceClient';
import { getDictionary } from '@/i18n/get-dictionary';
import { getCurrentViewer } from '@/server/auth/service';
import { getProjectBundle } from '@/server/projects/service';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  const viewer = await getCurrentViewer();
  if (!viewer) {
    redirect(`/${locale}/login`);
  }

  const [dictionary, bundle] = await Promise.all([
    getDictionary(locale),
    getProjectBundle(projectId),
  ]);

  if (!bundle || bundle.project.organizationId !== viewer.organization.id) {
    notFound();
  }

  const sourceDocument = bundle.sourceDocuments[0];

  return (
    <ProjectWorkspaceClient
      locale={locale === 'en-US' ? 'en-US' : 'zh-CN'}
      project={bundle.project}
      initialSourceTitle={sourceDocument?.title ?? `${bundle.project.name} Source`}
      initialSourceText={sourceDocument?.textContent ?? ''}
      jobs={bundle.jobs}
      artifacts={bundle.artifacts}
      artifactRelations={bundle.artifactRelations}
      labels={{
        ...dictionary.projectDetail,
        backToProjects: dictionary.common.backToProjects,
      }}
    />
  );
}
