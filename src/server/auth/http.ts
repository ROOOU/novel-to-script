import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import {
  applyPlatformResponseHeaders,
  getPlanHeaderDefault,
  resolvePlatformRequestContext,
  type PlatformRequestContext,
  type PlatformRequestLike,
} from '@/server/shared/platform';
import { getCurrentViewer } from './service';

export function buildLocalizedLoginRedirect(locale: string, path: string) {
  return `/${locale}/login?redirect_url=${encodeURIComponent(`/${locale}${path}`)}`;
}

export async function requireViewerResponse() {
  const viewer = await getCurrentViewer();
  if (!viewer) {
    return {
      viewer: null,
      response: NextResponse.json(
        {
          ok: false,
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      ),
    };
  }

  return {
    viewer,
    response: null,
  };
}

export function getViewerDefaults(viewer: Awaited<ReturnType<typeof getCurrentViewer>> | null) {
  if (!viewer) {
    return undefined;
  }

  return {
    userId: viewer.user.id,
    organizationId: viewer.organization.id,
    workspaceId: viewer.workspace.id,
  };
}

export async function resolveViewerSafely() {
  try {
    return await getCurrentViewer();
  } catch {
    return null;
  }
}

export async function requireViewerPlatformContext(request: PlatformRequestLike) {
  const context = resolvePlatformRequestContext(request, {
    defaultPlan: getPlanHeaderDefault(request),
  });
  const { viewer, response } = await requireViewerResponse();
  if (!viewer || response) {
    return {
      viewer: null,
      response: response ? applyPlatformResponseHeaders(response, context) : response,
      context,
    };
  }

  return {
    viewer,
    response: null,
    context: resolvePlatformRequestContext(request, {
      defaultPlan: getPlanHeaderDefault(request),
      viewerDefaults: getViewerDefaults(viewer),
    }),
  };
}

export async function resolveOptionalViewerPlatformContext(request: PlatformRequestLike) {
  const viewer = await resolveViewerSafely();
  const context = resolvePlatformRequestContext(request, {
    defaultPlan: getPlanHeaderDefault(request),
    viewerDefaults: getViewerDefaults(viewer),
  });

  return {
    viewer,
    context,
  };
}

export async function requireViewerForLocalizedPage(locale: string, path: string) {
  const viewer = await getCurrentViewer();
  if (!viewer) {
    redirect(buildLocalizedLoginRedirect(locale, path));
  }

  return viewer;
}
