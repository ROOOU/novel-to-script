import { slugify } from '@/lib/slug';
import { countChineseWords } from '@/lib/preprocessor';
import {
  getPlatformRuntime,
  type ArtifactRelation,
  type GenerationArtifact,
  type GenerationJob,
  type SourceDocument,
} from '@/server/shared/platform';
import { buildProjectArtifactInsights } from './insights';

export async function createProject(input: {
  organizationId: string;
  workspaceId: string;
  userId: string;
  name: string;
  description?: string;
  genre?: string;
}) {
  const runtime = getPlatformRuntime();
  const slug = await createUniqueProjectSlug(input.workspaceId, input.name);
  return runtime.projects.create({
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    slug,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    genre: input.genre ?? null,
    createdByUserId: input.userId,
  });
}

export async function saveProjectSource(input: {
  projectId: string;
  organizationId: string;
  workspaceId: string;
  userId: string;
  title: string;
  textContent: string;
}) {
  const runtime = getPlatformRuntime();
  const project = await runtime.projects.getById(input.projectId);
  if (!project) {
    throw new Error('PROJECT_NOT_FOUND');
  }

  const wordCount = countChineseWords(input.textContent);
  const existingSourceDocument = project.sourceDocumentId
    ? await runtime.sourceDocuments.getById(project.sourceDocumentId)
    : null;

  if (existingSourceDocument) {
    const updated = await runtime.sourceDocuments.update(existingSourceDocument.id, {
      title: input.title,
      textContent: input.textContent,
      wordCount,
      status: 'ready',
      updatedByUserId: input.userId,
    });
    return updated;
  }

  const created = await runtime.sourceDocuments.create({
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    title: input.title,
    kind: 'novel',
    mimeType: 'text/plain',
    textContent: input.textContent,
    wordCount,
    createdByUserId: input.userId,
  });

  await runtime.projects.update(project.id, {
    sourceDocumentId: created.id,
    updatedByUserId: input.userId,
  });

  return created;
}

export async function getProjectBundle(projectId: string) {
  const runtime = getPlatformRuntime();
  const project = await runtime.projects.getById(projectId);
  if (!project) {
    return null;
  }

  const [sourceDocuments, jobs, artifacts, artifactRelations] = await Promise.all([
    runtime.sourceDocuments.listByProjectId(projectId),
    runtime.generationJobs.listByProjectId(projectId),
    runtime.generationArtifacts.listByProjectId(projectId),
    runtime.artifactRelations.listByProjectId(projectId),
  ]);

  return {
    project,
    sourceDocuments: sourceDocuments.sort((left: SourceDocument, right: SourceDocument) => right.updatedAt.localeCompare(left.updatedAt)),
    jobs: jobs.sort((left: GenerationJob, right: GenerationJob) => right.createdAt.localeCompare(left.createdAt)),
    artifacts: artifacts.sort((left: GenerationArtifact, right: GenerationArtifact) => right.createdAt.localeCompare(left.createdAt)),
    artifactRelations: artifactRelations.sort((left: ArtifactRelation, right: ArtifactRelation) => right.createdAt.localeCompare(left.createdAt)),
    insights: buildProjectArtifactInsights(artifacts),
  };
}

async function createUniqueProjectSlug(workspaceId: string, name: string): Promise<string> {
  const runtime = getPlatformRuntime();
  const base = slugify(name);
  let suffix = 0;

  while (true) {
    const candidate = suffix === 0 ? base : `${base}-${suffix}`;
    const existing = await runtime.projects.getBySlug(workspaceId, candidate);
    if (!existing) {
      return candidate;
    }
    suffix += 1;
  }
}
