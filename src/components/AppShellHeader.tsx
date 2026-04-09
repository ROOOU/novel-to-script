'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { NavLinks } from '@/app/nav-links';
import { MobileNav } from '@/components/MobileNav';
import { buildLocalizedPath, SUPPORTED_LOCALES } from '@/i18n/config';
import type { SupportedLocale } from '@/server/shared/platform/domain';

export interface AppShellHeaderLabels {
  brandBadge: string;
  signIn: string;
  signUp: string;
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
  userDisplayName?: string | null;
  initialCredits?: number | null;
}

export function AppShellHeader({
  locale,
  labels,
  signedIn,
  userDisplayName,
  initialCredits,
}: AppShellHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [availableCredits, setAvailableCredits] = useState<number | null>(initialCredits ?? null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const userInitials = getInitials(userDisplayName);

  useEffect(() => {
    if (!signedIn || initialCredits != null) {
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
  }, [initialCredits, signedIn]);

  async function handleSignOut() {
    await fetch('/api/auth/session', { method: 'DELETE' });
    router.push(`/${locale}`);
    router.refresh();
  }

  return (
    <header className="app-header">
      <div className="header-inner">
        <Link href={signedIn ? `/${locale}/projects` : `/${locale}`} className="logo logo-link">
          <div className="logo-lockup">
            <div className="logo-icon">NS</div>
            <div className="logo-copy">
              <span className="logo-text">NovelScript</span>
              <span className="logo-badge">{labels.brandBadge}</span>
            </div>
          </div>
        </Link>

        <NavLinks
          locale={locale}
          labels={{ projects: labels.projects, pricing: labels.pricing }}
          className="header-nav header-nav-desktop"
        />

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
                <span className="account-summary-label">{locale === 'en-US' ? 'Credits' : '积分'}</span>
                <strong>{isLoadingSummary ? '...' : (availableCredits ?? 0).toLocaleString(locale)}</strong>
              </div>
              <div className="account-identity" aria-label="Signed in user">
                <span className="account-avatar" aria-hidden="true">
                  {userInitials}
                </span>
                <span className="account-summary-copy">
                  <strong>{userDisplayName || 'NovelScript'}</strong>
                  <span>{locale === 'en-US' ? 'Creator account' : '创作者账号'}</span>
                </span>
              </div>
              <button type="button" className="secondary-button ghost-button" onClick={handleSignOut}>
                {labels.signOut}
              </button>
            </div>
          ) : (
            <div className="header-auth-actions">
              <Link href={`/${locale}/login`} className="secondary-button ghost-button">
                {labels.signIn}
              </Link>
              <Link href={`/${locale}/login`} className="primary-button">
                {labels.signUp}
              </Link>
            </div>
          )}
          <MobileNav
            locale={locale}
            pathname={pathname || '/'}
            navLabels={{ projects: labels.projects, pricing: labels.pricing }}
            authLabels={{
              signIn: labels.signIn,
              signUp: labels.signUp,
              signOut: labels.signOut,
              credits: locale === 'en-US' ? 'credits' : '积分',
            }}
            signedIn={signedIn}
            userDisplayName={userDisplayName}
            userInitials={userInitials}
            availableCredits={availableCredits}
            onSignOut={handleSignOut}
          />
        </div>
      </div>
    </header>
  );
}

function getInitials(displayName?: string | null) {
  const normalized = displayName?.trim();
  if (!normalized) {
    return 'NS';
  }

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}
