import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createProject } from '@/server/projects/service';
import { applyPlatformResponseHeaders, getPlatformRuntime } from '@/server/shared/platform';
import { requireViewerPlatformContext } from '@/server/auth/http';

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  genre: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const { viewer, response, context } = await requireViewerPlatformContext(request);
  if (response || !viewer || !context) {
    return response ?? undefined;
  }

  const runtime = getPlatformRuntime();
  const projects = await runtime.projects.listByWorkspaceId(viewer.workspace.id);
  return applyPlatformResponseHeaders(NextResponse.json({
    ok: true,
    projects,
  }), context);
}

export async function POST(request: NextRequest) {
  const { viewer, response, context } = await requireViewerPlatformContext(request);
  if (response || !viewer || !context) {
    return response ?? undefined;
  }

  const body = createProjectSchema.parse(await request.json());
  const project = await createProject({
    organizationId: viewer.organization.id,
    workspaceId: viewer.workspace.id,
    userId: viewer.user.id,
    name: body.name,
    description: body.description,
    genre: body.genre,
  });

  return applyPlatformResponseHeaders(NextResponse.json({
    ok: true,
    project,
  }), context);
}
