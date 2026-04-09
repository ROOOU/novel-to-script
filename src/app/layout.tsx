import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Fraunces, Manrope, Space_Mono } from 'next/font/google';
import './globals.css';

const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const mono = Space_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: 'NovelScript',
  description: 'NovelScript project platform for short-drama adaptation, billing, and storyboard generation.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`${sans.variable} ${display.variable} ${mono.variable}`}>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
