'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/', label: '📖 小说转剧本' },
  { href: '/storyboard', label: '🎥 分镜提示词' },
];

export function MobileNav() {
  const pathname = usePathname();
  const [openedPath, setOpenedPath] = useState<string | null>(null);
  const isOpen = openedPath === pathname;

  return (
    <div className="mobile-nav">
      <nav className="header-nav header-nav-desktop" aria-label="主导航">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${pathname === item.href ? 'active' : ''}`}
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
              href={item.href}
              className={`nav-link mobile-nav-link ${pathname === item.href ? 'active' : ''}`}
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
