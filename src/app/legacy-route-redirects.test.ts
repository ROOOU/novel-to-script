import { describe, expect, it } from 'vitest';
import {
  resolveLegacyConsoleRedirect,
  resolveLegacyStoryboardRedirect,
} from '@/app/legacy-route-redirects';

describe('legacy-route-redirects', () => {
  it('redirects root console traffic to the localized projects page', () => {
    expect(
      resolveLegacyConsoleRedirect({
        acceptLanguage: 'en-US,en;q=0.9',
      })
    ).toBe('/en-US/projects');

    expect(
      resolveLegacyConsoleRedirect({
        acceptLanguage: 'zh-CN,zh;q=0.9',
      })
    ).toBe('/zh-CN/projects');
  });

  it('keeps signed-in users on the projects hub for legacy storyboard routes', () => {
    expect(
      resolveLegacyStoryboardRedirect({
        viewerLocale: 'en-US',
        acceptLanguage: 'zh-CN,zh;q=0.9',
      })
    ).toBe('/en-US/projects');
  });

  it('sends signed-out storyboard traffic back to the localized landing page', () => {
    expect(
      resolveLegacyStoryboardRedirect({
        acceptLanguage: 'en-US,en;q=0.9',
      })
    ).toBe('/en-US');

    expect(
      resolveLegacyStoryboardRedirect({
        acceptLanguage: null,
      })
    ).toBe('/zh-CN');
  });
});
