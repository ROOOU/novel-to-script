import { redirect } from 'next/navigation';
import { getCurrentViewer } from '@/server/auth/service';

export default async function StoryboardPage() {
  const viewer = await getCurrentViewer();
  if (viewer) {
    redirect(`/${viewer.session.locale}/projects`);
  }

  redirect('/zh-CN');
}
