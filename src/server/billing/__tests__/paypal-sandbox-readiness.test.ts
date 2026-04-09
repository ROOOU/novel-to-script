import { describe, expect, it } from 'vitest';
import {
  evaluatePayPalSandboxReadiness,
  formatPayPalSandboxReadinessReport,
} from '../../../../scripts/check-paypal-sandbox-readiness.mjs';

describe('paypal sandbox readiness script', () => {
  it('fails when sandbox configuration is missing', () => {
    const result = evaluatePayPalSandboxReadiness({
      cwd: '/tmp/novelscript',
      env: {},
      envFileExists: false,
      envFileContents: null,
    });

    expect(result.summary.offlineReady).toBe(false);
    expect(result.summary.sandboxReady).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'client-id', status: 'fail' }),
        expect.objectContaining({ id: 'client-secret', status: 'fail' }),
        expect.objectContaining({ id: 'mode', status: 'fail' }),
        expect.objectContaining({ id: 'webhook-id', status: 'fail' }),
      ])
    );
  });

  it('passes offline checks but fails real sandbox checks for localhost app urls', () => {
    const result = evaluatePayPalSandboxReadiness({
      cwd: '/tmp/novelscript',
      env: {
        PAYPAL_CLIENT_ID: 'client-id',
        PAYPAL_CLIENT_SECRET: 'client-secret',
        PAYPAL_MODE: 'sandbox',
        PAYPAL_WEBHOOK_ID: 'webhook-id',
        NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
        PAYPAL_PLAN_ID_CREATOR: 'plan-creator',
        PAYPAL_PLAN_ID_PRO: 'plan-pro',
      },
      envFileExists: true,
      envFileContents: '',
    });

    expect(result.summary.offlineReady).toBe(true);
    expect(result.summary.sandboxReady).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'app-url-protocol', status: 'fail' }),
        expect.objectContaining({ id: 'app-url-host', status: 'fail' }),
      ])
    );
  });

  it('passes when all sandbox requirements are present', () => {
    const result = evaluatePayPalSandboxReadiness({
      cwd: '/tmp/novelscript',
      env: {
        PAYPAL_CLIENT_ID: 'client-id',
        PAYPAL_CLIENT_SECRET: 'client-secret',
        PAYPAL_MODE: 'sandbox',
        PAYPAL_WEBHOOK_ID: 'webhook-id',
        NEXT_PUBLIC_APP_URL: 'https://novelscript.ngrok-free.app',
        PAYPAL_PLAN_ID_CREATOR: 'plan-creator',
        PAYPAL_PLAN_ID_PRO: 'plan-pro',
      },
      envFileExists: true,
      envFileContents: '',
    });

    expect(result.summary.offlineReady).toBe(true);
    expect(result.summary.sandboxReady).toBe(true);
    expect(formatPayPalSandboxReadinessReport(result)).toContain('real sandbox prerequisites: PASS');
  });

  it('requires explicit creator and pro plan ids even if a generic fallback exists', () => {
    const result = evaluatePayPalSandboxReadiness({
      cwd: '/tmp/novelscript',
      env: {
        PAYPAL_CLIENT_ID: 'client-id',
        PAYPAL_CLIENT_SECRET: 'client-secret',
        PAYPAL_MODE: 'sandbox',
        PAYPAL_WEBHOOK_ID: 'webhook-id',
        NEXT_PUBLIC_APP_URL: 'https://novelscript.ngrok-free.app',
        PAYPAL_PLAN_ID: 'plan-default',
      },
      envFileExists: true,
      envFileContents: '',
    });

    expect(result.summary.sandboxReady).toBe(false);
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'creator-plan', status: 'fail' }),
        expect.objectContaining({ id: 'pro-plan', status: 'fail' }),
      ])
    );
  });
});
