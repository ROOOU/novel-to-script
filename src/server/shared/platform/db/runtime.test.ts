import { describe, expect, it, vi } from 'vitest';
import { createSchemaFallbackRuntime } from './runtime';

describe('createSchemaFallbackRuntime', () => {
  it('retries with the fallback runtime when the primary runtime hits a missing schema error', async () => {
    const primary = {
      users: {
        getByAuthUserId: vi
          .fn()
          .mockRejectedValueOnce(new Error('relation "users" does not exist')),
      },
    };
    const fallback = {
      users: {
        getByAuthUserId: vi.fn().mockResolvedValue({ id: 'user_1' }),
      },
    };

    const runtime = createSchemaFallbackRuntime(primary, fallback);

    await expect(runtime.users.getByAuthUserId('clerk_user_1')).resolves.toEqual({
      id: 'user_1',
    });
    expect(primary.users.getByAuthUserId).toHaveBeenCalledTimes(1);
    expect(fallback.users.getByAuthUserId).toHaveBeenCalledTimes(1);
  });

  it('stays on the fallback runtime after the first missing schema failure', async () => {
    const primary = {
      users: {
        getByAuthUserId: vi
          .fn()
          .mockRejectedValueOnce(new Error('column "authUserId" does not exist')),
      },
      organizations: {
        listByOwnerUserId: vi.fn().mockResolvedValue([{ id: 'org_primary' }]),
      },
    };
    const fallback = {
      users: {
        getByAuthUserId: vi.fn().mockResolvedValue({ id: 'user_1' }),
      },
      organizations: {
        listByOwnerUserId: vi.fn().mockResolvedValue([{ id: 'org_fallback' }]),
      },
    };

    const runtime = createSchemaFallbackRuntime(primary, fallback);

    await runtime.users.getByAuthUserId('clerk_user_1');
    await expect(runtime.organizations.listByOwnerUserId('user_1')).resolves.toEqual([
      { id: 'org_fallback' },
    ]);

    expect(primary.organizations.listByOwnerUserId).not.toHaveBeenCalled();
    expect(fallback.organizations.listByOwnerUserId).toHaveBeenCalledTimes(1);
  });

  it('rethrows non-schema errors from the primary runtime', async () => {
    const primary = {
      users: {
        getByAuthUserId: vi.fn().mockRejectedValue(new Error('connect ECONNRESET')),
      },
    };
    const fallback = {
      users: {
        getByAuthUserId: vi.fn(),
      },
    };

    const runtime = createSchemaFallbackRuntime(primary, fallback);

    await expect(runtime.users.getByAuthUserId('clerk_user_1')).rejects.toThrow('ECONNRESET');
    expect(fallback.users.getByAuthUserId).not.toHaveBeenCalled();
  });
});
