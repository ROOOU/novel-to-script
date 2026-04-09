import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function normalizeValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseEnvFile(content) {
  const result = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const hashIndex = value.indexOf(' #');
      if (hashIndex >= 0) {
        value = value.slice(0, hashIndex).trim();
      }
    }

    result[key] = value;
  }

  return result;
}

function createCheck(id, label, status, detail) {
  return { id, label, status, detail };
}

function isLoopbackHost(hostname) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '0.0.0.0' ||
    normalized === '::1' ||
    normalized.endsWith('.local')
  );
}

function collectEnvSources(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const envPath = path.join(cwd, '.env.local');
  const envFileExists = options.envFileExists ?? existsSync(envPath);
  const envFileContents =
    options.envFileContents ?? (envFileExists ? readFileSync(envPath, 'utf8') : null);
  const fileEnv = envFileContents ? parseEnvFile(envFileContents) : {};
  const processEnv = options.env ?? process.env;

  return {
    cwd,
    envPath,
    envFileExists,
    fileEnv,
    effectiveEnv: {
      ...fileEnv,
      ...processEnv,
    },
  };
}

export function evaluatePayPalSandboxReadiness(options = {}) {
  const { cwd, envPath, envFileExists, effectiveEnv } = collectEnvSources(options);
  const clientId = normalizeValue(effectiveEnv.PAYPAL_CLIENT_ID);
  const clientSecret = normalizeValue(effectiveEnv.PAYPAL_CLIENT_SECRET);
  const mode = normalizeValue(effectiveEnv.PAYPAL_MODE);
  const webhookId = normalizeValue(effectiveEnv.PAYPAL_WEBHOOK_ID);
  const appUrl = normalizeValue(effectiveEnv.NEXT_PUBLIC_APP_URL);
  const creatorPlanId = normalizeValue(effectiveEnv.PAYPAL_PLAN_ID_CREATOR);
  const proPlanId = normalizeValue(effectiveEnv.PAYPAL_PLAN_ID_PRO);
  const fallbackPlanId = normalizeValue(effectiveEnv.PAYPAL_PLAN_ID);

  const checks = [];

  checks.push(
    envFileExists
      ? createCheck('env-file', '.env.local', 'pass', `Loaded ${envPath}`)
      : createCheck(
          'env-file',
          '.env.local',
          'warn',
          'Missing .env.local. You can still rely on shell env, but local sandbox setup is easier to reproduce with a file.'
        )
  );

  checks.push(
    clientId
      ? createCheck('client-id', 'PAYPAL_CLIENT_ID', 'pass', 'Client ID is configured.')
      : createCheck('client-id', 'PAYPAL_CLIENT_ID', 'fail', 'Missing PayPal client ID.')
  );
  checks.push(
    clientSecret
      ? createCheck('client-secret', 'PAYPAL_CLIENT_SECRET', 'pass', 'Client secret is configured.')
      : createCheck('client-secret', 'PAYPAL_CLIENT_SECRET', 'fail', 'Missing PayPal client secret.')
  );

  if (mode === 'sandbox') {
    checks.push(createCheck('mode', 'PAYPAL_MODE', 'pass', 'Sandbox mode is enabled.'));
  } else if (!mode) {
    checks.push(createCheck('mode', 'PAYPAL_MODE', 'fail', 'Missing PAYPAL_MODE=sandbox.'));
  } else {
    checks.push(createCheck('mode', 'PAYPAL_MODE', 'fail', `Expected sandbox, received ${mode}.`));
  }

  checks.push(
    webhookId
      ? createCheck('webhook-id', 'PAYPAL_WEBHOOK_ID', 'pass', 'Webhook ID is configured.')
      : createCheck('webhook-id', 'PAYPAL_WEBHOOK_ID', 'fail', 'Missing webhook ID for signature verification.')
  );

  if (!appUrl) {
    checks.push(
      createCheck(
        'app-url',
        'NEXT_PUBLIC_APP_URL',
        'fail',
        'Missing public app URL. Real sandbox return URLs and webhooks need an externally reachable HTTPS origin.'
      )
    );
  } else {
    let parsedUrl = null;
    try {
      parsedUrl = new URL(appUrl);
    } catch {
      checks.push(createCheck('app-url', 'NEXT_PUBLIC_APP_URL', 'fail', `Invalid URL: ${appUrl}`));
    }

    if (parsedUrl) {
      if (parsedUrl.protocol !== 'https:') {
        checks.push(
          createCheck(
            'app-url-protocol',
            'NEXT_PUBLIC_APP_URL protocol',
            'fail',
            `Expected https:// for real sandbox callbacks, received ${parsedUrl.protocol}//`
          )
        );
      } else {
        checks.push(
          createCheck('app-url-protocol', 'NEXT_PUBLIC_APP_URL protocol', 'pass', 'HTTPS origin is configured.')
        );
      }

      if (isLoopbackHost(parsedUrl.hostname)) {
        checks.push(
          createCheck(
            'app-url-host',
            'NEXT_PUBLIC_APP_URL host',
            'fail',
            `Host ${parsedUrl.hostname} is local-only. Use a public HTTPS tunnel or deployed preview URL.`
          )
        );
      } else {
        checks.push(
          createCheck('app-url-host', 'NEXT_PUBLIC_APP_URL host', 'pass', `Public host ${parsedUrl.hostname} looks usable.`)
        );
      }
    }
  }

  if (creatorPlanId) {
    checks.push(createCheck('creator-plan', 'PAYPAL_PLAN_ID_CREATOR', 'pass', 'Creator plan ID is configured.'));
  } else if (fallbackPlanId) {
    checks.push(
      createCheck(
        'creator-plan',
        'PAYPAL_PLAN_ID_CREATOR',
        'fail',
        'Missing Creator plan ID. PAYPAL_PLAN_ID fallback exists, but Phase 5 sandbox validation should use explicit plan IDs.'
      )
    );
  } else {
    checks.push(createCheck('creator-plan', 'PAYPAL_PLAN_ID_CREATOR', 'fail', 'Missing Creator plan ID.'));
  }

  if (proPlanId) {
    checks.push(createCheck('pro-plan', 'PAYPAL_PLAN_ID_PRO', 'pass', 'Pro plan ID is configured.'));
  } else if (fallbackPlanId) {
    checks.push(
      createCheck(
        'pro-plan',
        'PAYPAL_PLAN_ID_PRO',
        'fail',
        'Missing Pro plan ID. PAYPAL_PLAN_ID fallback exists, but Phase 5 sandbox validation should use explicit plan IDs.'
      )
    );
  } else {
    checks.push(createCheck('pro-plan', 'PAYPAL_PLAN_ID_PRO', 'fail', 'Missing Pro plan ID.'));
  }

  const failed = checks.filter((check) => check.status === 'fail');
  const warned = checks.filter((check) => check.status === 'warn');
  const offlineReady = ['client-id', 'client-secret', 'mode', 'webhook-id'].every((id) =>
    checks.some((check) => check.id === id && check.status === 'pass')
  );
  const sandboxReady =
    failed.length === 0 &&
    ['client-id', 'client-secret', 'mode', 'webhook-id', 'app-url-protocol', 'app-url-host', 'creator-plan', 'pro-plan'].every(
      (id) => checks.some((check) => check.id === id && check.status === 'pass')
    );

  const nextActions = [];

  if (!clientId || !clientSecret) {
    nextActions.push('Configure PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET from your Sandbox App.');
  }
  if (mode !== 'sandbox') {
    nextActions.push('Set PAYPAL_MODE=sandbox before running real sandbox checkout.');
  }
  if (!webhookId) {
    nextActions.push('Create a Sandbox webhook and copy its PAYPAL_WEBHOOK_ID into .env.local.');
  }
  if (!appUrl) {
    nextActions.push('Set NEXT_PUBLIC_APP_URL to your public HTTPS tunnel or preview domain.');
  } else {
    try {
      const parsedUrl = new URL(appUrl);
      if (parsedUrl.protocol !== 'https:' || isLoopbackHost(parsedUrl.hostname)) {
        nextActions.push('Replace NEXT_PUBLIC_APP_URL with a public HTTPS tunnel or deployed preview URL.');
      }
    } catch {
      nextActions.push('Fix NEXT_PUBLIC_APP_URL so it is a valid HTTPS URL.');
    }
  }
  if (!creatorPlanId || !proPlanId) {
    nextActions.push('Create Sandbox subscription plans and set PAYPAL_PLAN_ID_CREATOR and PAYPAL_PLAN_ID_PRO.');
  }
  nextActions.push('Run npm run test, npm run typecheck, and npm run test:smoke:paypal before the real sandbox session.');

  return {
    cwd,
    envPath,
    envFileExists,
    checks,
    summary: {
      failed: failed.length,
      warned: warned.length,
      offlineReady,
      sandboxReady,
    },
    nextActions: [...new Set(nextActions)],
  };
}

export function formatPayPalSandboxReadinessReport(result) {
  const lines = [
    'PayPal sandbox readiness',
    `- workspace: ${result.cwd}`,
    `- env file: ${result.envFileExists ? result.envPath : `${result.envPath} (missing)`}`,
    `- offline smoke prerequisites: ${result.summary.offlineReady ? 'PASS' : 'FAIL'}`,
    `- real sandbox prerequisites: ${result.summary.sandboxReady ? 'PASS' : 'FAIL'}`,
    '',
    'Checks:',
  ];

  for (const check of result.checks) {
    const label = check.status.toUpperCase().padEnd(4, ' ');
    lines.push(`- [${label}] ${check.label}: ${check.detail}`);
  }

  if (result.nextActions.length > 0) {
    lines.push('', 'Next actions:');
    result.nextActions.forEach((action, index) => {
      lines.push(`${index + 1}. ${action}`);
    });
  }

  return `${lines.join('\n')}\n`;
}

export function runPayPalSandboxReadinessCheck(options = {}) {
  const result = evaluatePayPalSandboxReadiness(options);
  const report = formatPayPalSandboxReadinessReport(result);

  if (options.stdout?.write) {
    options.stdout.write(report);
  } else {
    process.stdout.write(report);
  }

  return result.summary.sandboxReady ? 0 : 1;
}

const currentFilePath = fileURLToPath(import.meta.url);
const invokedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : null;

if (invokedFilePath && currentFilePath === invokedFilePath) {
  process.exitCode = runPayPalSandboxReadinessCheck();
}
