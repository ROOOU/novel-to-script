import { redirect } from 'next/navigation';
import { ProjectListClient } from '@/features/saas/ProjectListClient';
import { getDictionary } from '@/i18n/get-dictionary';
import { getCurrentViewer } from '@/server/auth/service';
import { getPlatformRuntime } from '@/server/shared/platform';

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const viewer = await getCurrentViewer();
  if (!viewer) {
    redirect(`/${locale}/login`);
  }

  const [dictionary, projects] = await Promise.all([
    getDictionary(locale),
    getPlatformRuntime().projects.listByWorkspaceId(viewer.workspace.id),
  ]);

  return (
    <ProjectListClient
      locale={locale === 'en-US' ? 'en-US' : 'zh-CN'}
      projects={projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))}
      labels={dictionary.projectsPage}
    />
  );
}
