import { NextResponse } from 'next/server';
import { requireViewerResponse } from '@/server/auth/http';

interface DeveloperEnv {
  NODE_ENV?: string;
  NOVELSCRIPT_ENABLE_DEV_CHANNEL?: string;
  NOVELSCRIPT_DEV_EMAILS?: string;
}

export async function requireDeveloperChannelResponse() {
  const { viewer, response } = await requireViewerResponse();
  if (!viewer || response) {
    return {
      viewer: null,
      response,
    };
  }

  if (!canAccessDeveloperChannel(viewer, process.env)) {
    return {
      viewer,
      response: NextResponse.json(
        {
          ok: false,
          error: 'DEV_CHANNEL_DISABLED',
        },
        { status: 403 }
      ),
    };
  }

  return {
    viewer,
    response: null,
  };
}

export function isDeveloperChannelEnabled(env: DeveloperEnv = process.env) {
  return env.NODE_ENV !== 'production' || isTruthy(env.NOVELSCRIPT_ENABLE_DEV_CHANNEL);
}

export function canAccessDeveloperChannel(
  viewer: { user: { email: string } } | null,
  env: DeveloperEnv = process.env
) {
  if (!viewer || !isDeveloperChannelEnabled(env)) {
    return false;
  }

  const allowlist = getDeveloperChannelAllowlist(env);
  if (allowlist.length === 0) {
    return true;
  }

  return allowlist.includes(viewer.user.email.trim().toLowerCase());
}

export function getDeveloperChannelAllowlist(env: DeveloperEnv = process.env) {
  return (env.NOVELSCRIPT_DEV_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function isTruthy(value: string | undefined) {
  if (!value) {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}
