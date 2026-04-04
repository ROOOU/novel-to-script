import { describe, expect, it } from 'vitest';
import { getPrimaryNavItems, isActivePath } from '@/app/nav-links';

describe('nav-links', () => {
  it('builds the simplified primary navigation for the current locale', () => {
    expect(
      getPrimaryNavItems('zh-CN', {
        projects: '项目',
        pricing: '价格',
      })
    ).toEqual([
      { href: '/zh-CN/projects', label: '项目' },
      { href: '/zh-CN/pricing', label: '价格' },
    ]);
  });

  it('marks direct and nested routes as active', () => {
    expect(isActivePath('/en-US/projects', '/en-US/projects')).toBe(true);
    expect(isActivePath('/en-US/projects/project_1', '/en-US/projects')).toBe(true);
    expect(isActivePath('/en-US/pricing', '/en-US/projects')).toBe(false);
  });
});
