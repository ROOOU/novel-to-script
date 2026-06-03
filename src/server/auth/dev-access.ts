import type { SupportedLocale } from '@/server/shared/platform/domain';

interface DevAccessEnv {
  NODE_ENV?: string;
  NOVELSCRIPT_ENABLE_DEV_AUTH?: string;
  NOVELSCRIPT_DEV_AUTH_EMAIL?: string;
  NOVELSCRIPT_DEV_AUTH_DISPLAY_NAME?: string;
}

export function isDevAccessEnabled(env: DevAccessEnv = process.env) {
  return env.NODE_ENV !== 'production' && isTruthy(env.NOVELSCRIPT_ENABLE_DEV_AUTH);
}

export function getDevAccessProfile(
  locale: SupportedLocale,
  env: DevAccessEnv = process.env
) {
  return {
    email: env.NOVELSCRIPT_DEV_AUTH_EMAIL?.trim() || 'dev-local@example.com',
    displayName:
      env.NOVELSCRIPT_DEV_AUTH_DISPLAY_NAME?.trim() ||
      (locale === 'en-US' ? 'Local Dev' : '本地开发'),
  };
}

function isTruthy(value: string | undefined) {
  if (!value) {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}
