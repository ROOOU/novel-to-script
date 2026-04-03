import { redirect } from 'next/navigation';
import { resolveViewerSafely } from '@/server/auth/http';

export default async function StoryboardPage() {
  const viewer = await resolveViewerSafely();
  if (viewer) {
    redirect(`/${viewer.session.locale}/projects`);
  }

  redirect('/zh-CN');
}
