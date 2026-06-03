import { notFound, redirect } from 'next/navigation';
import { ProjectWorkspaceClient } from '@/features/saas/ProjectWorkspaceClient';
import { getDictionary } from '@/i18n/get-dictionary';
import { getCurrentViewer } from '@/server/auth/service';
import { viewerOwnsProject } from '@/server/auth/viewer-access';
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

  if (!bundle || !viewerOwnsProject(viewer, bundle.project)) {
    notFound();
  }

  const sourceDocument = bundle.sourceDocuments[0];
  const videoEnabled =
    process.env.NOVELSCRIPT_ENABLE_VIDEO_GENERATION === 'true' &&
    Boolean(process.env.GEMINI_API_KEY?.trim());

  return (
    <ProjectWorkspaceClient
      locale={locale === 'en-US' ? 'en-US' : 'zh-CN'}
      project={bundle.project}
      videoEnabled={videoEnabled}
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
