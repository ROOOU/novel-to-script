'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: '📖 小说转剧本', icon: '📖' },
  { href: '/storyboard', label: '🎥 分镜提示词', icon: '🎥' },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="header-nav">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`nav-link ${pathname === item.href ? 'active' : ''}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
