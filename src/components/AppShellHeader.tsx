'use client';

import { useEffect, useState } from 'react';
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
  const [availableCredits, setAvailableCredits] = useState<number | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  useEffect(() => {
    if (!signedIn) {
      return;
    }

    const controller = new AbortController();
    let active = true;
    queueMicrotask(() => {
      if (!active) {
        return;
      }
      setIsLoadingSummary(true);
    });

    void fetch('/api/billing/summary', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('BILLING_SUMMARY_FAILED');
        }

        return response.json() as Promise<{ creditAccount?: { availableCredits?: number | null } | null }>;
      })
      .then((payload) => {
        if (!active) {
          return;
        }
        setAvailableCredits(payload.creditAccount?.availableCredits ?? 0);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setAvailableCredits(null);
      })
      .finally(() => {
        if (!active) {
          return;
        }
        setIsLoadingSummary(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [signedIn]);

  async function handleSignOut() {
    await fetch('/api/auth/session', { method: 'DELETE' });
    router.push(`/${locale}`);
    router.refresh();
  }

  const navItems = [
    { href: `/${locale}/projects`, label: labels.projects },
    { href: `/${locale}/pricing`, label: labels.pricing },
  ];

  return (
    <header className="app-header">
      <div className="header-inner">
        <Link href={signedIn ? `/${locale}/projects` : `/${locale}`} className="logo logo-link">
          <div className="logo-icon">NS</div>
          <span className="logo-text">NovelScript</span>
          <span className="logo-badge">{labels.brandBadge}</span>
        </Link>

        <nav className="header-nav header-nav-desktop" aria-label="Main navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'active' : ''}`}
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
            <div className="header-account">
              <div className="account-summary" aria-label="Account credits">
                <span className="account-avatar" aria-hidden="true">
                  NS
                </span>
                <span className="account-summary-copy">
                  <strong>{isLoadingSummary ? '...' : availableCredits ?? 0}</strong>
                  <span>{locale === 'en-US' ? 'Credits' : '额度'}</span>
                </span>
              </div>
              <button type="button" className="secondary-button ghost-button" onClick={handleSignOut}>
                {labels.signOut}
              </button>
            </div>
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
