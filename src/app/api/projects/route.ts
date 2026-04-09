import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createProject } from '@/server/projects/service';
import { getPlatformRuntime } from '@/server/shared/platform';
import { requireViewerResponse } from '@/server/auth/http';

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  genre: z.string().optional(),
});

export async function GET() {
  const { viewer, response } = await requireViewerResponse();
  if (response || !viewer) {
    return response;
  }

  const runtime = getPlatformRuntime();
  const projects = await runtime.projects.listByWorkspaceId(viewer.workspace.id);
  return NextResponse.json({
    ok: true,
    projects,
  });
}

export async function POST(request: NextRequest) {
  const { viewer, response } = await requireViewerResponse();
  if (response || !viewer) {
    return response;
  }

  let body: z.infer<typeof createProjectSchema>;
  try {
    body = createProjectSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? 'INVALID_PROJECT_PAYLOAD'
        : 'INVALID_PROJECT_PAYLOAD';
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 }
    );
  }

  const project = await createProject({
    organizationId: viewer.organization.id,
    workspaceId: viewer.workspace.id,
    userId: viewer.user.id,
    name: body.name,
    description: body.description,
    genre: body.genre,
  });

  return NextResponse.json({
    ok: true,
    project,
  });
}
