import { pathToFileURL } from 'node:url';

const REQUIRED_PRODUCTION_KEYS = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_APP_URL',
  'DATABASE_URL',
  'PAYPAL_CLIENT_ID',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_WEBHOOK_ID',
  'PAYPAL_PLAN_ID_CREATOR',
  'PAYPAL_PLAN_ID_PRO',
];

function readTrimmed(env, key) {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function resolvePreflightMode(argv = process.argv, env = process.env) {
  const modeArg = argv.find((arg) => arg.startsWith('--mode='))?.slice('--mode='.length);
  if (modeArg === 'production' || modeArg === 'auto') {
    return modeArg;
  }

  return env.VERCEL_ENV === 'production' || env.STRICT_ENV_PREFLIGHT === '1'
    ? 'production'
    : 'auto';
}

export function evaluateEnvPreflight(env = process.env, mode = resolvePreflightMode(undefined, env)) {
  if (mode !== 'production') {
    return {
      ok: true,
      mode,
      errors: [],
      warnings: [
        'Non-production preflight mode: skipping strict deploy env enforcement. Use --mode=production to enforce rollout keys.',
      ],
    };
  }

  const errors = [];

  for (const key of REQUIRED_PRODUCTION_KEYS) {
    if (!readTrimmed(env, key)) {
      errors.push(`Missing required production env: ${key}`);
    }
  }

  const publishableKey = readTrimmed(env, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
  if (publishableKey && !publishableKey.startsWith('pk_live_')) {
    errors.push('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY must use a production Clerk publishable key (pk_live_...)');
  }

  const secretKey = readTrimmed(env, 'CLERK_SECRET_KEY');
  if (secretKey && !secretKey.startsWith('sk_live_')) {
    errors.push('CLERK_SECRET_KEY must use a production Clerk secret key (sk_live_...)');
  }

  const appUrl = readTrimmed(env, 'NEXT_PUBLIC_APP_URL');
  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        errors.push('NEXT_PUBLIC_APP_URL must not point to localhost in production');
      }
    } catch {
      errors.push('NEXT_PUBLIC_APP_URL must be a valid absolute URL');
    }
  }

  const databaseUrl = readTrimmed(env, 'DATABASE_URL');
  if (databaseUrl && !databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://')) {
    errors.push('DATABASE_URL must be a postgres connection string');
  }

  const payPalMode = readTrimmed(env, 'PAYPAL_MODE').toLowerCase();
  if (payPalMode !== 'live') {
    errors.push('PAYPAL_MODE must be set to live in production');
  }

  return {
    ok: errors.length === 0,
    mode,
    errors,
    warnings: [],
  };
}

export function formatPreflightReport(result) {
  const lines = [`[env-preflight] mode=${result.mode}`];

  for (const warning of result.warnings) {
    lines.push(`warning: ${warning}`);
  }

  for (const error of result.errors) {
    lines.push(`error: ${error}`);
  }

  if (result.ok) {
    lines.push('ok: environment preflight passed');
  }

  return lines.join('\n');
}

export function runPreflight(argv = process.argv, env = process.env) {
  const mode = resolvePreflightMode(argv, env);
  const result = evaluateEnvPreflight(env, mode);
  const report = formatPreflightReport(result);

  if (result.ok) {
    console.info(report);
    return 0;
  }

  console.error(report);
  return 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (invokedPath && import.meta.url === invokedPath) {
  process.exitCode = runPreflight();
}
