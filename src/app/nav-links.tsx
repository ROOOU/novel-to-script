'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { SupportedLocale } from '@/server/shared/platform/domain';

interface NavLabels {
  projects: string;
  pricing: string;
}

interface NavLinksProps {
  locale: SupportedLocale;
  labels: NavLabels;
  className?: string;
  onNavigate?: () => void;
}

export interface PrimaryNavItem {
  href: string;
  label: string;
}

export function NavLinks({ locale, labels, className = 'header-nav', onNavigate }: NavLinksProps) {
  const pathname = usePathname();
  const items = getPrimaryNavItems(locale, labels);

  return (
    <nav className={className} aria-label="Main navigation">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`nav-link ${isActivePath(pathname, item.href) ? 'active' : ''}`}
          onClick={onNavigate}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function getPrimaryNavItems(locale: SupportedLocale, labels: NavLabels): PrimaryNavItem[] {
  return [
    { href: `/${locale}/projects`, label: labels.projects },
    { href: `/${locale}/pricing`, label: labels.pricing },
  ];
}

export function isActivePath(pathname: string, itemPath: string): boolean {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}
