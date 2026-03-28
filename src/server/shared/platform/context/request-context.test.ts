import { describe, expect, it } from 'vitest';
import { createPlatformRequestContext } from '@/server/shared/platform/context/request-context';

describe('createPlatformRequestContext', () => {
  it('uses headers and explicit defaults without parsing auth cookies', () => {
    const request = {
      headers: new Headers({
        'x-request-id': 'req_1',
        'x-user-id': 'user_1',
        'x-session-id': 'sess_1',
        'x-workspace-id': 'ws_1',
        'x-organization-id': 'org_1',
      }),
      nextUrl: new URL('https://app.test/api/projects'),
    };

    expect(
      createPlatformRequestContext(request, {
        defaultPlan: 'creator',
      })
    ).toMatchObject({
      requestId: 'req_1',
      userId: 'user_1',
      sessionId: 'sess_1',
      workspaceId: 'ws_1',
      organizationId: 'org_1',
      source: 'header',
      plan: 'creator',
    });
  });
});
