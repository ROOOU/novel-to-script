'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/projects', label: 'Projects' },
  { href: '/pricing', label: 'Pricing' },
];

export function NavLinks() {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);

  return (
    <nav className="header-nav">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={`/${locale}${item.href}`}
          className={`nav-link ${isActivePath(pathname, item.href, locale) ? 'active' : ''}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function getLocaleFromPathname(pathname: string): 'zh-CN' | 'en-US' {
  return pathname.startsWith('/en-US') ? 'en-US' : 'zh-CN';
}

function isActivePath(pathname: string, itemPath: string, locale: 'zh-CN' | 'en-US'): boolean {
  const targetPath = `/${locale}${itemPath}`;
  return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
}
