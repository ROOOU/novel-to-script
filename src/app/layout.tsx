import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NovelScript',
  description: 'NovelScript SaaS workspace for short-drama adaptation, billing, and storyboard generation.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
      </body>
    </html>
  );
}
