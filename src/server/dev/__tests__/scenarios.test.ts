import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('developer scenarios', () => {
  let previousStorePath: string | undefined;
  let tempDir: string | null = null;

  beforeEach(() => {
    previousStorePath = process.env.NOVELSCRIPT_STORE_PATH;
  });

  afterEach(async () => {
    if (previousStorePath === undefined) {
      delete process.env.NOVELSCRIPT_STORE_PATH;
    } else {
      process.env.NOVELSCRIPT_STORE_PATH = previousStorePath;
    }

    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('seeds a demo project with relation-backed and legacy storyboard artifacts', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'novelscript-dev-scenarios-'));
    process.env.NOVELSCRIPT_STORE_PATH = path.join(tempDir, 'store.json');

    vi.resetModules();
    const { createPersistentPlatformRuntime } = await import('@/server/shared/platform/runtime');
    const { runDeveloperScenario } = await import('@/server/dev/scenarios');
    const { getProjectBundle } = await import('@/server/projects/service');

    const runtime = createPersistentPlatformRuntime();
    const user = await runtime.users.create({
      email: 'dev@example.com',
      displayName: 'Developer',
      preferredLocale: 'zh-CN',
      createdByUserId: null,
    });
    const organization = await runtime.organizations.create({
      slug: 'dev-org',
      name: 'Dev Org',
      ownerUserId: user.id,
      billingLocale: 'zh-CN',
      billingCurrency: 'USD',
      pricingRegion: 'global',
      createdByUserId: user.id,
    });
    const workspace = await runtime.workspaces.create({
      organizationId: organization.id,
      slug: 'dev-workspace',
      name: 'Dev Workspace',
      defaultLocale: 'zh-CN',
      createdByUserId: user.id,
    });

    const result = await runDeveloperScenario({
      viewer: {
        user: {
          id: user.id,
          email: user.email,
        },
        organization: {
          id: organization.id,
          billingCurrency: organization.billingCurrency,
        },
        workspace: {
          id: workspace.id,
        },
        session: {
          locale: 'zh-CN',
        },
      },
      scenario: 'seed-demo-project',
    });
    expect(result.scenario).toBe('seed-demo-project');
    if (result.scenario !== 'seed-demo-project') {
      throw new Error('UNEXPECTED_SCENARIO_RESULT');
    }

    const bundle = await getProjectBundle(result.project.id);
    const currentStoryboard = bundle?.artifacts.find(
      (artifact) => artifact.id === result.storyboardArtifactId
    );
    const legacyStoryboard = bundle?.artifacts.find(
      (artifact) => artifact.id === result.legacyStoryboardArtifactId
    );
    const currentStoryboardRelations = await runtime.artifactRelations.listByDownstreamArtifactId(
      result.storyboardArtifactId
    );
    const legacyStoryboardRelations = await runtime.artifactRelations.listByDownstreamArtifactId(
      result.legacyStoryboardArtifactId
    );

    expect(result.artifactRelationCount).toBe(3);
    expect(bundle?.artifacts.filter((artifact) => artifact.kind === 'storyboard')).toHaveLength(2);
    expect(bundle?.artifactRelations).toHaveLength(3);
    expect(currentStoryboardRelations).toHaveLength(1);
    expect(currentStoryboardRelations[0]).toMatchObject({
      upstreamArtifactId: result.latestScriptArtifactId,
      downstreamArtifactId: result.storyboardArtifactId,
      relationType: 'derived_from',
    });
    expect(legacyStoryboardRelations).toHaveLength(0);
    expect(currentStoryboard?.metadata).toMatchObject({
      sourceScriptArtifactIds: [result.latestScriptArtifactId],
    });
    expect(legacyStoryboard?.metadata).toMatchObject({
      legacySeed: true,
    });
  });
});
