'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { buildLocalizedPath, SUPPORTED_LOCALES } from '@/i18n/config';
import type { SupportedLocale } from '@/server/shared/platform/domain';

export interface AppShellHeaderLabels {
  brandBadge: string;
  signIn: string;
  signOut: string;
  home: string;
  pricing: string;
  projects: string;
  billing: string;
  redeem: string;
  admin: string;
}

interface AppShellHeaderProps {
  locale: SupportedLocale;
  labels: AppShellHeaderLabels;
  signedIn: boolean;
}

export function AppShellHeader({ locale, labels, signedIn }: AppShellHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await fetch('/api/auth/session', { method: 'DELETE' });
    router.push(`/${locale}`);
    router.refresh();
  }

  const navItems = [
    { href: `/${locale}`, label: labels.home },
    { href: `/${locale}/pricing`, label: labels.pricing },
    { href: `/${locale}/projects`, label: labels.projects },
    { href: `/${locale}/billing`, label: labels.billing },
    { href: `/${locale}/redeem`, label: labels.redeem },
    { href: `/${locale}/admin`, label: labels.admin },
  ];

  return (
    <header className="app-header">
      <div className="header-inner">
        <Link href={`/${locale}`} className="logo logo-link">
          <div className="logo-icon">NS</div>
          <span className="logo-text">NovelScript</span>
          <span className="logo-badge">{labels.brandBadge}</span>
        </Link>

        <nav className="header-nav header-nav-desktop" aria-label="Main navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${pathname === item.href ? 'active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <div className="locale-switcher" aria-label="Locale switcher">
            {SUPPORTED_LOCALES.map((nextLocale) => (
              <Link
                key={nextLocale}
                href={buildLocalizedPath(nextLocale, pathname || '/')}
                className={`locale-pill ${nextLocale === locale ? 'active' : ''}`}
              >
                {nextLocale === 'zh-CN' ? '中文' : 'EN'}
              </Link>
            ))}
          </div>
          {signedIn ? (
            <button type="button" className="secondary-button ghost-button" onClick={handleSignOut}>
              {labels.signOut}
            </button>
          ) : (
            <Link href={`/${locale}/login`} className="secondary-button ghost-button">
              {labels.signIn}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
