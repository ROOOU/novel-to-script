'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/projects', label: 'Projects' },
  { href: '/pricing', label: 'Pricing' },
];

export function MobileNav() {
  const pathname = usePathname();
  const [openedPath, setOpenedPath] = useState<string | null>(null);
  const locale = getLocaleFromPathname(pathname);
  const isOpen = openedPath === pathname;

  return (
    <div className="mobile-nav">
      <nav className="header-nav header-nav-desktop" aria-label="主导航">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={`/${locale}${item.href}`}
            className={`nav-link ${isActivePath(pathname, item.href, locale) ? 'active' : ''}`}
            onClick={() => setOpenedPath(null)}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <button
        type="button"
        className="mobile-nav-trigger"
        aria-expanded={isOpen}
        aria-controls="mobile-nav-menu"
        aria-label={isOpen ? '关闭导航菜单' : '打开导航菜单'}
        onClick={() => setOpenedPath(isOpen ? null : pathname)}
      >
        <span className="mobile-nav-trigger-icon" aria-hidden="true">
          {isOpen ? '×' : '☰'}
        </span>
      </button>

      {isOpen && (
        <div id="mobile-nav-menu" className="mobile-nav-menu" aria-label="移动端导航">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={`/${locale}${item.href}`}
              className={`nav-link mobile-nav-link ${isActivePath(pathname, item.href, locale) ? 'active' : ''}`}
              onClick={() => setOpenedPath(null)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function getLocaleFromPathname(pathname: string): 'zh-CN' | 'en-US' {
  return pathname.startsWith('/en-US') ? 'en-US' : 'zh-CN';
}

function isActivePath(pathname: string, itemPath: string, locale: 'zh-CN' | 'en-US'): boolean {
  const targetPath = `/${locale}${itemPath}`;
  return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
}
