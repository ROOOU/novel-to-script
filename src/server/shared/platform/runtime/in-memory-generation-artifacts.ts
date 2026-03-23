import type {
  GenerationArtifact,
  GenerationArtifactRepository,
  UpdateGenerationArtifactInput,
} from '@/server/shared/platform';

const artifacts = new Map<string, GenerationArtifact>();

export function createInMemoryGenerationArtifactRepository(): GenerationArtifactRepository {
  return {
    async getById(id) {
      return artifacts.get(id) ?? null;
    },
    async listByJobId(generationJobId) {
      return Array.from(artifacts.values()).filter((artifact) => artifact.generationJobId === generationJobId);
    },
    async listByProjectId(projectId) {
      return Array.from(artifacts.values()).filter((artifact) => artifact.projectId === projectId);
    },
    async getLatestByKind(projectId, kind) {
      return Array.from(artifacts.values())
        .filter((artifact) => artifact.projectId === projectId && artifact.kind === kind)
        .sort((left, right) => right.version - left.version)[0] ?? null;
    },
    async create(input) {
      const now = new Date().toISOString();
      const id = createArtifactId();
      const artifact: GenerationArtifact = {
        id,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        generationJobId: input.generationJobId,
        sourceDocumentId: input.sourceDocumentId ?? null,
        kind: input.kind,
        format: input.format,
        title: input.title,
        version: input.version ?? 1,
        content: input.content ?? null,
        storageKey: input.storageKey ?? null,
        checksum: input.checksum ?? null,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
      };

      artifacts.set(id, artifact);
      return artifact;
    },
    async update(id, input) {
      return updateArtifact(id, input);
    },
    async archive(id, updatedByUserId) {
      return updateArtifact(id, {
        updatedByUserId,
        metadata: {
          archivedAt: new Date().toISOString(),
        },
      });
    },
  };
}

function updateArtifact(id: string, input: UpdateGenerationArtifactInput): GenerationArtifact {
  const current = artifacts.get(id);
  if (!current) {
    throw new Error(`Generation artifact not found: ${id}`);
  }

  const next: GenerationArtifact = {
    ...current,
    ...input,
    metadata: input.metadata ? { ...current.metadata, ...input.metadata } : current.metadata,
    updatedAt: new Date().toISOString(),
    updatedByUserId:
      input.updatedByUserId !== undefined ? input.updatedByUserId : current.updatedByUserId,
  };

  artifacts.set(id, next);
  return next;
}

function createArtifactId(): string {
  return `artifact_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
}

export function resetInMemoryGenerationArtifacts(): void {
  artifacts.clear();
}
