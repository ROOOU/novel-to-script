import type {
  ArtifactRelation,
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
import {
  createEntityId,
  getNowTimestamp,
  readPlatformStore,
  updatePlatformStore,
} from './file-store';

export interface PersistentPlatformRuntime {
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
}

export function createPersistentPlatformRuntime(): PersistentPlatformRuntime {
  return {
    users: createUserRepository(),
    organizations: createOrganizationRepository(),
    workspaces: createWorkspaceRepository(),
    projects: createProjectRepository(),
    sourceDocuments: createSourceDocumentRepository(),
    generationJobs: createGenerationJobRepository(),
    generationArtifacts: createGenerationArtifactRepository(),
    artifactRelations: createArtifactRelationRepository(),
    usageEvents: createUsageEventRepository(),
    subscriptions: createSubscriptionRepository(),
    paymentOrders: createPaymentOrderRepository(),
    creditAccounts: createCreditAccountRepository(),
    creditLedger: createCreditLedgerRepository(),
    redeemCodeCampaigns: createRedeemCodeCampaignRepository(),
    redeemCodes: createRedeemCodeRepository(),
    redeemCodeRedemptions: createRedeemCodeRedemptionRepository(),
  };
}

function createUserRepository(): UserRepository {
  return {
    async getById(id) {
      const store = await readPlatformStore();
      return store.users.find((user) => user.id === id) ?? null;
    },
    async getByEmail(email) {
      const normalizedEmail = email.trim().toLowerCase();
      const store = await readPlatformStore();
      return store.users.find((user) => user.email.toLowerCase() === normalizedEmail) ?? null;
    },
    async getByAuthUserId(authUserId) {
      const normalizedAuthUserId = authUserId.trim();
      const store = await readPlatformStore();
      return store.users.find((user) => user.authUserId === normalizedAuthUserId) ?? null;
    },
    async listByIds(ids) {
      const idSet = new Set(ids);
      const store = await readPlatformStore();
      return store.users.filter((user) => idSet.has(user.id));
    },
    async create(input) {
      return updatePlatformStore(async (store) => {
        const now = getNowTimestamp();
        const entity: User = {
          id: createEntityId('user'),
          email: input.email.trim().toLowerCase(),
          displayName: input.displayName.trim(),
          authProvider: input.authProvider ?? null,
          authUserId: input.authUserId ?? null,
          passwordHash: input.passwordHash ?? null,
          avatarUrl: input.avatarUrl ?? null,
          preferredLocale: input.preferredLocale ?? 'zh-CN',
          defaultOrganizationId: input.defaultOrganizationId ?? null,
          status: input.status ?? 'active',
          emailVerifiedAt: input.emailVerifiedAt ?? null,
          lastAuthSyncAt: input.lastAuthSyncAt ?? null,
          lastLoginAt: null,
          createdAt: now,
          updatedAt: now,
          createdByUserId: input.createdByUserId ?? null,
          updatedByUserId: input.createdByUserId ?? null,
        };
        store.users.push(entity);
        return entity;
      });
    },
    async update(id, input) {
      return updateEntity<User, UpdateUserInput>('User', 'users', id, input);
    },
  };
}

function createOrganizationRepository(): OrganizationRepository {
  return {
    async getById(id) {
      const store = await readPlatformStore();
      return store.organizations.find((organization) => organization.id === id) ?? null;
    },
    async getBySlug(slug) {
      const store = await readPlatformStore();
      return store.organizations.find((organization) => organization.slug === slug) ?? null;
    },
    async listByOwnerUserId(userId) {
      const store = await readPlatformStore();
      return store.organizations.filter((organization) => organization.ownerUserId === userId);
    },
    async create(input) {
      return updatePlatformStore(async (store) => {
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
        store.organizations.push(entity);
        return entity;
      });
    },
    async update(id, input) {
      return updateEntity<Organization, UpdateOrganizationInput>('Organization', 'organizations', id, input);
    },
  };
}

function createWorkspaceRepository(): WorkspaceRepository {
  return {
    async getById(id) {
      const store = await readPlatformStore();
      return store.workspaces.find((workspace) => workspace.id === id) ?? null;
    },
    async getBySlug(organizationId, slug) {
      const store = await readPlatformStore();
      return store.workspaces.find((workspace) => workspace.organizationId === organizationId && workspace.slug === slug) ?? null;
    },
    async listByOrganizationId(organizationId) {
      const store = await readPlatformStore();
      return store.workspaces.filter((workspace) => workspace.organizationId === organizationId);
    },
    async create(input) {
      return updatePlatformStore(async (store) => {
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
        store.workspaces.push(entity);
        return entity;
      });
    },
    async update(id, input) {
      return updateEntity<Workspace, UpdateWorkspaceInput>('Workspace', 'workspaces', id, input);
    },
    async archive(id, updatedByUserId) {
      return updateEntity<Workspace, UpdateWorkspaceInput>('Workspace', 'workspaces', id, {
        status: 'archived',
        updatedByUserId,
      });
    },
  };
}

function createProjectRepository(): ProjectRepository {
  return {
    async getById(id) {
      const store = await readPlatformStore();
      return store.projects.find((project) => project.id === id) ?? null;
    },
    async getBySlug(workspaceId, slug) {
      const store = await readPlatformStore();
      return store.projects.find((project) => project.workspaceId === workspaceId && project.slug === slug) ?? null;
    },
    async listByWorkspaceId(workspaceId) {
      const store = await readPlatformStore();
      return store.projects.filter((project) => project.workspaceId === workspaceId);
    },
    async listByOrganizationId(organizationId) {
      const store = await readPlatformStore();
      return store.projects.filter((project) => project.organizationId === organizationId);
    },
    async findBySourceDocumentId(sourceDocumentId) {
      const store = await readPlatformStore();
      return store.projects.find((project) => project.sourceDocumentId === sourceDocumentId) ?? null;
    },
    async create(input) {
      return updatePlatformStore(async (store) => {
        const now = getNowTimestamp();
        const entity: Project = {
          id: createEntityId('project'),
          organizationId: input.organizationId,
          workspaceId: input.workspaceId,
          slug: input.slug,
          name: input.name,
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
        store.projects.push(entity);
        return entity;
      });
    },
    async update(id, input) {
      return updateEntity<Project, UpdateProjectInput>('Project', 'projects', id, input);
    },
    async archive(id, updatedByUserId) {
      return updateEntity<Project, UpdateProjectInput>('Project', 'projects', id, {
        status: 'archived',
        archivedAt: getNowTimestamp(),
        updatedByUserId,
      });
    },
  };
}

function createSourceDocumentRepository(): SourceDocumentRepository {
  return {
    async getById(id) {
      const store = await readPlatformStore();
      return store.sourceDocuments.find((document) => document.id === id) ?? null;
    },
    async listByProjectId(projectId) {
      const store = await readPlatformStore();
      return store.sourceDocuments.filter((document) => document.projectId === projectId);
    },
    async listByWorkspaceId(workspaceId) {
      const store = await readPlatformStore();
      return store.sourceDocuments.filter((document) => document.workspaceId === workspaceId);
    },
    async create(input) {
      return updatePlatformStore(async (store) => {
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
        store.sourceDocuments.push(entity);
        return entity;
      });
    },
    async update(id, input) {
      return updateEntity<SourceDocument, UpdateSourceDocumentInput>('SourceDocument', 'sourceDocuments', id, input);
    },
    async archive(id, updatedByUserId) {
      return updateEntity<SourceDocument, UpdateSourceDocumentInput>('SourceDocument', 'sourceDocuments', id, {
        status: 'archived',
        updatedByUserId,
      });
    },
  };
}

function createGenerationJobRepository(): GenerationJobRepository {
  return {
    async getById(id) {
      const store = await readPlatformStore();
      return store.generationJobs.find((job) => job.id === id) ?? null;
    },
    async listByProjectId(projectId) {
      const store = await readPlatformStore();
      return store.generationJobs.filter((job) => job.projectId === projectId);
    },
    async listByWorkspaceId(workspaceId) {
      const store = await readPlatformStore();
      return store.generationJobs.filter((job) => job.workspaceId === workspaceId);
    },
    async listActiveByWorkspaceId(workspaceId) {
      const store = await readPlatformStore();
      return store.generationJobs.filter((job) => {
        return job.workspaceId === workspaceId && (job.status === 'queued' || job.status === 'running');
      });
    },
    async create(input) {
      return updatePlatformStore(async (store) => {
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
        store.generationJobs.push(entity);
        return entity;
      });
    },
    async update(id, input) {
      return updateEntity<GenerationJob, UpdateGenerationJobInput>('GenerationJob', 'generationJobs', id, input);
    },
    async markQueued(id, updatedByUserId) {
      return updateEntity<GenerationJob, UpdateGenerationJobInput>('GenerationJob', 'generationJobs', id, {
        status: 'queued',
        updatedByUserId,
      });
    },
    async markRunning(id, startedAt, updatedByUserId) {
      return updateEntity<GenerationJob, UpdateGenerationJobInput>('GenerationJob', 'generationJobs', id, {
        status: 'running',
        startedAt: startedAt ?? getNowTimestamp(),
        updatedByUserId,
      });
    },
    async markSucceeded(id, input) {
      return updateEntity<GenerationJob, UpdateGenerationJobInput>('GenerationJob', 'generationJobs', id, {
        ...input,
        status: 'succeeded',
        finishedAt: input.finishedAt ?? getNowTimestamp(),
      });
    },
    async markFailed(id, input) {
      return updateEntity<GenerationJob, UpdateGenerationJobInput>('GenerationJob', 'generationJobs', id, {
        ...input,
        status: 'failed',
        finishedAt: input.finishedAt ?? getNowTimestamp(),
      });
    },
    async cancel(id, cancelledAt, updatedByUserId) {
      return updateEntity<GenerationJob, UpdateGenerationJobInput>('GenerationJob', 'generationJobs', id, {
        status: 'cancelled',
        cancelledAt: cancelledAt ?? getNowTimestamp(),
        updatedByUserId,
      });
    },
  };
}

function createGenerationArtifactRepository(): GenerationArtifactRepository {
  return {
    async getById(id) {
      const store = await readPlatformStore();
      return store.generationArtifacts.find((artifact) => artifact.id === id) ?? null;
    },
    async listByJobId(generationJobId) {
      const store = await readPlatformStore();
      return store.generationArtifacts.filter((artifact) => artifact.generationJobId === generationJobId);
    },
    async listByProjectId(projectId) {
      const store = await readPlatformStore();
      return store.generationArtifacts.filter((artifact) => artifact.projectId === projectId);
    },
    async getLatestByKind(projectId, kind) {
      const store = await readPlatformStore();
      return store.generationArtifacts
        .filter((artifact) => artifact.projectId === projectId && artifact.kind === kind)
        .sort((left, right) => right.version - left.version)[0] ?? null;
    },
    async create(input) {
      return updatePlatformStore(async (store) => {
        const now = getNowTimestamp();
        const nextVersion =
          input.version ??
          Math.max(
            0,
            ...store.generationArtifacts
              .filter((artifact) => artifact.projectId === input.projectId && artifact.kind === input.kind)
              .map((artifact) => artifact.version)
          ) + 1;
        const versionGroupId = input.versionGroupId ?? input.parentArtifactId ?? createEntityId('vgrp');
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
          versionGroupId,
          metadata: input.metadata,
          createdAt: now,
          updatedAt: now,
          createdByUserId: input.createdByUserId ?? null,
          updatedByUserId: input.createdByUserId ?? null,
        };
        store.generationArtifacts.push(entity);
        return entity;
      });
    },
    async update(id, input) {
      return updatePlatformStore(async (store) => {
        const artifact = store.generationArtifacts.find((entry) => entry.id === id);
        if (!artifact) {
          throw new Error(`GenerationArtifact not found: ${id}`);
        }
        artifact.title = input.title ?? artifact.title;
        artifact.content = input.content ?? artifact.content;
        artifact.storageKey = input.storageKey ?? artifact.storageKey;
        artifact.checksum = input.checksum ?? artifact.checksum;
        artifact.isEditable = input.isEditable ?? artifact.isEditable;
        artifact.parentArtifactId = input.parentArtifactId ?? artifact.parentArtifactId;
        artifact.versionGroupId = input.versionGroupId ?? artifact.versionGroupId;
        artifact.metadata = input.metadata ? { ...artifact.metadata, ...input.metadata } : artifact.metadata;
        artifact.updatedAt = getNowTimestamp();
        artifact.updatedByUserId = input.updatedByUserId ?? artifact.updatedByUserId;
        return artifact;
      });
    },
    async archive(id, updatedByUserId) {
      return updatePlatformStore(async (store) => {
        const artifact = store.generationArtifacts.find((entry) => entry.id === id);
        if (!artifact) {
          throw new Error(`GenerationArtifact not found: ${id}`);
        }
        artifact.metadata = { ...artifact.metadata, archivedAt: getNowTimestamp() };
        artifact.updatedAt = getNowTimestamp();
        artifact.updatedByUserId = updatedByUserId ?? artifact.updatedByUserId;
        return artifact;
      });
    },
  };
}

function createArtifactRelationRepository(): ArtifactRelationRepository {
  return {
    async getById(id) {
      const store = await readPlatformStore();
      return store.artifactRelations.find((relation) => relation.id === id) ?? null;
    },
    async create(input) {
      return updatePlatformStore(async (store) => {
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
        store.artifactRelations.push(entity);
        return entity;
      });
    },
    async createMany(inputs) {
      return updatePlatformStore(async (store) => {
        const now = getNowTimestamp();
        const created: ArtifactRelation[] = [];
        for (const input of inputs) {
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
          store.artifactRelations.push(entity);
          created.push(entity);
        }
        return created;
      });
    },
    async listByProjectId(projectId) {
      const store = await readPlatformStore();
      return store.artifactRelations.filter((relation) => relation.projectId === projectId);
    },
    async listByDownstreamArtifactId(downstreamArtifactId) {
      const store = await readPlatformStore();
      return store.artifactRelations.filter((relation) => relation.downstreamArtifactId === downstreamArtifactId);
    },
  };
}

function createUsageEventRepository(): UsageEventRepository {
  return {
    async getById(id) {
      const store = await readPlatformStore();
      return store.usageEvents.find((event) => event.id === id) ?? null;
    },
    async listByOrganizationId(organizationId) {
      const store = await readPlatformStore();
      return store.usageEvents.filter((event) => event.organizationId === organizationId);
    },
    async listByWorkspaceId(workspaceId) {
      const store = await readPlatformStore();
      return store.usageEvents.filter((event) => event.workspaceId === workspaceId);
    },
    async append(input) {
      return updatePlatformStore(async (store) => {
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
        store.usageEvents.push(entity);
        return entity;
      });
    },
    async summarizeUsage(organizationId, from, to) {
      const store = await readPlatformStore();
      const events = store.usageEvents.filter((event) => {
        if (event.organizationId !== organizationId) {
          return false;
        }
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
        totalEvents: events.length,
        totalTokens: events.reduce((sum, event) => sum + (event.inputTokens ?? 0) + (event.outputTokens ?? 0), 0),
        totalCostCents: events.reduce((sum, event) => sum + (event.costCents ?? 0), 0),
      };
    },
  };
}

function createSubscriptionRepository(): SubscriptionRepository {
  return {
    async getById(id) {
      const store = await readPlatformStore();
      return store.subscriptions.find((subscription) => subscription.id === id) ?? null;
    },
    async getCurrentByOrganizationId(organizationId) {
      const store = await readPlatformStore();
      return store.subscriptions
        .filter((subscription) => subscription.organizationId === organizationId)
        .sort((left, right) => {
          return (right.currentPeriodEnd ?? right.updatedAt).localeCompare(left.currentPeriodEnd ?? left.updatedAt);
        })[0] ?? null;
    },
    async listByOrganizationId(organizationId) {
      const store = await readPlatformStore();
      return store.subscriptions.filter((subscription) => subscription.organizationId === organizationId);
    },
    async create(input) {
      return updatePlatformStore(async (store) => {
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
        store.subscriptions.push(entity);
        return entity;
      });
    },
    async update(id, input) {
      return updateEntity<Subscription, UpdateSubscriptionInput>('Subscription', 'subscriptions', id, input);
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

function createPaymentOrderRepository(): PaymentOrderRepository {
  return {
    async getById(id) {
      const store = await readPlatformStore();
      return store.paymentOrders.find((paymentOrder) => paymentOrder.id === id) ?? null;
    },
    async getByProviderOrderId(providerOrderId) {
      const store = await readPlatformStore();
      return store.paymentOrders.find((paymentOrder) => paymentOrder.providerOrderId === providerOrderId) ?? null;
    },
    async listByOrganizationId(organizationId) {
      const store = await readPlatformStore();
      return store.paymentOrders.filter((paymentOrder) => paymentOrder.organizationId === organizationId);
    },
    async create(input) {
      return updatePlatformStore(async (store) => {
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
        store.paymentOrders.push(entity);
        return entity;
      });
    },
    async update(id, input) {
      return updateEntity<PaymentOrder, UpdatePaymentOrderInput>('PaymentOrder', 'paymentOrders', id, input);
    },
  };
}

function createCreditAccountRepository(): CreditAccountRepository {
  return {
    async getById(id) {
      const store = await readPlatformStore();
      return store.creditAccounts.find((account) => account.id === id) ?? null;
    },
    async getByOrganizationId(organizationId) {
      const store = await readPlatformStore();
      return store.creditAccounts.find((account) => account.organizationId === organizationId) ?? null;
    },
    async create(input) {
      return updatePlatformStore(async (store) => {
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
        store.creditAccounts.push(entity);
        return entity;
      });
    },
    async update(id, input) {
      return updateEntity<CreditAccount, UpdateCreditAccountInput>('CreditAccount', 'creditAccounts', id, input);
    },
  };
}

function createCreditLedgerRepository(): CreditLedgerRepository {
  return {
    async getById(id) {
      const store = await readPlatformStore();
      return store.creditLedgerEntries.find((entry) => entry.id === id) ?? null;
    },
    async listByOrganizationId(organizationId) {
      const store = await readPlatformStore();
      return store.creditLedgerEntries.filter((entry) => entry.organizationId === organizationId);
    },
    async listByGenerationJobId(generationJobId) {
      const store = await readPlatformStore();
      return store.creditLedgerEntries.filter((entry) => entry.generationJobId === generationJobId);
    },
    async append(input) {
      return updatePlatformStore(async (store) => {
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
        store.creditLedgerEntries.push(entity);
        return entity;
      });
    },
  };
}

function createRedeemCodeCampaignRepository(): RedeemCodeCampaignRepository {
  return {
    async getById(id) {
      const store = await readPlatformStore();
      return store.redeemCodeCampaigns.find((campaign) => campaign.id === id) ?? null;
    },
    async list() {
      const store = await readPlatformStore();
      return store.redeemCodeCampaigns;
    },
    async create(input) {
      return updatePlatformStore(async (store) => {
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
        store.redeemCodeCampaigns.push(entity);
        return entity;
      });
    },
    async update(id, input) {
      return updateEntity<RedeemCodeCampaign, UpdateRedeemCodeCampaignInput>('RedeemCodeCampaign', 'redeemCodeCampaigns', id, input);
    },
  };
}

function createRedeemCodeRepository(): RedeemCodeRepository {
  return {
    async getById(id) {
      const store = await readPlatformStore();
      return store.redeemCodes.find((code) => code.id === id) ?? null;
    },
    async getByCode(code) {
      const normalizedCode = normalizeRedeemCode(code);
      const store = await readPlatformStore();
      return store.redeemCodes.find((entry) => entry.code === normalizedCode) ?? null;
    },
    async listByCampaignId(campaignId) {
      const store = await readPlatformStore();
      return store.redeemCodes.filter((code) => code.campaignId === campaignId);
    },
    async create(input) {
      return updatePlatformStore(async (store) => {
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
        store.redeemCodes.push(entity);
        return entity;
      });
    },
    async update(id, input) {
      return updateEntity<RedeemCode, UpdateRedeemCodeInput>('RedeemCode', 'redeemCodes', id, {
        ...input,
        metadata: input.metadata,
      });
    },
  };
}

function createRedeemCodeRedemptionRepository(): RedeemCodeRedemptionRepository {
  return {
    async getById(id) {
      const store = await readPlatformStore();
      return store.redeemCodeRedemptions.find((redemption) => redemption.id === id) ?? null;
    },
    async listByOrganizationId(organizationId) {
      const store = await readPlatformStore();
      return store.redeemCodeRedemptions.filter((redemption) => redemption.organizationId === organizationId);
    },
    async listByRedeemCodeId(redeemCodeId) {
      const store = await readPlatformStore();
      return store.redeemCodeRedemptions.filter((redemption) => redemption.redeemCodeId === redeemCodeId);
    },
    async create(input) {
      return updatePlatformStore(async (store) => {
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
        store.redeemCodeRedemptions.push(entity);
        return entity;
      });
    },
  };
}

async function updateEntity<
  TEntity extends {
    id: string;
    updatedAt: string;
    updatedByUserId?: string | null;
  },
  TInput extends {
    updatedByUserId?: string | null;
  },
>(
  label: string,
  collectionKey: keyof Awaited<ReturnType<typeof readPlatformStore>>,
  id: string,
  input: TInput
): Promise<TEntity> {
  return updatePlatformStore(async (store) => {
    const collection = store[collectionKey] as unknown as TEntity[];
    const entity = collection.find((entry) => entry.id === id);
    if (!entity) {
      throw new Error(`${label} not found: ${id}`);
    }
    Object.assign(entity, input);
    entity.updatedAt = getNowTimestamp();
    entity.updatedByUserId =
      (input.updatedByUserId as string | null | undefined) ?? entity.updatedByUserId ?? null;
    return entity;
  });
}

function normalizeRedeemCode(code: string): string {
  return code.trim().toUpperCase();
}
