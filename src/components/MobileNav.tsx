'use client';

import Link from 'next/link';
import { useState } from 'react';
import { buildLocalizedPath, SUPPORTED_LOCALES } from '@/i18n/config';
import { NavLinks } from '@/app/nav-links';
import type { SupportedLocale } from '@/server/shared/platform/domain';

interface MobileNavProps {
  locale: SupportedLocale;
  pathname: string;
  navLabels: {
    projects: string;
    pricing: string;
  };
  authLabels: {
    signIn: string;
    signUp: string;
    signOut: string;
    credits: string;
  };
  signedIn: boolean;
  userDisplayName?: string | null;
  userInitials: string;
  availableCredits: number | null;
  onSignOut: () => void | Promise<void>;
}

export function MobileNav({
  locale,
  pathname,
  navLabels,
  authLabels,
  signedIn,
  userDisplayName,
  userInitials,
  availableCredits,
  onSignOut,
}: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mobile-nav">
      <button
        type="button"
        className="mobile-nav-trigger"
        aria-expanded={isOpen}
        aria-controls="mobile-nav-menu"
        aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="mobile-nav-trigger-icon" aria-hidden="true">
          {isOpen ? '×' : '☰'}
        </span>
      </button>

      {isOpen ? (
        <div id="mobile-nav-menu" className="mobile-nav-menu" aria-label="Mobile navigation">
          <NavLinks
            locale={locale}
            labels={navLabels}
            className="mobile-nav-links"
            onNavigate={() => setIsOpen(false)}
          />

          <div className="mobile-nav-section">
            <span className="mobile-nav-label">{locale === 'en-US' ? 'Language' : '语言'}</span>
            <div className="locale-switcher mobile-locale-switcher" aria-label="Locale switcher">
              {SUPPORTED_LOCALES.map((nextLocale) => (
                <Link
                  key={nextLocale}
                  href={buildLocalizedPath(nextLocale, pathname || '/')}
                  className={`locale-pill ${nextLocale === locale ? 'active' : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  {nextLocale === 'zh-CN' ? '中文' : 'EN'}
                </Link>
              ))}
            </div>
          </div>

          {signedIn ? (
            <div className="mobile-nav-section">
              <div className="mobile-account-card">
                <span className="account-avatar" aria-hidden="true">
                  {userInitials}
                </span>
                <div className="mobile-account-copy">
                  <strong>{userDisplayName || 'NovelScript'}</strong>
                  <span>
                    {(availableCredits ?? 0).toLocaleString(locale)} {authLabels.credits}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="secondary-button mobile-nav-action"
                onClick={async () => {
                  setIsOpen(false);
                  await onSignOut();
                }}
              >
                {authLabels.signOut}
              </button>
            </div>
          ) : (
            <div className="mobile-nav-section mobile-nav-auth">
              <Link href={`/${locale}/login`} className="secondary-button mobile-nav-action" onClick={() => setIsOpen(false)}>
                {authLabels.signIn}
              </Link>
              <Link href={`/${locale}/login`} className="primary-button mobile-nav-action" onClick={() => setIsOpen(false)}>
                {authLabels.signUp}
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
