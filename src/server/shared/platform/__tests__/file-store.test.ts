import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

describe('persistent platform store', () => {
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

  it('persists artifact relations and provider order ids', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'novelscript-store-'));
    process.env.NOVELSCRIPT_STORE_PATH = path.join(tempDir, 'store.json');

    vi.resetModules();
    const { createPersistentPlatformRuntime, readPlatformStore } = await import('@/server/shared/platform/runtime');
    const runtime = createPersistentPlatformRuntime();

    const relation = await runtime.artifactRelations.create({
      projectId: 'proj_1',
      upstreamArtifactId: 'artifact_upstream',
      downstreamArtifactId: 'artifact_downstream',
      createdByUserId: 'user_1',
    });

    const paymentOrder = await runtime.paymentOrders.create({
      organizationId: 'org_1',
      provider: 'paypal',
      purchaseKind: 'subscription',
      planKey: 'free',
      status: 'pending',
      amountCents: 0,
      currency: 'USD',
      providerOrderId: 'paypal-order-123',
      createdByUserId: 'user_1',
    });

    const stored = await readPlatformStore();
    expect(stored.artifactRelations).toHaveLength(1);
    expect(stored.artifactRelations[0]).toMatchObject({
      id: relation.id,
      projectId: 'proj_1',
      downstreamArtifactId: 'artifact_downstream',
    });
    expect(stored.paymentOrders).toHaveLength(1);
    expect(stored.paymentOrders[0]).toMatchObject({
      id: paymentOrder.id,
      providerOrderId: 'paypal-order-123',
      provider: 'paypal',
    });
  });
});
