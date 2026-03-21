import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { NavLinks } from "./nav-links";

export const metadata: Metadata = {
  title: "NovelScript | 小说转短剧 & 分镜提示词",
  description: "AI 驱动的网络小说到短剧剧本转换工具，支持修仙、都市情感、奇幻题材，自动生成视频分镜提示词",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <header className="app-header">
          <div className="header-inner">
            <Link href="/" className="logo" style={{ textDecoration: 'none' }}>
              <div className="logo-icon">📜</div>
              <span className="logo-text">NovelScript</span>
              <span className="logo-badge">AI 短剧工具</span>
            </Link>
            <NavLinks />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
