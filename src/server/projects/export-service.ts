import { getPlatformRuntime } from '@/server/shared/platform';
import type { GenerationArtifact, GenerationArtifactFormat, GenerationJob } from '@/server/shared/platform/domain';
import { getProjectBundle } from './service';

export type ProjectExportFormatKey = 'markdown' | 'json' | 'text';

interface ProjectExportPayload {
  title: string;
  format: GenerationArtifactFormat;
  extension: string;
  content: string;
}

export async function createProjectExportArtifact(input: {
  projectId: string;
  organizationId: string;
  workspaceId: string;
  userId: string;
  format: ProjectExportFormatKey;
}) {
  const runtime = getPlatformRuntime();
  const bundle = await getProjectBundle(input.projectId);
  if (!bundle || bundle.project.organizationId !== input.organizationId) {
    throw new Error('PROJECT_NOT_FOUND');
  }

  const exportPayload = buildProjectExportPayload(bundle, input.format);
  const exportJob = await runtime.generationJobs.create({
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    kind: 'export-generation',
    requestedByUserId: input.userId,
    inputSnapshot: {
      format: input.format,
      artifactCount: bundle.artifacts.length,
    },
    billingState: 'none',
    reservedCredits: 0,
  });

  await runtime.generationJobs.markSucceeded(exportJob.id, {
    progress: 100,
    currentStep: 'exported',
    outputSummary: `${input.format} export ready`,
    billingState: 'none',
    updatedByUserId: input.userId,
  });

  const artifact = await runtime.generationArtifacts.create({
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    generationJobId: exportJob.id,
    kind: 'export',
    format: exportPayload.format,
    title: exportPayload.title,
    content: exportPayload.content,
    isEditable: false,
    metadata: {
      exportFormat: input.format,
      downloadFilename: `${bundle.project.slug}-export.${exportPayload.extension}`,
      includedArtifactIds: bundle.artifacts.map((artifactEntry: GenerationArtifact) => artifactEntry.id),
      includedArtifactRelationIds: bundle.artifactRelations.map((relation) => relation.id),
      includedJobIds: bundle.jobs.map((job: GenerationJob) => job.id),
      exportedAt: new Date().toISOString(),
    },
    createdByUserId: input.userId,
  });

  await runtime.usageEvents.append({
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    generationJobId: exportJob.id,
    userId: input.userId,
    kind: 'export',
    featureKey: `project-export:${input.format}`,
    quantity: 1,
    occurredAt: new Date().toISOString(),
    metadata: {
      artifactId: artifact.id,
      exportFormat: input.format,
    },
    createdByUserId: input.userId,
  });

  return artifact;
}

export function buildProjectExportPayload(
  bundle: NonNullable<Awaited<ReturnType<typeof getProjectBundle>>>,
  format: ProjectExportFormatKey
): ProjectExportPayload {
  const exportedAt = new Date().toISOString();
  const title = `${bundle.project.name} ${format.toUpperCase()} Export`;

  switch (format) {
    case 'json':
      return {
        title,
        format: 'application/json',
        extension: 'json',
        content: JSON.stringify(
          {
            exportedAt,
            project: bundle.project,
            sourceDocuments: bundle.sourceDocuments,
            jobs: bundle.jobs,
            artifacts: bundle.artifacts,
            artifactRelations: bundle.artifactRelations,
          },
          null,
          2
        ),
      };
    case 'text':
      return {
        title,
        format: 'text/plain',
        extension: 'txt',
        content: buildPlainTextExport(bundle, exportedAt),
      };
    case 'markdown':
    default:
      return {
        title,
        format: 'text/markdown',
        extension: 'md',
        content: buildMarkdownExport(bundle, exportedAt),
      };
  }
}

function buildMarkdownExport(
  bundle: NonNullable<Awaited<ReturnType<typeof getProjectBundle>>>,
  exportedAt: string
) {
  const parts: string[] = [
    `# ${bundle.project.name}`,
    '',
    `- Exported at: ${exportedAt}`,
    `- Genre: ${bundle.project.genre ?? 'n/a'}`,
    `- Description: ${bundle.project.description ?? 'n/a'}`,
    '',
    '## Source Documents',
    '',
  ];

  for (const sourceDocument of bundle.sourceDocuments) {
    parts.push(`### ${sourceDocument.title}`);
    parts.push(`- Status: ${sourceDocument.status}`);
    parts.push(`- Word count: ${sourceDocument.wordCount ?? 0}`);
    parts.push('');
    parts.push(sourceDocument.textContent ?? '');
    parts.push('');
  }

  parts.push('## Jobs', '');
  for (const job of bundle.jobs) {
    parts.push(`- ${job.kind} | ${job.status} | ${job.currentStep ?? 'pending'} | ${job.createdAt}`);
  }

  parts.push('', '## Artifacts', '');
  for (const artifact of bundle.artifacts) {
    parts.push(`### ${artifact.title} (${artifact.kind} v${artifact.version})`);
    parts.push(`- Format: ${artifact.format}`);
    parts.push(`- Created at: ${artifact.createdAt}`);
    parts.push('');
    parts.push(artifact.content ?? '');
    parts.push('');
  }

  parts.push('## Artifact Relations', '');
  if (bundle.artifactRelations.length === 0) {
    parts.push('- None');
  } else {
    for (const relation of bundle.artifactRelations) {
      parts.push(
        `- ${relation.relationType}: ${relation.upstreamArtifactId} -> ${relation.downstreamArtifactId} (${relation.id})`
      );
    }
  }

  return parts.join('\n');
}

function buildPlainTextExport(
  bundle: NonNullable<Awaited<ReturnType<typeof getProjectBundle>>>,
  exportedAt: string
) {
  const parts: string[] = [
    `${bundle.project.name}`,
    `Exported at: ${exportedAt}`,
    `Genre: ${bundle.project.genre ?? 'n/a'}`,
    `Description: ${bundle.project.description ?? 'n/a'}`,
    '',
    'SOURCE DOCUMENTS',
  ];

  for (const sourceDocument of bundle.sourceDocuments) {
    parts.push('');
    parts.push(`[${sourceDocument.title}]`);
    parts.push(sourceDocument.textContent ?? '');
  }

  parts.push('', 'JOBS');
  for (const job of bundle.jobs) {
    parts.push(`${job.kind} | ${job.status} | ${job.currentStep ?? 'pending'} | ${job.createdAt}`);
  }

  parts.push('', 'ARTIFACTS');
  for (const artifact of bundle.artifacts) {
    parts.push('');
    parts.push(`[${artifact.kind} v${artifact.version}] ${artifact.title}`);
    parts.push(artifact.content ?? '');
  }

  parts.push('', 'ARTIFACT RELATIONS');
  if (bundle.artifactRelations.length === 0) {
    parts.push('None');
  } else {
    for (const relation of bundle.artifactRelations) {
      parts.push(
        `${relation.relationType} | ${relation.upstreamArtifactId} -> ${relation.downstreamArtifactId} | ${relation.id}`
      );
    }
  }

  return parts.join('\n');
}
