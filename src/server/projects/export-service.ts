import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import Papa from 'papaparse';
import { getPlatformRuntime } from '@/server/shared/platform';
import type {
  GenerationArtifact,
  GenerationArtifactFormat,
  GenerationJob,
  StoryboardShot,
} from '@/server/shared/platform/domain';
import { getProjectBundle } from './service';

export type ProjectExportFormatKey = 'markdown' | 'json' | 'text' | 'docx' | 'csv';

type ProjectBundle = NonNullable<Awaited<ReturnType<typeof getProjectBundle>>>;
type ExportContentEncoding = 'utf-8' | 'base64';

interface StoryboardCsvRow {
  storyboardArtifactId: string;
  storyboardTitle: string;
  storyboardVersion: string;
  storyboardCreatedAt: string;
  sourceScriptArtifactIds: string;
  sceneId: string;
  shotId: string;
  shotType: string;
  camera: string;
  composition: string;
  motion: string;
  subject: string;
  environment: string;
  lighting: string;
  audioHint: string;
  videoPrompt: string;
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' as const;
const CSV_MIME = 'text/csv' as const;
const STORYBOARD_CSV_FIELDS: Array<keyof StoryboardCsvRow> = [
  'storyboardArtifactId',
  'storyboardTitle',
  'storyboardVersion',
  'storyboardCreatedAt',
  'sourceScriptArtifactIds',
  'sceneId',
  'shotId',
  'shotType',
  'camera',
  'composition',
  'motion',
  'subject',
  'environment',
  'lighting',
  'audioHint',
  'videoPrompt',
];

interface ProjectExportPayload {
  title: string;
  format: GenerationArtifactFormat;
  extension: string;
  content: string;
  contentEncoding?: ExportContentEncoding;
  metadata?: Record<string, unknown>;
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

  const exportedAt = new Date().toISOString();
  const exportPayload = await buildProjectExportPayload(bundle, input.format, exportedAt);
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
      contentEncoding: exportPayload.contentEncoding ?? 'utf-8',
      downloadFilename: `${bundle.project.slug}-export.${exportPayload.extension}`,
      includedArtifactIds: bundle.artifacts.map((artifactEntry: GenerationArtifact) => artifactEntry.id),
      includedArtifactRelationIds: bundle.artifactRelations.map((relation) => relation.id),
      includedJobIds: bundle.jobs.map((job: GenerationJob) => job.id),
      exportedAt,
      ...exportPayload.metadata,
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

export async function buildProjectExportPayload(
  bundle: ProjectBundle,
  format: ProjectExportFormatKey,
  exportedAt = new Date().toISOString()
): Promise<ProjectExportPayload> {
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
    case 'csv':
      return buildCsvExport(bundle, title);
    case 'docx':
      return buildDocxExport(bundle, title, exportedAt);
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

function buildMarkdownExport(bundle: ProjectBundle, exportedAt: string) {
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

function buildPlainTextExport(bundle: ProjectBundle, exportedAt: string) {
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

async function buildDocxExport(bundle: ProjectBundle, title: string, exportedAt: string): Promise<ProjectExportPayload> {
  const scriptArtifacts = bundle.artifacts.filter((artifact) => artifact.kind === 'script');
  const storyboardArtifacts = bundle.artifacts.filter((artifact) => artifact.kind === 'storyboard');
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: bundle.project.name, bold: true, size: 36 })],
    }),
    new Paragraph(`Exported at: ${exportedAt}`),
    new Paragraph(`Genre: ${bundle.project.genre ?? 'n/a'}`),
    new Paragraph(`Description: ${bundle.project.description ?? 'n/a'}`),
  ];

  if (scriptArtifacts.length > 0) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: 'Scripts' }));
    for (const artifact of scriptArtifacts) {
      children.push(...buildArtifactDocxSection(artifact, ['episode']));
    }
  }

  if (storyboardArtifacts.length > 0) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, text: 'Storyboards' }));
    for (const artifact of storyboardArtifacts) {
      const storyboardMetadata = readStoryboardMetadata(artifact.metadata);
      children.push(...buildArtifactDocxSection(artifact, ['sourceScriptArtifactIds', 'shotCount']));
      const shots = readStoryboardShots(storyboardMetadata.shots);
      if (shots.length > 0) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: [new TextRun({ text: `Structured shots (${shots.length})`, bold: true })],
          })
        );
        for (const shot of shots) {
          children.push(...buildStoryboardShotParagraphs(shot));
        }
      }
    }
  }

  if (scriptArtifacts.length === 0 && storyboardArtifacts.length === 0) {
    children.push(
      new Paragraph({
        text: 'No script or storyboard artifacts are available for DOCX export yet.',
      })
    );
  }

  const document = new Document({
    sections: [
      {
        children,
      },
    ],
  });
  const buffer = await Packer.toBuffer(document);

  return {
    title,
    format: DOCX_MIME,
    extension: 'docx',
    content: buffer.toString('base64'),
    contentEncoding: 'base64',
    metadata: {
      exportTargetKinds: ['script', 'storyboard'],
    },
  };
}

function buildCsvExport(bundle: ProjectBundle, title: string): ProjectExportPayload {
  const storyboardArtifacts = bundle.artifacts.filter((artifact) => artifact.kind === 'storyboard');
  const rows = storyboardArtifacts.flatMap((artifact) => {
    const metadata = readStoryboardMetadata(artifact.metadata);
    const shots = readStoryboardShots(metadata.shots);
    const sourceScriptArtifactIds = readStringArray(metadata.sourceScriptArtifactIds).join('|');

    return shots.map(
      (shot): StoryboardCsvRow => ({
        storyboardArtifactId: artifact.id,
        storyboardTitle: artifact.title,
        storyboardVersion: artifact.version.toString(),
        storyboardCreatedAt: artifact.createdAt,
        sourceScriptArtifactIds,
        sceneId: shot.sceneId,
        shotId: shot.shotId,
        shotType: shot.shotType,
        camera: shot.camera,
        composition: shot.composition,
        motion: shot.motion,
        subject: shot.subject,
        environment: shot.environment,
        lighting: shot.lighting,
        audioHint: shot.audioHint,
        videoPrompt: shot.videoPrompt,
      })
    );
  });

  return {
    title,
    format: CSV_MIME,
    extension: 'csv',
    content: Papa.unparse(
      {
        fields: STORYBOARD_CSV_FIELDS,
        data: rows.map((row) => STORYBOARD_CSV_FIELDS.map((field) => row[field])),
      },
      {
        newline: '\n',
      }
    ),
    metadata: {
      csvRowCount: rows.length,
      exportTargetKinds: ['storyboard'],
      includedStoryboardArtifactIds: storyboardArtifacts.map((artifact) => artifact.id),
    },
  };
}

function buildArtifactDocxSection(
  artifact: GenerationArtifact,
  metadataKeys: Array<'episode' | 'sourceScriptArtifactIds' | 'shotCount'>
) {
  const metadata = artifact.metadata && typeof artifact.metadata === 'object' ? artifact.metadata : {};
  const paragraphs: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      children: [new TextRun({ text: `${artifact.title} (v${artifact.version})`, bold: true })],
    }),
    new Paragraph(`Created at: ${artifact.createdAt}`),
  ];

  for (const metadataKey of metadataKeys) {
    const metadataValue = formatMetadataValue(metadata[metadataKey]);
    if (metadataValue) {
      paragraphs.push(new Paragraph(`${metadataKey}: ${metadataValue}`));
    }
  }

  const content = artifact.content?.trim();
  if (!content) {
    paragraphs.push(new Paragraph('No artifact content available.'));
    return paragraphs;
  }

  return paragraphs.concat(buildMultilineParagraphs(content));
}

function buildStoryboardShotParagraphs(shot: StoryboardShot) {
  return [
    new Paragraph({
      children: [new TextRun({ text: `${shot.sceneId} / ${shot.shotId}`, bold: true })],
    }),
    new Paragraph(`Type: ${shot.shotType} | Camera: ${shot.camera} | Composition: ${shot.composition}`),
    new Paragraph(`Motion: ${shot.motion} | Subject: ${shot.subject}`),
    new Paragraph(`Environment: ${shot.environment} | Lighting: ${shot.lighting}`),
    new Paragraph(`Audio hint: ${shot.audioHint}`),
    new Paragraph(`Video prompt: ${shot.videoPrompt}`),
  ];
}

function buildMultilineParagraphs(value: string) {
  const lines = value.replace(/\r\n/g, '\n').split('\n');
  return lines.map((line) => new Paragraph(line));
}

function readStoryboardMetadata(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readStoryboardShots(value: unknown): StoryboardShot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return [];
    }

    const candidate = item as Record<string, unknown>;
    const shot: StoryboardShot = {
      sceneId: readString(candidate.sceneId),
      shotId: readString(candidate.shotId),
      shotType: readString(candidate.shotType),
      camera: readString(candidate.camera),
      composition: readString(candidate.composition),
      motion: readString(candidate.motion),
      subject: readString(candidate.subject),
      environment: readString(candidate.environment),
      lighting: readString(candidate.lighting),
      audioHint: readString(candidate.audioHint),
      videoPrompt: readString(candidate.videoPrompt),
    };

    if (!shot.sceneId && !shot.shotId && !shot.shotType && !shot.videoPrompt) {
      return [];
    }

    return [shot];
  });
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatMetadataValue(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const normalized = value
      .filter((item): item is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof item))
      .map((item) => String(item).trim())
      .filter(Boolean);
    return normalized.length > 0 ? normalized.join(', ') : null;
  }

  return null;
}
