import { and, desc, eq, inArray } from 'drizzle-orm';
import type {
  ArtifactRelation,
  CreateArtifactRelationInput,
  CreateCreditAccountInput,
  CreateCreditLedgerEntryInput,
  CreateGenerationArtifactInput,
  CreateGenerationJobInput,
  CreateOrganizationInput,
  CreatePaymentOrderInput,
  CreateProjectInput,
  CreateRedeemCodeCampaignInput,
  CreateRedeemCodeInput,
  CreateRedeemCodeRedemptionInput,
  CreateSourceDocumentInput,
  CreateSubscriptionInput,
  CreateUsageEventInput,
  CreateUserInput,
  CreateWorkspaceInput,
  CreditAccount,
  CreditLedgerEntry,
  GenerationArtifact,
  GenerationJob,
  Organization,
  PaymentOrder,
  Project,
  RedeemCode,
  RedeemCodeCampaign,
  RedeemCodeRedemption,
  SourceDocument,
  Subscription,
  UpdateCreditAccountInput,
  UpdateGenerationArtifactInput,
  UpdateGenerationJobInput,
  UpdateOrganizationInput,
  UpdatePaymentOrderInput,
  UpdateProjectInput,
  UpdateRedeemCodeCampaignInput,
  UpdateRedeemCodeInput,
  UpdateSourceDocumentInput,
  UpdateSubscriptionInput,
  UpdateUserInput,
  UpdateWorkspaceInput,
  UsageEvent,
  User,
  Workspace,
} from '@/server/shared/platform/domain';
import type {
  ArtifactRelationRepository,
  CreditAccountRepository,
  CreditLedgerRepository,
  GenerationArtifactRepository,
  GenerationJobRepository,
  OrganizationRepository,
  PaymentOrderRepository,
  ProjectRepository,
  RedeemCodeCampaignRepository,
  RedeemCodeRedemptionRepository,
  RedeemCodeRepository,
  SourceDocumentRepository,
  SubscriptionRepository,
  UpsertCurrentSubscriptionInput,
  UsageEventRepository,
  UserRepository,
  WorkspaceRepository,
} from '@/server/shared/platform/repositories';
import { createEntityId, getNowTimestamp } from '../runtime/file-store';
import { getDatabaseClient, shouldUseDatabaseRuntime } from './client';
import {
  creditAccountsTable,
  creditLedgerEntriesTable,
  generationArtifactsTable,
  artifactRelationsTable,
  generationJobsTable,
  organizationsTable,
  paymentOrdersTable,
  projectsTable,
  redeemCodeCampaignsTable,
  redeemCodeRedemptionsTable,
  redeemCodesTable,
  sourceDocumentsTable,
  subscriptionsTable,
  usageEventsTable,
  usersTable,
  workspacesTable,
} from './schema';

export type DatabasePlatformRuntime = {
  users: UserRepository;
  organizations: OrganizationRepository;
  workspaces: WorkspaceRepository;
  projects: ProjectRepository;
  sourceDocuments: SourceDocumentRepository;
  generationJobs: GenerationJobRepository;
  generationArtifacts: GenerationArtifactRepository;
  artifactRelations: ArtifactRelationRepository;
  usageEvents: UsageEventRepository;
  subscriptions: SubscriptionRepository;
  paymentOrders: PaymentOrderRepository;
  creditAccounts: CreditAccountRepository;
  creditLedger: CreditLedgerRepository;
  redeemCodeCampaigns: RedeemCodeCampaignRepository;
  redeemCodes: RedeemCodeRepository;
  redeemCodeRedemptions: RedeemCodeRedemptionRepository;
};

export function createDatabasePlatformRuntime(): DatabasePlatformRuntime | null {
  if (!shouldUseDatabaseRuntime()) {
    return null;
  }

  const db = getDatabaseClient();

  return {
    users: createUserRepository(db),
    organizations: createOrganizationRepository(db),
    workspaces: createWorkspaceRepository(db),
    projects: createProjectRepository(db),
    sourceDocuments: createSourceDocumentRepository(db),
    generationJobs: createGenerationJobRepository(db),
    generationArtifacts: createGenerationArtifactRepository(db),
    artifactRelations: createArtifactRelationRepository(db),
    usageEvents: createUsageEventRepository(db),
    subscriptions: createSubscriptionRepository(db),
    paymentOrders: createPaymentOrderRepository(db),
    creditAccounts: createCreditAccountRepository(db),
    creditLedger: createCreditLedgerRepository(db),
    redeemCodeCampaigns: createRedeemCodeCampaignRepository(db),
    redeemCodes: createRedeemCodeRepository(db),
    redeemCodeRedemptions: createRedeemCodeRedemptionRepository(db),
  };
}

function createUserRepository(db: ReturnType<typeof getDatabaseClient>): UserRepository {
  const userSelection = {
    id: usersTable.id,
    email: usersTable.email,
    displayName: usersTable.displayName,
    passwordHash: usersTable.passwordHash,
    avatarUrl: usersTable.avatarUrl,
    preferredLocale: usersTable.preferredLocale,
    defaultOrganizationId: usersTable.defaultOrganizationId,
    status: usersTable.status,
    lastLoginAt: usersTable.lastLoginAt,
    createdAt: usersTable.createdAt,
    createdByUserId: usersTable.createdByUserId,
    updatedAt: usersTable.updatedAt,
    updatedByUserId: usersTable.updatedByUserId,
  };

  return {
    async getById(id: string) {
      const rows = await db.select(userSelection).from(usersTable).where(eq(usersTable.id, id)).limit(1);
      return rows[0] ? mapUserRow(rows[0]) : null;
    },
    async getByEmail(email) {
      const rows = await db
        .select(userSelection)
        .from(usersTable)
        .where(eq(usersTable.email, email.trim().toLowerCase()))
        .limit(1);
      return rows[0] ? mapUserRow(rows[0]) : null;
    },
    async listByIds(ids) {
      if (ids.length === 0) {
        return [];
      }

      const rows = await db.select(userSelection).from(usersTable).where(inArray(usersTable.id, ids));
      return rows.map(mapUserRow);
    },
    async create(input) {
      const now = getNowTimestamp();
      const entity: User = {
        id: createEntityId('user'),
        email: input.email.trim().toLowerCase(),
        displayName: input.displayName.trim(),
        passwordHash: input.passwordHash ?? null,
        avatarUrl: input.avatarUrl ?? null,
        preferredLocale: input.preferredLocale ?? 'zh-CN',
        defaultOrganizationId: input.defaultOrganizationId ?? null,
        status: input.status ?? 'active',
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
      };
      await withOptionalUsersDataColumn((includeData) => db.insert(usersTable).values(buildUserRow(entity, includeData)));
      return entity;
    },
    async update(id, input) {
      const current = await this.getById(id);
      if (!current) {
        throw new Error(`User not found: ${id}`);
      }

      const entity = applyPatch(current, input);
      entity.updatedAt = getNowTimestamp();
      entity.updatedByUserId = input.updatedByUserId ?? current.updatedByUserId ?? null;
      await withOptionalUsersDataColumn((includeData) =>
        db.update(usersTable).set(buildUserRow(entity, includeData)).where(eq(usersTable.id, id))
      );
      return entity;
    },
  };
}

function createOrganizationRepository(db: ReturnType<typeof getDatabaseClient>): OrganizationRepository {
  return {
    async getById(id) {
      return selectOne<Organization>(db.select({ data: organizationsTable.data }).from(organizationsTable).where(eq(organizationsTable.id, id)));
    },
    async getBySlug(slug) {
      return selectOne<Organization>(db.select({ data: organizationsTable.data }).from(organizationsTable).where(eq(organizationsTable.slug, slug)));
    },
    async listByOwnerUserId(userId) {
      return selectMany<Organization>(
        db.select({ data: organizationsTable.data }).from(organizationsTable).where(eq(organizationsTable.ownerUserId, userId))
      );
    },
    async create(input) {
      const now = getNowTimestamp();
      const entity: Organization = {
        id: createEntityId('org'),
        slug: input.slug,
        name: input.name,
        ownerUserId: input.ownerUserId,
        status: 'active',
        billingLocale: input.billingLocale,
        billingCurrency: input.billingCurrency,
        pricingRegion: input.pricingRegion,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
      };
      await db.insert(organizationsTable).values(buildOrganizationRow(entity));
      return entity;
    },
    async update(id, input) {
      const current = await this.getById(id);
      if (!current) {
        throw new Error(`Organization not found: ${id}`);
      }

      const entity = applyPatch(current, input);
      entity.updatedAt = getNowTimestamp();
      entity.updatedByUserId = input.updatedByUserId ?? current.updatedByUserId ?? null;
      await db.update(organizationsTable).set(buildOrganizationRow(entity)).where(eq(organizationsTable.id, id));
      return entity;
    },
  };
}

function createWorkspaceRepository(db: ReturnType<typeof getDatabaseClient>): WorkspaceRepository {
  return {
    async getById(id) {
      return selectOne<Workspace>(db.select({ data: workspacesTable.data }).from(workspacesTable).where(eq(workspacesTable.id, id)));
    },
    async getBySlug(organizationId, slug) {
      return selectOne<Workspace>(
        db.select({ data: workspacesTable.data }).from(workspacesTable).where(
          and(eq(workspacesTable.organizationId, organizationId), eq(workspacesTable.slug, slug))
        )
      );
    },
    async listByOrganizationId(organizationId) {
      return selectMany<Workspace>(
        db.select({ data: workspacesTable.data }).from(workspacesTable).where(eq(workspacesTable.organizationId, organizationId))
      );
    },
    async create(input) {
      const now = getNowTimestamp();
      const entity: Workspace = {
        id: createEntityId('ws'),
        organizationId: input.organizationId,
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        status: 'active',
        defaultLocale: input.defaultLocale ?? 'zh-CN',
        defaultModelName: input.defaultModelName ?? null,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
      };
      await db.insert(workspacesTable).values(buildWorkspaceRow(entity));
      return entity;
    },
    async update(id, input) {
      const current = await this.getById(id);
      if (!current) {
        throw new Error(`Workspace not found: ${id}`);
      }

      const entity = applyPatch(current, input);
      entity.updatedAt = getNowTimestamp();
      entity.updatedByUserId = input.updatedByUserId ?? current.updatedByUserId ?? null;
      await db.update(workspacesTable).set(buildWorkspaceRow(entity)).where(eq(workspacesTable.id, id));
      return entity;
    },
    async archive(id, updatedByUserId) {
      return this.update(id, {
        status: 'archived',
        updatedByUserId,
      });
    },
  };
}

function createProjectRepository(db: ReturnType<typeof getDatabaseClient>): ProjectRepository {
  return {
    async getById(id) {
      return selectOne<Project>(db.select({ data: projectsTable.data }).from(projectsTable).where(eq(projectsTable.id, id)));
    },
    async getBySlug(workspaceId, slug) {
      return selectOne<Project>(
        db.select({ data: projectsTable.data }).from(projectsTable).where(
          and(eq(projectsTable.workspaceId, workspaceId), eq(projectsTable.slug, slug))
        )
      );
    },
    async listByWorkspaceId(workspaceId) {
      return selectMany<Project>(
        db
          .select({ data: projectsTable.data })
          .from(projectsTable)
          .where(
            and(
              eq(projectsTable.workspaceId, workspaceId),
              eq(projectsTable.status, 'active')
            )
          )
      );
    },
    async listByOrganizationId(organizationId) {
      return selectMany<Project>(
        db
          .select({ data: projectsTable.data })
          .from(projectsTable)
          .where(
            and(
              eq(projectsTable.organizationId, organizationId),
              eq(projectsTable.status, 'active')
            )
          )
      );
    },
    async findBySourceDocumentId(sourceDocumentId) {
      return selectOne<Project>(
        db.select({ data: projectsTable.data }).from(projectsTable).where(eq(projectsTable.sourceDocumentId, sourceDocumentId))
      );
    },
    async create(input) {
      const now = getNowTimestamp();
      const entity: Project = {
        id: createEntityId('project'),
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        slug: input.slug,
        name: input.name.trim(),
        description: input.description ?? null,
        status: 'active',
        sourceDocumentId: input.sourceDocumentId ?? null,
        latestGenerationJobId: null,
        genre: input.genre ?? null,
        labels: input.labels ?? [],
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
      };
      await db.insert(projectsTable).values(buildProjectRow(entity));
      return entity;
    },
    async update(id, input) {
      const current = await this.getById(id);
      if (!current) {
        throw new Error(`Project not found: ${id}`);
      }

      const entity = applyPatch(current, input);
      entity.updatedAt = getNowTimestamp();
      entity.updatedByUserId = input.updatedByUserId ?? current.updatedByUserId ?? null;
      await db.update(projectsTable).set(buildProjectRow(entity)).where(eq(projectsTable.id, id));
      return entity;
    },
    async archive(id, updatedByUserId) {
      return this.update(id, {
        status: 'archived',
        archivedAt: getNowTimestamp(),
        updatedByUserId,
      });
    },
  };
}

function createSourceDocumentRepository(db: ReturnType<typeof getDatabaseClient>): SourceDocumentRepository {
  return {
    async getById(id) {
      return selectOne<SourceDocument>(
        db.select({ data: sourceDocumentsTable.data }).from(sourceDocumentsTable).where(eq(sourceDocumentsTable.id, id))
      );
    },
    async listByProjectId(projectId) {
      return selectMany<SourceDocument>(
        db.select({ data: sourceDocumentsTable.data }).from(sourceDocumentsTable).where(eq(sourceDocumentsTable.projectId, projectId))
      );
    },
    async listByWorkspaceId(workspaceId) {
      return selectMany<SourceDocument>(
        db.select({ data: sourceDocumentsTable.data }).from(sourceDocumentsTable).where(eq(sourceDocumentsTable.workspaceId, workspaceId))
      );
    },
    async create(input) {
      const now = getNowTimestamp();
      const entity: SourceDocument = {
        id: createEntityId('src'),
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        title: input.title,
        kind: input.kind,
        status: 'ready',
        mimeType: input.mimeType,
        textContent: input.textContent ?? null,
        storageKey: input.storageKey ?? null,
        checksum: input.checksum ?? null,
        wordCount: input.wordCount ?? null,
        sourceVersion: input.sourceVersion ?? null,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
      };
      await db.insert(sourceDocumentsTable).values(buildSourceDocumentRow(entity));
      return entity;
    },
    async update(id, input) {
      const current = await this.getById(id);
      if (!current) {
        throw new Error(`SourceDocument not found: ${id}`);
      }

      const entity = applyPatch(current, input);
      entity.updatedAt = getNowTimestamp();
      entity.updatedByUserId = input.updatedByUserId ?? current.updatedByUserId ?? null;
      await db.update(sourceDocumentsTable).set(buildSourceDocumentRow(entity)).where(eq(sourceDocumentsTable.id, id));
      return entity;
    },
    async archive(id, updatedByUserId) {
      return this.update(id, {
        status: 'archived',
        updatedByUserId,
      });
    },
  };
}

function createGenerationJobRepository(db: ReturnType<typeof getDatabaseClient>): GenerationJobRepository {
  return {
    async getById(id) {
      return selectOne<GenerationJob>(db.select({ data: generationJobsTable.data }).from(generationJobsTable).where(eq(generationJobsTable.id, id)));
    },
    async listByProjectId(projectId) {
      return selectMany<GenerationJob>(
        db.select({ data: generationJobsTable.data }).from(generationJobsTable).where(eq(generationJobsTable.projectId, projectId))
      );
    },
    async listByWorkspaceId(workspaceId) {
      return selectMany<GenerationJob>(
        db.select({ data: generationJobsTable.data }).from(generationJobsTable).where(eq(generationJobsTable.workspaceId, workspaceId))
      );
    },
    async listActiveByWorkspaceId(workspaceId) {
      return selectMany<GenerationJob>(
        db.select({ data: generationJobsTable.data }).from(generationJobsTable).where(
          and(eq(generationJobsTable.workspaceId, workspaceId), inArray(generationJobsTable.status, ['queued', 'running']))
        )
      );
    },
    async create(input) {
      const now = getNowTimestamp();
      const entity: GenerationJob = {
        id: createEntityId('job'),
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        sourceDocumentId: input.sourceDocumentId ?? null,
        kind: input.kind,
        status: 'queued',
        billingState: input.billingState ?? 'none',
        reservedCredits: input.reservedCredits ?? null,
        settledCredits: input.settledCredits ?? null,
        progress: 0,
        currentStep: null,
        requestedByUserId: input.requestedByUserId ?? null,
        requestedBySessionId: input.requestedBySessionId ?? null,
        modelName: input.modelName ?? null,
        inputSnapshot: input.inputSnapshot,
        outputSummary: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
        cancelledAt: null,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.requestedByUserId ?? null,
        updatedByUserId: input.requestedByUserId ?? null,
      };
      await db.insert(generationJobsTable).values(buildGenerationJobRow(entity));
      return entity;
    },
    async update(id, input) {
      const current = await this.getById(id);
      if (!current) {
        throw new Error(`GenerationJob not found: ${id}`);
      }

      const entity = applyPatch(current, input);
      entity.updatedAt = getNowTimestamp();
      entity.updatedByUserId = input.updatedByUserId ?? current.updatedByUserId ?? null;
      await db.update(generationJobsTable).set(buildGenerationJobRow(entity)).where(eq(generationJobsTable.id, id));
      return entity;
    },
    async markQueued(id, updatedByUserId) {
      return this.update(id, {
        status: 'queued',
        updatedByUserId,
      });
    },
    async markRunning(id, startedAt, updatedByUserId) {
      return this.update(id, {
        status: 'running',
        startedAt: startedAt ?? getNowTimestamp(),
        updatedByUserId,
      });
    },
    async markSucceeded(id, input) {
      return this.update(id, {
        ...input,
        status: 'succeeded',
        finishedAt: input.finishedAt ?? getNowTimestamp(),
      });
    },
    async markFailed(id, input) {
      return this.update(id, {
        ...input,
        status: 'failed',
        finishedAt: input.finishedAt ?? getNowTimestamp(),
      });
    },
    async cancel(id, cancelledAt, updatedByUserId) {
      return this.update(id, {
        status: 'cancelled',
        cancelledAt: cancelledAt ?? getNowTimestamp(),
        updatedByUserId,
      });
    },
  };
}

function createGenerationArtifactRepository(db: ReturnType<typeof getDatabaseClient>): GenerationArtifactRepository {
  return {
    async getById(id) {
      return selectOne<GenerationArtifact>(
        db.select({ data: generationArtifactsTable.data }).from(generationArtifactsTable).where(eq(generationArtifactsTable.id, id))
      );
    },
    async listByJobId(generationJobId) {
      return selectMany<GenerationArtifact>(
        db.select({ data: generationArtifactsTable.data }).from(generationArtifactsTable).where(eq(generationArtifactsTable.generationJobId, generationJobId))
      );
    },
    async listByProjectId(projectId) {
      return selectMany<GenerationArtifact>(
        db.select({ data: generationArtifactsTable.data }).from(generationArtifactsTable).where(eq(generationArtifactsTable.projectId, projectId))
      );
    },
    async getLatestByKind(projectId, kind) {
      return selectOne<GenerationArtifact>(
        db.select({ data: generationArtifactsTable.data }).from(generationArtifactsTable).where(
          and(eq(generationArtifactsTable.projectId, projectId), eq(generationArtifactsTable.kind, kind))
        ).orderBy(desc(generationArtifactsTable.version))
      );
    },
    async create(input) {
      const now = getNowTimestamp();
      const existingVersions = await db
        .select({ version: generationArtifactsTable.version })
        .from(generationArtifactsTable)
        .where(and(eq(generationArtifactsTable.projectId, input.projectId), eq(generationArtifactsTable.kind, input.kind)));
      const nextVersion =
        input.version ??
        (existingVersions.length === 0 ? 1 : Math.max(...existingVersions.map((entry) => entry.version)) + 1);
      const entity: GenerationArtifact = {
        id: createEntityId('artifact'),
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        generationJobId: input.generationJobId,
        sourceDocumentId: input.sourceDocumentId ?? null,
        kind: input.kind,
        format: input.format,
        title: input.title,
        version: nextVersion,
        content: input.content ?? null,
        storageKey: input.storageKey ?? null,
        checksum: input.checksum ?? null,
        isEditable: input.isEditable ?? true,
        parentArtifactId: input.parentArtifactId ?? null,
        versionGroupId: input.versionGroupId ?? input.parentArtifactId ?? null,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
      };
      await db.insert(generationArtifactsTable).values(buildGenerationArtifactRow(entity));
      return entity;
    },
    async update(id, input) {
      const current = await this.getById(id);
      if (!current) {
        throw new Error(`GenerationArtifact not found: ${id}`);
      }

      const entity = applyPatch(current, input);
      entity.updatedAt = getNowTimestamp();
      entity.updatedByUserId = input.updatedByUserId ?? current.updatedByUserId ?? null;
      await db.update(generationArtifactsTable).set(buildGenerationArtifactRow(entity)).where(eq(generationArtifactsTable.id, id));
      return entity;
    },
    async archive(id, updatedByUserId) {
      const current = await this.getById(id);
      if (!current) {
        throw new Error(`GenerationArtifact not found: ${id}`);
      }

      const entity = applyPatch(current, {
        metadata: {
          ...(current.metadata ?? {}),
          archivedAt: getNowTimestamp(),
        },
        updatedByUserId,
      } as UpdateGenerationArtifactInput);
      entity.updatedAt = getNowTimestamp();
      await db.update(generationArtifactsTable).set(buildGenerationArtifactRow(entity)).where(eq(generationArtifactsTable.id, id));
      return entity;
    },
  };
}

function createArtifactRelationRepository(db: ReturnType<typeof getDatabaseClient>): ArtifactRelationRepository {
  async function createRelation(input: CreateArtifactRelationInput): Promise<ArtifactRelation> {
    const now = getNowTimestamp();
    const entity: ArtifactRelation = {
      id: createEntityId('relation'),
      projectId: input.projectId,
      upstreamArtifactId: input.upstreamArtifactId,
      downstreamArtifactId: input.downstreamArtifactId,
      relationType: input.relationType ?? 'derived_from',
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
      createdByUserId: input.createdByUserId ?? null,
      updatedByUserId: input.createdByUserId ?? null,
    };
    await db.insert(artifactRelationsTable).values(buildArtifactRelationRow(entity));
    return entity;
  }

  return {
    async getById(id) {
      return selectOne<ArtifactRelation>(
        db.select({ data: artifactRelationsTable.data }).from(artifactRelationsTable).where(eq(artifactRelationsTable.id, id))
      );
    },
    async create(input: CreateArtifactRelationInput) {
      return createRelation(input);
    },
    async createMany(inputs: CreateArtifactRelationInput[]) {
      const created: ArtifactRelation[] = [];
      for (const input of inputs) {
        created.push(await createRelation(input));
      }
      return created;
    },
    async listByProjectId(projectId: string) {
      return selectMany<ArtifactRelation>(
        db.select({ data: artifactRelationsTable.data }).from(artifactRelationsTable).where(eq(artifactRelationsTable.projectId, projectId))
      );
    },
    async listByDownstreamArtifactId(downstreamArtifactId: string) {
      return selectMany<ArtifactRelation>(
        db.select({ data: artifactRelationsTable.data }).from(artifactRelationsTable).where(eq(artifactRelationsTable.downstreamArtifactId, downstreamArtifactId))
      );
    },
  };
}

function createUsageEventRepository(db: ReturnType<typeof getDatabaseClient>): UsageEventRepository {
  return {
    async getById(id) {
      return selectOne<UsageEvent>(db.select({ data: usageEventsTable.data }).from(usageEventsTable).where(eq(usageEventsTable.id, id)));
    },
    async listByOrganizationId(organizationId) {
      return selectMany<UsageEvent>(
        db.select({ data: usageEventsTable.data }).from(usageEventsTable).where(eq(usageEventsTable.organizationId, organizationId))
      );
    },
    async listByWorkspaceId(workspaceId) {
      return selectMany<UsageEvent>(
        db.select({ data: usageEventsTable.data }).from(usageEventsTable).where(eq(usageEventsTable.workspaceId, workspaceId))
      );
    },
    async append(input) {
      const now = getNowTimestamp();
      const entity: UsageEvent = {
        id: createEntityId('usage'),
        organizationId: input.organizationId,
        workspaceId: input.workspaceId ?? null,
        projectId: input.projectId ?? null,
        generationJobId: input.generationJobId ?? null,
        userId: input.userId ?? null,
        kind: input.kind,
        featureKey: input.featureKey,
        modelName: input.modelName ?? null,
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        costCents: input.costCents ?? null,
        quantity: input.quantity ?? null,
        occurredAt: input.occurredAt ?? now,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
      };
      await db.insert(usageEventsTable).values(buildUsageEventRow(entity));
      return entity;
    },
    async summarizeUsage(organizationId, from, to) {
      const events = await this.listByOrganizationId(organizationId);
      const filtered = events.filter((event) => {
        if (from && event.occurredAt < from) {
          return false;
        }
        if (to && event.occurredAt > to) {
          return false;
        }
        return true;
      });
      return {
        organizationId,
        totalEvents: filtered.length,
        totalTokens: filtered.reduce((sum, event) => sum + (event.inputTokens ?? 0) + (event.outputTokens ?? 0), 0),
        totalCostCents: filtered.reduce((sum, event) => sum + (event.costCents ?? 0), 0),
      };
    },
  };
}

function createSubscriptionRepository(db: ReturnType<typeof getDatabaseClient>): SubscriptionRepository {
  return {
    async getById(id) {
      return selectOne<Subscription>(db.select({ data: subscriptionsTable.data }).from(subscriptionsTable).where(eq(subscriptionsTable.id, id)));
    },
    async getCurrentByOrganizationId(organizationId) {
      return selectOne<Subscription>(
        db.select({ data: subscriptionsTable.data }).from(subscriptionsTable).where(eq(subscriptionsTable.organizationId, organizationId))
      );
    },
    async listByOrganizationId(organizationId) {
      return selectMany<Subscription>(
        db.select({ data: subscriptionsTable.data }).from(subscriptionsTable).where(eq(subscriptionsTable.organizationId, organizationId))
      );
    },
    async create(input) {
      const now = getNowTimestamp();
      const entity: Subscription = {
        id: createEntityId('sub'),
        organizationId: input.organizationId,
        provider: input.provider,
        providerCustomerId: input.providerCustomerId ?? null,
        providerSubscriptionId: input.providerSubscriptionId ?? null,
        providerPriceId: input.providerPriceId ?? null,
        planKey: input.planKey,
        status: input.status,
        billingInterval: input.billingInterval,
        currentPeriodStart: input.currentPeriodStart ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
        seatsIncluded: input.seatsIncluded ?? null,
        seatCount: input.seatCount ?? null,
        entitlements: input.entitlements,
        priceCents: input.priceCents ?? null,
        currency: input.currency ?? null,
        trialEndsAt: input.trialEndsAt ?? null,
        canceledAt: input.canceledAt ?? null,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
      };
      await db.insert(subscriptionsTable).values(buildSubscriptionRow(entity));
      return entity;
    },
    async update(id, input) {
      const current = await this.getById(id);
      if (!current) {
        throw new Error(`Subscription not found: ${id}`);
      }

      const entity = applyPatch(current, input);
      entity.updatedAt = getNowTimestamp();
      entity.updatedByUserId = input.updatedByUserId ?? current.updatedByUserId ?? null;
      await db.update(subscriptionsTable).set(buildSubscriptionRow(entity)).where(eq(subscriptionsTable.id, id));
      return entity;
    },
    async upsertCurrent(organizationId, input) {
      const current = await this.getCurrentByOrganizationId(organizationId);
      if (current) {
        return this.update(current.id, {
          ...input,
          updatedByUserId: input.createdByUserId ?? null,
        });
      }

      return this.create(input as CreateSubscriptionInput);
    },
  };
}

function createPaymentOrderRepository(db: ReturnType<typeof getDatabaseClient>): PaymentOrderRepository {
  return {
    async getById(id) {
      return selectOne<PaymentOrder>(db.select({ data: paymentOrdersTable.data }).from(paymentOrdersTable).where(eq(paymentOrdersTable.id, id)));
    },
    async getByProviderOrderId(providerOrderId) {
      return selectOne<PaymentOrder>(
        db.select({ data: paymentOrdersTable.data }).from(paymentOrdersTable).where(eq(paymentOrdersTable.providerOrderId, providerOrderId))
      );
    },
    async listByOrganizationId(organizationId) {
      return selectMany<PaymentOrder>(
        db.select({ data: paymentOrdersTable.data }).from(paymentOrdersTable).where(eq(paymentOrdersTable.organizationId, organizationId))
      );
    },
    async create(input) {
      const now = getNowTimestamp();
      const entity: PaymentOrder = {
        id: createEntityId('pay'),
        organizationId: input.organizationId,
        subscriptionId: input.subscriptionId ?? null,
        provider: input.provider,
        purchaseKind: input.purchaseKind,
        status: input.status ?? 'pending',
        planKey: input.planKey ?? null,
        creditPackKey: input.creditPackKey ?? null,
        amountCents: input.amountCents,
        currency: input.currency,
        creditsGranted: input.creditsGranted ?? null,
        providerOrderId: input.providerOrderId ?? null,
        providerCustomerId: input.providerCustomerId ?? null,
        providerSubscriptionId: input.providerSubscriptionId ?? null,
        paidAt: input.paidAt ?? null,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
      };
      await db.insert(paymentOrdersTable).values(buildPaymentOrderRow(entity));
      return entity;
    },
    async update(id, input) {
      const current = await this.getById(id);
      if (!current) {
        throw new Error(`PaymentOrder not found: ${id}`);
      }

      const entity = applyPatch(current, input);
      entity.updatedAt = getNowTimestamp();
      entity.updatedByUserId = input.updatedByUserId ?? current.updatedByUserId ?? null;
      await db.update(paymentOrdersTable).set(buildPaymentOrderRow(entity)).where(eq(paymentOrdersTable.id, id));
      return entity;
    },
  };
}

function createCreditAccountRepository(db: ReturnType<typeof getDatabaseClient>): CreditAccountRepository {
  return {
    async getById(id) {
      return selectOne<CreditAccount>(db.select({ data: creditAccountsTable.data }).from(creditAccountsTable).where(eq(creditAccountsTable.id, id)));
    },
    async getByOrganizationId(organizationId) {
      return selectOne<CreditAccount>(
        db.select({ data: creditAccountsTable.data }).from(creditAccountsTable).where(eq(creditAccountsTable.organizationId, organizationId))
      );
    },
    async create(input) {
      const now = getNowTimestamp();
      const entity: CreditAccount = {
        id: createEntityId('credit'),
        organizationId: input.organizationId,
        availableCredits: input.availableCredits ?? 0,
        reservedCredits: input.reservedCredits ?? 0,
        grantedCreditsTotal: input.grantedCreditsTotal ?? 0,
        consumedCreditsTotal: input.consumedCreditsTotal ?? 0,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
      };
      await db.insert(creditAccountsTable).values(buildCreditAccountRow(entity));
      return entity;
    },
    async update(id, input) {
      const current = await this.getById(id);
      if (!current) {
        throw new Error(`CreditAccount not found: ${id}`);
      }

      const entity = applyPatch(current, input);
      entity.updatedAt = getNowTimestamp();
      entity.updatedByUserId = input.updatedByUserId ?? current.updatedByUserId ?? null;
      await db.update(creditAccountsTable).set(buildCreditAccountRow(entity)).where(eq(creditAccountsTable.id, id));
      return entity;
    },
  };
}

function createCreditLedgerRepository(db: ReturnType<typeof getDatabaseClient>): CreditLedgerRepository {
  return {
    async getById(id) {
      return selectOne<CreditLedgerEntry>(
        db.select({ data: creditLedgerEntriesTable.data }).from(creditLedgerEntriesTable).where(eq(creditLedgerEntriesTable.id, id))
      );
    },
    async listByOrganizationId(organizationId) {
      return selectMany<CreditLedgerEntry>(
        db.select({ data: creditLedgerEntriesTable.data }).from(creditLedgerEntriesTable).where(eq(creditLedgerEntriesTable.organizationId, organizationId))
      );
    },
    async listByGenerationJobId(generationJobId) {
      return selectMany<CreditLedgerEntry>(
        db.select({ data: creditLedgerEntriesTable.data }).from(creditLedgerEntriesTable).where(eq(creditLedgerEntriesTable.generationJobId, generationJobId))
      );
    },
    async append(input) {
      const now = getNowTimestamp();
      const entity: CreditLedgerEntry = {
        id: createEntityId('ledger'),
        organizationId: input.organizationId,
        creditAccountId: input.creditAccountId,
        kind: input.kind,
        deltaCredits: input.deltaCredits,
        balanceAfter: input.balanceAfter,
        paymentOrderId: input.paymentOrderId ?? null,
        generationJobId: input.generationJobId ?? null,
        redeemCodeId: input.redeemCodeId ?? null,
        note: input.note ?? null,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
      };
      await db.insert(creditLedgerEntriesTable).values(buildCreditLedgerRow(entity));
      return entity;
    },
  };
}

function createRedeemCodeCampaignRepository(db: ReturnType<typeof getDatabaseClient>): RedeemCodeCampaignRepository {
  return {
    async getById(id) {
      return selectOne<RedeemCodeCampaign>(
        db.select({ data: redeemCodeCampaignsTable.data }).from(redeemCodeCampaignsTable).where(eq(redeemCodeCampaignsTable.id, id))
      );
    },
    async list() {
      return selectMany<RedeemCodeCampaign>(db.select({ data: redeemCodeCampaignsTable.data }).from(redeemCodeCampaignsTable));
    },
    async create(input) {
      const now = getNowTimestamp();
      const entity: RedeemCodeCampaign = {
        id: createEntityId('campaign'),
        organizationId: input.organizationId ?? null,
        name: input.name,
        description: input.description ?? null,
        status: input.status ?? 'draft',
        creditsGranted: input.creditsGranted,
        codePrefix: input.codePrefix ?? null,
        totalLimit: input.totalLimit ?? null,
        perOrganizationLimit: input.perOrganizationLimit ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        eligiblePlanKeys: input.eligiblePlanKeys ?? null,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
      };
      await db.insert(redeemCodeCampaignsTable).values(buildRedeemCodeCampaignRow(entity));
      return entity;
    },
    async update(id, input) {
      const current = await this.getById(id);
      if (!current) {
        throw new Error(`RedeemCodeCampaign not found: ${id}`);
      }

      const entity = applyPatch(current, input);
      entity.updatedAt = getNowTimestamp();
      entity.updatedByUserId = input.updatedByUserId ?? current.updatedByUserId ?? null;
      await db.update(redeemCodeCampaignsTable).set(buildRedeemCodeCampaignRow(entity)).where(eq(redeemCodeCampaignsTable.id, id));
      return entity;
    },
  };
}

function createRedeemCodeRepository(db: ReturnType<typeof getDatabaseClient>): RedeemCodeRepository {
  return {
    async getById(id) {
      return selectOne<RedeemCode>(db.select({ data: redeemCodesTable.data }).from(redeemCodesTable).where(eq(redeemCodesTable.id, id)));
    },
    async getByCode(code) {
      return selectOne<RedeemCode>(
        db.select({ data: redeemCodesTable.data }).from(redeemCodesTable).where(eq(redeemCodesTable.code, normalizeRedeemCode(code)))
      );
    },
    async listByCampaignId(campaignId) {
      return selectMany<RedeemCode>(db.select({ data: redeemCodesTable.data }).from(redeemCodesTable).where(eq(redeemCodesTable.campaignId, campaignId)));
    },
    async create(input) {
      const now = getNowTimestamp();
      const entity: RedeemCode = {
        id: createEntityId('rcode'),
        campaignId: input.campaignId,
        code: normalizeRedeemCode(input.code),
        status: input.status ?? 'active',
        creditsGranted: input.creditsGranted,
        maxRedemptions: input.maxRedemptions ?? 1,
        redeemedCount: 0,
        expiresAt: input.expiresAt ?? null,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
      };
      await db.insert(redeemCodesTable).values(buildRedeemCodeRow(entity));
      return entity;
    },
    async update(id, input) {
      const current = await this.getById(id);
      if (!current) {
        throw new Error(`RedeemCode not found: ${id}`);
      }

      const entity = applyPatch(current, input);
      entity.updatedAt = getNowTimestamp();
      entity.updatedByUserId = input.updatedByUserId ?? current.updatedByUserId ?? null;
      await db.update(redeemCodesTable).set(buildRedeemCodeRow(entity)).where(eq(redeemCodesTable.id, id));
      return entity;
    },
  };
}

function createRedeemCodeRedemptionRepository(db: ReturnType<typeof getDatabaseClient>): RedeemCodeRedemptionRepository {
  return {
    async getById(id) {
      return selectOne<RedeemCodeRedemption>(
        db.select({ data: redeemCodeRedemptionsTable.data }).from(redeemCodeRedemptionsTable).where(eq(redeemCodeRedemptionsTable.id, id))
      );
    },
    async listByOrganizationId(organizationId) {
      return selectMany<RedeemCodeRedemption>(
        db.select({ data: redeemCodeRedemptionsTable.data }).from(redeemCodeRedemptionsTable).where(eq(redeemCodeRedemptionsTable.organizationId, organizationId))
      );
    },
    async listByRedeemCodeId(redeemCodeId) {
      return selectMany<RedeemCodeRedemption>(
        db.select({ data: redeemCodeRedemptionsTable.data }).from(redeemCodeRedemptionsTable).where(eq(redeemCodeRedemptionsTable.redeemCodeId, redeemCodeId))
      );
    },
    async create(input) {
      const now = getNowTimestamp();
      const entity: RedeemCodeRedemption = {
        id: createEntityId('redeem'),
        redeemCodeId: input.redeemCodeId,
        campaignId: input.campaignId,
        organizationId: input.organizationId,
        userId: input.userId,
        creditLedgerEntryId: input.creditLedgerEntryId,
        redeemedAt: input.redeemedAt ?? now,
        createdAt: now,
        updatedAt: now,
        createdByUserId: input.createdByUserId ?? null,
        updatedByUserId: input.createdByUserId ?? null,
      };
      await db.insert(redeemCodeRedemptionsTable).values(buildRedeemCodeRedemptionRow(entity));
      return entity;
    },
  };
}

function selectOne<T>(rowsPromise: Promise<Array<{ data: T }>>): Promise<T | null> {
  return rowsPromise.then((rows) => rows[0]?.data ?? null);
}

function selectMany<T>(rowsPromise: Promise<Array<{ data: T }>>): Promise<T[]> {
  return rowsPromise.then((rows) => rows.map((row) => row.data));
}

function applyPatch<T extends object>(current: T, patch: Partial<T>): T {
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      next[key as keyof T] = value as T[keyof T];
    }
  }
  return next;
}

function normalizeRedeemCode(code: string): string {
  return code.trim().toUpperCase();
}

function buildUserRow(entity: User, includeData = true): any {
  const row: Record<string, unknown> = {
    ...entity,
    passwordHash: entity.passwordHash ?? null,
    avatarUrl: entity.avatarUrl ?? null,
    preferredLocale: entity.preferredLocale ?? null,
    defaultOrganizationId: entity.defaultOrganizationId ?? null,
    lastLoginAt: entity.lastLoginAt ?? null,
    createdByUserId: entity.createdByUserId ?? null,
    updatedByUserId: entity.updatedByUserId ?? null,
  };

  if (includeData) {
    row.data = entity;
  }

  return row;
}

function mapUserRow(row: {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string | null;
  avatarUrl: string | null;
  preferredLocale: string | null;
  defaultOrganizationId: string | null;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  createdByUserId: string | null;
  updatedAt: string;
  updatedByUserId: string | null;
}): User {
  const preferredLocale = row.preferredLocale === 'en-US' || row.preferredLocale === 'zh-CN' ? row.preferredLocale : 'zh-CN';

  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    passwordHash: row.passwordHash ?? null,
    avatarUrl: row.avatarUrl ?? null,
    preferredLocale,
    defaultOrganizationId: row.defaultOrganizationId ?? null,
    status: row.status as User['status'],
    lastLoginAt: row.lastLoginAt ?? null,
    createdAt: row.createdAt,
    createdByUserId: row.createdByUserId ?? null,
    updatedAt: row.updatedAt,
    updatedByUserId: row.updatedByUserId ?? null,
  };
}

async function withOptionalUsersDataColumn<T>(operation: (includeData: boolean) => Promise<T>): Promise<T> {
  try {
    return await operation(true);
  } catch (error) {
    if (!isMissingUsersDataColumnError(error)) {
      throw error;
    }
    return operation(false);
  }
}

function isMissingUsersDataColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lower = message.toLowerCase();
  return lower.includes('column') && lower.includes('data') && lower.includes('users') && lower.includes('exist');
}

function buildOrganizationRow(entity: Organization): any {
  return {
    ...entity,
    metadata: entity.metadata ?? undefined,
    createdByUserId: entity.createdByUserId ?? null,
    updatedByUserId: entity.updatedByUserId ?? null,
    data: entity,
  };
}

function buildWorkspaceRow(entity: Workspace): any {
  return {
    ...entity,
    description: entity.description ?? null,
    defaultLocale: entity.defaultLocale ?? null,
    defaultModelName: entity.defaultModelName ?? null,
    createdByUserId: entity.createdByUserId ?? null,
    updatedByUserId: entity.updatedByUserId ?? null,
    data: entity,
  };
}

function buildProjectRow(entity: Project): any {
  return {
    ...entity,
    description: entity.description ?? null,
    sourceDocumentId: entity.sourceDocumentId ?? null,
    latestGenerationJobId: entity.latestGenerationJobId ?? null,
    genre: entity.genre ?? null,
    labels: entity.labels ?? null,
    archivedAt: entity.archivedAt ?? null,
    createdByUserId: entity.createdByUserId ?? null,
    updatedByUserId: entity.updatedByUserId ?? null,
    data: entity,
  };
}

function buildSourceDocumentRow(entity: SourceDocument): any {
  return {
    ...entity,
    textContent: entity.textContent ?? null,
    storageKey: entity.storageKey ?? null,
    checksum: entity.checksum ?? null,
    wordCount: entity.wordCount ?? null,
    sourceVersion: entity.sourceVersion ?? null,
    createdByUserId: entity.createdByUserId ?? null,
    updatedByUserId: entity.updatedByUserId ?? null,
    data: entity,
  };
}

function buildGenerationJobRow(entity: GenerationJob): any {
  return {
    ...entity,
    sourceDocumentId: entity.sourceDocumentId ?? null,
    reservedCredits: entity.reservedCredits ?? null,
    settledCredits: entity.settledCredits ?? null,
    currentStep: entity.currentStep ?? null,
    requestedByUserId: entity.requestedByUserId ?? null,
    requestedBySessionId: entity.requestedBySessionId ?? null,
    modelName: entity.modelName ?? null,
    outputSummary: entity.outputSummary ?? null,
    errorMessage: entity.errorMessage ?? null,
    startedAt: entity.startedAt ?? null,
    finishedAt: entity.finishedAt ?? null,
    cancelledAt: entity.cancelledAt ?? null,
    createdByUserId: entity.createdByUserId ?? null,
    updatedByUserId: entity.updatedByUserId ?? null,
    data: entity,
  };
}

function buildGenerationArtifactRow(entity: GenerationArtifact): any {
  return {
    ...entity,
    sourceDocumentId: entity.sourceDocumentId ?? null,
    content: entity.content ?? null,
    storageKey: entity.storageKey ?? null,
    checksum: entity.checksum ?? null,
    isEditable: entity.isEditable ?? true,
    parentArtifactId: entity.parentArtifactId ?? null,
    versionGroupId: entity.versionGroupId ?? null,
    metadata: entity.metadata ?? undefined,
    createdByUserId: entity.createdByUserId ?? null,
    updatedByUserId: entity.updatedByUserId ?? null,
    data: entity,
  };
}

function buildArtifactRelationRow(entity: ArtifactRelation): any {
  return {
    ...entity,
    metadata: entity.metadata ?? undefined,
    createdByUserId: entity.createdByUserId ?? null,
    updatedByUserId: entity.updatedByUserId ?? null,
    data: entity,
  };
}

function buildUsageEventRow(entity: UsageEvent): any {
  return {
    ...entity,
    workspaceId: entity.workspaceId ?? null,
    projectId: entity.projectId ?? null,
    generationJobId: entity.generationJobId ?? null,
    userId: entity.userId ?? null,
    modelName: entity.modelName ?? null,
    inputTokens: entity.inputTokens ?? null,
    outputTokens: entity.outputTokens ?? null,
    costCents: entity.costCents ?? null,
    quantity: entity.quantity ?? null,
    metadata: entity.metadata ?? undefined,
    createdByUserId: entity.createdByUserId ?? null,
    updatedByUserId: entity.updatedByUserId ?? null,
    data: entity,
  };
}

function buildSubscriptionRow(entity: Subscription): any {
  return {
    ...entity,
    providerCustomerId: entity.providerCustomerId ?? null,
    providerSubscriptionId: entity.providerSubscriptionId ?? null,
    providerPriceId: entity.providerPriceId ?? null,
    currentPeriodStart: entity.currentPeriodStart ?? null,
    currentPeriodEnd: entity.currentPeriodEnd ?? null,
    seatsIncluded: entity.seatsIncluded ?? null,
    seatCount: entity.seatCount ?? null,
    priceCents: entity.priceCents ?? null,
    currency: entity.currency ?? null,
    trialEndsAt: entity.trialEndsAt ?? null,
    canceledAt: entity.canceledAt ?? null,
    createdByUserId: entity.createdByUserId ?? null,
    updatedByUserId: entity.updatedByUserId ?? null,
    data: entity,
  };
}

function buildPaymentOrderRow(entity: PaymentOrder): any {
  return {
    ...entity,
    subscriptionId: entity.subscriptionId ?? null,
    planKey: entity.planKey ?? null,
    creditPackKey: entity.creditPackKey ?? null,
    creditsGranted: entity.creditsGranted ?? null,
    providerOrderId: entity.providerOrderId ?? null,
    providerCustomerId: entity.providerCustomerId ?? null,
    providerSubscriptionId: entity.providerSubscriptionId ?? null,
    paidAt: entity.paidAt ?? null,
    metadata: entity.metadata ?? undefined,
    createdByUserId: entity.createdByUserId ?? null,
    updatedByUserId: entity.updatedByUserId ?? null,
    data: entity,
  };
}

function buildCreditAccountRow(entity: CreditAccount): any {
  return {
    ...entity,
    createdByUserId: entity.createdByUserId ?? null,
    updatedByUserId: entity.updatedByUserId ?? null,
    data: entity,
  };
}

function buildCreditLedgerRow(entity: CreditLedgerEntry): any {
  return {
    ...entity,
    paymentOrderId: entity.paymentOrderId ?? null,
    generationJobId: entity.generationJobId ?? null,
    redeemCodeId: entity.redeemCodeId ?? null,
    note: entity.note ?? null,
    metadata: entity.metadata ?? undefined,
    createdByUserId: entity.createdByUserId ?? null,
    updatedByUserId: entity.updatedByUserId ?? null,
    data: entity,
  };
}

function buildRedeemCodeCampaignRow(entity: RedeemCodeCampaign): any {
  return {
    ...entity,
    organizationId: entity.organizationId ?? null,
    description: entity.description ?? null,
    metadata: undefined,
    codePrefix: entity.codePrefix ?? null,
    totalLimit: entity.totalLimit ?? null,
    perOrganizationLimit: entity.perOrganizationLimit ?? null,
    startsAt: entity.startsAt ?? null,
    endsAt: entity.endsAt ?? null,
    eligiblePlanKeys: entity.eligiblePlanKeys ?? null,
    createdByUserId: entity.createdByUserId ?? null,
    updatedByUserId: entity.updatedByUserId ?? null,
    data: entity,
  };
}

function buildRedeemCodeRow(entity: RedeemCode): any {
  return {
    ...entity,
    expiresAt: entity.expiresAt ?? null,
    metadata: entity.metadata ?? undefined,
    createdByUserId: entity.createdByUserId ?? null,
    updatedByUserId: entity.updatedByUserId ?? null,
    data: entity,
  };
}

function buildRedeemCodeRedemptionRow(entity: RedeemCodeRedemption): any {
  return {
    ...entity,
    createdByUserId: entity.createdByUserId ?? null,
    updatedByUserId: entity.updatedByUserId ?? null,
    data: entity,
  };
}
