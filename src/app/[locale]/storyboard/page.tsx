import { redirect } from 'next/navigation';

export default async function StoryboardLegacyRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/projects`);
}
