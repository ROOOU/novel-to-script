import { describe, expect, it } from 'vitest';
import {
  evaluateEnvPreflight,
  formatPreflightReport,
  resolvePreflightMode,
} from '../../../scripts/preflight-env.mjs';

describe('preflight env', () => {
  it('defaults to auto mode outside production deploys', () => {
    expect(resolvePreflightMode(['node', 'scripts/preflight-env.mjs'], {} as NodeJS.ProcessEnv)).toBe('auto');
  });

  it('enforces production mode when requested explicitly', () => {
    expect(
      resolvePreflightMode(['node', 'scripts/preflight-env.mjs', '--mode=production'], {} as NodeJS.ProcessEnv)
    ).toBe('production');
  });

  it('reports missing production rollout keys', () => {
    const result = evaluateEnvPreflight({} as NodeJS.ProcessEnv, 'production');

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'Missing required production env: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
        'Missing required production env: DATABASE_URL',
        'PAYPAL_MODE must be set to live in production',
      ])
    );
  });

  it('accepts a complete production configuration', () => {
    const result = evaluateEnvPreflight(
      {
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_live_123',
        CLERK_SECRET_KEY: 'sk_live_456',
        NEXT_PUBLIC_APP_URL: 'https://app.012294.xyz',
        DATABASE_URL: 'postgres://user:pass@example.com:5432/db',
        PAYPAL_CLIENT_ID: 'paypal-client',
        PAYPAL_CLIENT_SECRET: 'paypal-secret',
        PAYPAL_WEBHOOK_ID: 'wh_123',
        PAYPAL_PLAN_ID_CREATOR: 'P-creator',
        PAYPAL_PLAN_ID_PRO: 'P-pro',
        PAYPAL_MODE: 'live',
      } as unknown as NodeJS.ProcessEnv,
      'production'
    );

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(formatPreflightReport(result)).toContain('ok: environment preflight passed');
  });

  it('skips strict enforcement in auto mode', () => {
    const result = evaluateEnvPreflight({} as NodeJS.ProcessEnv, 'auto');

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('skipping strict deploy env enforcement'),
      ])
    );
  });
});
