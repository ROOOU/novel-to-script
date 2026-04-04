# Clerk Auth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace NovelScript's self-built password and signed-cookie authentication with Clerk while preserving the existing local business user, project, billing, and PayPal flows.

**Architecture:** Clerk becomes the authentication and session provider, while NovelScript keeps its local business-user model and billing ownership. The implementation introduces a Clerk-backed viewer adapter, migrates request-context identity reads away from self-signed cookies, updates the login experience to Google plus email-first Clerk flows, and then removes legacy auth paths after compatibility is verified.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Clerk (`@clerk/nextjs`), existing platform runtime and PayPal billing services

---

### Task 1: Install Clerk and Scaffold Runtime Configuration

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.local.example`
- Create: `middleware.ts`
- Create: `src/server/auth/clerk.ts`
- Create: `src/server/auth/__tests__/clerk.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
  publishableKey: 'pk_test_123',
  secretKey: 'sk_test_123',
}));

vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', env.publishableKey);
vi.stubEnv('CLERK_SECRET_KEY', env.secretKey);

describe('getClerkConfig', () => {
  it('returns Clerk keys when both are configured', async () => {
    const { getClerkConfig } = await import('@/server/auth/clerk');

    expect(getClerkConfig()).toEqual({
      publishableKey: 'pk_test_123',
      secretKey: 'sk_test_123',
      signInUrl: '/sign-in',
      signUpUrl: '/sign-up',
      afterSignInUrl: '/projects',
      afterSignUpUrl: '/projects',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/server/auth/__tests__/clerk.test.ts`
Expected: FAIL with `Cannot find module '@/server/auth/clerk'`

- [ ] **Step 3: Install the Clerk dependency**

Run:

```bash
npm install @clerk/nextjs
```

Expected: `added ... packages` and `package-lock.json` updated.

- [ ] **Step 4: Write minimal Clerk config implementation**

```ts
// src/server/auth/clerk.ts
export interface ClerkRuntimeConfig {
  publishableKey: string;
  secretKey: string;
  signInUrl: string;
  signUpUrl: string;
  afterSignInUrl: string;
  afterSignUpUrl: string;
}

export function getClerkConfig(): ClerkRuntimeConfig {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();

  if (!publishableKey || !secretKey) {
    throw new Error(
      'CLERK_NOT_CONFIGURED: missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY or CLERK_SECRET_KEY'
    );
  }

  return {
    publishableKey,
    secretKey,
    signInUrl: '/sign-in',
    signUpUrl: '/sign-up',
    afterSignInUrl: '/projects',
    afterSignUpUrl: '/projects',
  };
}
```

- [ ] **Step 5: Add middleware and environment examples**

```ts
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher([
  '/:locale/projects(.*)',
  '/:locale/billing(.*)',
  '/api/projects(.*)',
  '/api/billing(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/api/:path*'],
};
```

```env
# .env.local.example
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/server/auth/__tests__/clerk.test.ts`
Expected: PASS with `1 passed`

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.local.example middleware.ts src/server/auth/clerk.ts src/server/auth/__tests__/clerk.test.ts
git commit -m "feat(auth): add clerk runtime scaffolding"
```

### Task 2: Add Clerk-Backed Identity Sync for Local Business Users

**Files:**
- Modify: `src/server/auth/service.ts`
- Modify: `src/server/shared/platform/db/schema.ts`
- Create: `src/server/auth/__tests__/service.clerk.test.ts`

- [ ] **Step 1: Write the failing test for new-user provisioning**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  users: {
    getByEmail: vi.fn(),
    getByAuthUserId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  organizations: {
    listByOwnerUserId: vi.fn(),
    create: vi.fn(),
  },
  workspaces: {
    listByOrganizationId: vi.fn(),
    create: vi.fn(),
  },
  subscriptions: {
    create: vi.fn(),
  },
  creditAccounts: {
    create: vi.fn(),
  },
  creditLedger: {
    append: vi.fn(),
  },
}));

vi.mock('@/server/shared/platform', () => ({
  getPlatformRuntime: () => runtime,
}));

describe('syncViewerFromClerkIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.users.getByAuthUserId.mockResolvedValue(null);
    runtime.users.getByEmail.mockResolvedValue(null);
  });

  it('creates a local business user and default tenancy for a new Clerk identity', async () => {
    const { syncViewerFromClerkIdentity } = await import('@/server/auth/service');

    await syncViewerFromClerkIdentity({
      authUserId: 'user_clerk_1',
      email: 'creator@example.com',
      emailVerified: true,
      displayName: 'Creator',
      avatarUrl: 'https://example.com/avatar.png',
      locale: 'en-US',
    });

    expect(runtime.users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'creator@example.com',
        authProvider: 'clerk',
        authUserId: 'user_clerk_1',
      })
    );
    expect(runtime.organizations.create).toHaveBeenCalled();
    expect(runtime.workspaces.create).toHaveBeenCalled();
    expect(runtime.subscriptions.create).toHaveBeenCalled();
    expect(runtime.creditAccounts.create).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/server/auth/__tests__/service.clerk.test.ts`
Expected: FAIL with `syncViewerFromClerkIdentity is not a function`

- [ ] **Step 3: Add schema fields for Clerk-linked users**

```ts
// src/server/shared/platform/db/schema.ts
export const usersTable = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    displayName: text('displayName').notNull(),
    authProvider: text('authProvider'),
    authUserId: text('authUserId'),
    emailVerifiedAt: timestamp('emailVerifiedAt', timestampOptions),
    lastAuthSyncAt: timestamp('lastAuthSyncAt', timestampOptions),
    passwordHash: text('passwordHash'),
    avatarUrl: text('avatarUrl'),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    authUserIdIdx: uniqueIndex('users_auth_user_id_idx').on(table.authUserId),
  })
);
```

- [ ] **Step 4: Implement Clerk identity sync in the auth service**

```ts
export interface ClerkIdentityInput {
  authUserId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  avatarUrl?: string | null;
  locale: SupportedLocale;
}

export async function syncViewerFromClerkIdentity(input: ClerkIdentityInput) {
  const runtime = getPlatformRuntime();
  const normalizedEmail = input.email.trim().toLowerCase();

  const existingByAuthId = await runtime.users.getByAuthUserId(input.authUserId);
  if (existingByAuthId) {
    await runtime.users.update(existingByAuthId.id, {
      displayName: input.displayName,
      avatarUrl: input.avatarUrl ?? existingByAuthId.avatarUrl,
      preferredLocale: input.locale,
      emailVerifiedAt: input.emailVerified ? new Date().toISOString() : null,
      lastAuthSyncAt: new Date().toISOString(),
      updatedByUserId: existingByAuthId.id,
    });
    return buildViewerForUser(existingByAuthId.id, input.locale);
  }

  const existingByEmail = await runtime.users.getByEmail(normalizedEmail);
  if (existingByEmail) {
    if (!input.emailVerified || existingByEmail.authUserId) {
      throw new Error('AUTH_ACCOUNT_LINK_CONFLICT');
    }

    await runtime.users.update(existingByEmail.id, {
      authProvider: 'clerk',
      authUserId: input.authUserId,
      avatarUrl: input.avatarUrl ?? existingByEmail.avatarUrl,
      preferredLocale: input.locale,
      emailVerifiedAt: new Date().toISOString(),
      lastAuthSyncAt: new Date().toISOString(),
      updatedByUserId: existingByEmail.id,
    });
    return buildViewerForUser(existingByEmail.id, input.locale);
  }

  return provisionNewViewerFromClerk(input);
}
```

- [ ] **Step 5: Add a focused conflict test**

```ts
it('rejects linking when the Clerk email is not verified', async () => {
  runtime.users.getByEmail.mockResolvedValueOnce({
    id: 'user_legacy_1',
    email: 'creator@example.com',
    authUserId: null,
  });

  const { syncViewerFromClerkIdentity } = await import('@/server/auth/service');

  await expect(
    syncViewerFromClerkIdentity({
      authUserId: 'user_clerk_2',
      email: 'creator@example.com',
      emailVerified: false,
      displayName: 'Creator',
      locale: 'en-US',
    })
  ).rejects.toThrow('AUTH_ACCOUNT_LINK_CONFLICT');
});
```

- [ ] **Step 6: Run the auth service tests**

Run: `npm test -- src/server/auth/__tests__/service.clerk.test.ts`
Expected: PASS with provisioning and conflict coverage both green.

- [ ] **Step 7: Commit**

```bash
git add src/server/auth/service.ts src/server/shared/platform/db/schema.ts src/server/auth/__tests__/service.clerk.test.ts
git commit -m "feat(auth): sync local business users from clerk"
```

### Task 3: Replace Self-Signed Session Reads With a Clerk Viewer Adapter

**Files:**
- Modify: `src/server/auth/session.ts`
- Modify: `src/server/auth/http.ts`
- Modify: `src/server/shared/platform/context/request-identity.ts`
- Modify: `src/server/shared/platform/context/workspace-resolution.ts`
- Create: `src/server/auth/__tests__/session.clerk.test.ts`

- [ ] **Step 1: Write the failing test for the new viewer adapter**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  syncViewerFromClerkIdentity: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mocks.auth(),
  currentUser: () => mocks.currentUser(),
}));

vi.mock('@/server/auth/service', () => ({
  syncViewerFromClerkIdentity: (...args: unknown[]) => mocks.syncViewerFromClerkIdentity(...args),
}));

describe('getCurrentViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when there is no authenticated Clerk user', async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const { getCurrentViewer } = await import('@/server/auth/session');

    await expect(getCurrentViewer()).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/server/auth/__tests__/session.clerk.test.ts`
Expected: FAIL because `src/server/auth/session.ts` still expects local cookie sessions.

- [ ] **Step 3: Convert the session module into a Clerk adapter**

```ts
// src/server/auth/session.ts
import { auth, currentUser } from '@clerk/nextjs/server';
import { syncViewerFromClerkIdentity } from './service';

export async function getCurrentViewer() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const user = await currentUser();
  const primaryEmail = user?.emailAddresses.find(
    (candidate) => candidate.id === user.primaryEmailAddressId
  );

  if (!user || !primaryEmail?.emailAddress) {
    throw new Error('CLERK_PRIMARY_EMAIL_MISSING');
  }

  return syncViewerFromClerkIdentity({
    authUserId: userId,
    email: primaryEmail.emailAddress,
    emailVerified: primaryEmail.verification?.status === 'verified',
    displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'Creator',
    avatarUrl: user.imageUrl,
    locale: 'en-US',
  });
}
```

- [ ] **Step 4: Update request identity and workspace fallback logic**

```ts
// src/server/shared/platform/context/request-identity.ts
export function resolveActorIdentity(
  request: PlatformRequestLike,
  viewer?: { user: { id: string } } | null
) {
  return {
    userId: resolveHeaderValue(request, USER_ID_HEADER_CANDIDATES) ?? viewer?.user.id ?? null,
    sessionId: resolveHeaderValue(request, SESSION_ID_HEADER_CANDIDATES) ?? viewer?.user.id ?? null,
  };
}
```

```ts
// src/server/shared/platform/context/workspace-resolution.ts
export function resolveWorkspaceContext(
  request: PlatformRequestLike,
  options: WorkspaceResolutionOptions & {
    viewer?: { organization: { id: string }; workspace: { id: string } } | null;
  } = {}
): PlatformWorkspaceRef {
  const workspaceId = resolveScopedIdentifier(
    request,
    query,
    WORKSPACE_ID_HEADERS,
    WORKSPACE_ID_QUERY_KEYS,
    options.defaultWorkspaceId ?? options.viewer?.workspace.id ?? null
  );

  const organizationId =
    resolveScopedIdentifier(
      request,
      query,
      ORGANIZATION_ID_HEADERS,
      ORGANIZATION_ID_QUERY_KEYS,
      options.defaultOrganizationId ?? options.viewer?.organization.id ?? null
    ) ?? workspaceId;
}
```

- [ ] **Step 5: Run the viewer adapter tests**

Run: `npm test -- src/server/auth/__tests__/session.clerk.test.ts`
Expected: PASS with null-user coverage green.

- [ ] **Step 6: Run a regression route test that depends on authenticated viewers**

Run: `npm test -- src/app/api/projects/route.test.ts`
Expected: PASS, confirming `requireViewerResponse` remains compatible with downstream routes.

- [ ] **Step 7: Commit**

```bash
git add src/server/auth/session.ts src/server/auth/http.ts src/server/shared/platform/context/request-identity.ts src/server/shared/platform/context/workspace-resolution.ts src/server/auth/__tests__/session.clerk.test.ts
git commit -m "refactor(auth): resolve viewers from clerk"
```

### Task 4: Migrate the Auth API Contract From Login Endpoint to Viewer Endpoint

**Files:**
- Modify: `src/app/api/auth/session/route.ts`
- Modify: `src/app/api/auth/session/route.test.ts`

- [ ] **Step 1: Rewrite the failing route test around GET viewer reads**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentViewer: vi.fn(),
}));

vi.mock('@/server/auth/session', () => ({
  getCurrentViewer: () => mocks.getCurrentViewer(),
}));

describe('auth session route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the current viewer for an authenticated Clerk session', async () => {
    mocks.getCurrentViewer.mockResolvedValue({
      user: { id: 'user_1', email: 'creator@example.com' },
      organization: { id: 'org_1' },
      workspace: { id: 'ws_1' },
    });

    const { GET } = await import('@/app/api/auth/session/route');
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      viewer: {
        user: { id: 'user_1', email: 'creator@example.com' },
        organization: { id: 'org_1' },
        workspace: { id: 'ws_1' },
      },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/auth/session/route.test.ts`
Expected: FAIL because the route still exports password-login `POST` semantics.

- [ ] **Step 3: Replace route behavior with a viewer summary endpoint**

```ts
// src/app/api/auth/session/route.ts
import { NextResponse } from 'next/server';
import { getCurrentViewer } from '@/server/auth/session';

export async function GET() {
  const viewer = await getCurrentViewer();
  if (!viewer) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    viewer: {
      user: viewer.user,
      organization: viewer.organization,
      workspace: viewer.workspace,
      subscription: viewer.subscription,
      creditAccount: viewer.creditAccount,
    },
  });
}
```

- [ ] **Step 4: Remove local login and logout tests**

```ts
// route.test.ts
it('returns 401 when there is no authenticated viewer', async () => {
  mocks.getCurrentViewer.mockResolvedValueOnce(null);

  const { GET } = await import('@/app/api/auth/session/route');
  const response = await GET();

  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({
    ok: false,
    error: 'UNAUTHORIZED',
  });
});
```

- [ ] **Step 5: Run the auth route test suite**

Run: `npm test -- src/app/api/auth/session/route.test.ts`
Expected: PASS with authenticated and unauthenticated GET cases.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/auth/session/route.ts src/app/api/auth/session/route.test.ts
git commit -m "refactor(auth): expose clerk-backed viewer route"
```

### Task 5: Replace the Login Page With Clerk UI and Redirects

**Files:**
- Modify: `src/app/[locale]/login/page.tsx`
- Modify: `src/features/saas/LoginForm.tsx`
- Create: `src/app/[locale]/login/page.test.ts`
- Create: `src/app/sign-in/[[...sign-in]]/page.tsx`
- Create: `src/app/sign-up/[[...sign-up]]/page.tsx`

- [ ] **Step 1: Write the failing login page test or snapshot-style assertion**

```ts
import { describe, expect, it } from 'vitest';
import LoginPage from '@/app/[locale]/login/page';

describe('login page', () => {
  it('renders a Clerk-powered auth entry point instead of the legacy password form', async () => {
    const page = await LoginPage({ params: Promise.resolve({ locale: 'en-US' }) });

    expect(JSON.stringify(page)).toContain('Continue with Google');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/[locale]/login/page.test.ts`
Expected: FAIL because the current page still renders the legacy `LoginForm`.

- [ ] **Step 3: Replace the legacy login form with Clerk components**

```tsx
// src/features/saas/LoginForm.tsx
'use client';

import { SignIn } from '@clerk/nextjs';
import type { SupportedLocale } from '@/server/shared/platform/domain';

export function LoginForm({ locale }: { locale: SupportedLocale }) {
  return (
    <div className="marketing-shell">
      <div className="auth-card">
        <SignIn
          routing="path"
          path="/sign-in"
          fallbackRedirectUrl={`/${locale}/projects`}
          appearance={{
            elements: {
              card: 'auth-card-surface',
            },
          }}
        />
      </div>
    </div>
  );
}
```

```tsx
// src/app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />;
}
```

```tsx
// src/app/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />;
}
```

- [ ] **Step 4: Update the localized login page redirect behavior**

```tsx
// src/app/[locale]/login/page.tsx
import { redirect } from 'next/navigation';
import { LoginForm } from '@/features/saas/LoginForm';
import { getCurrentViewer } from '@/server/auth/session';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const viewer = await getCurrentViewer();
  if (viewer) {
    redirect(`/${viewer.workspace.defaultLocale ?? locale}/projects`);
  }

  return <LoginForm locale={locale === 'en-US' ? 'en-US' : 'zh-CN'} />;
}
```

- [ ] **Step 5: Run targeted tests**

Run:

```bash
npm test -- src/app/[locale]/login/page.test.ts
npm test -- src/app/api/auth/session/route.test.ts
```

Expected: PASS, with the login page now acting as a branded Clerk entry point.

- [ ] **Step 6: Commit**

```bash
git add src/app/[locale]/login/page.tsx src/features/saas/LoginForm.tsx src/app/sign-in/[[...sign-in]]/page.tsx src/app/sign-up/[[...sign-up]]/page.tsx
git commit -m "feat(auth): switch login experience to clerk"
```

### Task 6: Remove Legacy Password-First Auth Paths and Update Docs

**Files:**
- Modify: `src/server/auth/service.ts`
- Modify: `src/server/auth/session.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-03-28-auth-clerk-paypal-design.md`
- Create: `src/server/auth/__tests__/legacy-auth-cleanup.test.ts`
- Create: `docs/auth-migration-checklist.md`

- [ ] **Step 1: Write the failing regression test that proves legacy auth exports are gone**

```ts
import { describe, expect, it } from 'vitest';

describe('legacy auth cleanup', () => {
  it('does not export password-login helpers from the active auth surface', async () => {
    const authService = await import('@/server/auth/service');

    expect('authenticateUser' in authService).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/server/auth/__tests__/legacy-auth-cleanup.test.ts`
Expected: FAIL because `authenticateUser` is still exported.

- [ ] **Step 3: Remove legacy cookie and password code from the active path**

```ts
// src/server/auth/service.ts
export {
  syncViewerFromClerkIdentity,
  buildViewerForUser,
};

// delete:
// - AuthenticateInput
// - authenticateUser
// - bcrypt-based password verification
```

```ts
// src/server/auth/session.ts
// delete:
// - AUTH_COOKIE_NAME
// - createSessionToken
// - verifySessionToken
// - parseSessionFromCookieHeader
```

- [ ] **Step 4: Add operator-facing migration documentation**

```md
# Auth Migration Checklist

1. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
2. Enable Google and Email authentication in Clerk.
3. Confirm verified-email linking in staging with a legacy account snapshot.
4. Verify `/api/auth/session` returns a viewer for a Clerk-authenticated user.
5. Verify PayPal checkout still records orders against the same local organization.
6. Remove legacy auth secrets from deployment once production traffic is stable.
```

- [ ] **Step 5: Run the focused auth regression suite**

Run:

```bash
npm test -- src/server/auth/__tests__/clerk.test.ts src/server/auth/__tests__/service.clerk.test.ts src/server/auth/__tests__/session.clerk.test.ts src/app/api/auth/session/route.test.ts src/app/api/projects/route.test.ts
npm run typecheck
```

Expected:

- all targeted auth tests PASS
- `npm run typecheck` exits 0

- [ ] **Step 6: Commit**

```bash
git add src/server/auth/service.ts src/server/auth/session.ts README.md docs/auth-migration-checklist.md docs/superpowers/specs/2026-03-28-auth-clerk-paypal-design.md
git commit -m "chore(auth): remove legacy self-built auth flow"
```

## Self-Review

### Spec coverage

- Clerk becomes auth owner: covered by Tasks 1, 3, 4, and 5.
- Local business user remains source of business truth: covered by Task 2.
- Verified-email legacy account linking: covered by Task 2.
- Self-signed session retirement: covered by Tasks 3 and 6.
- Login UX moves to Google and email-first Clerk flows: covered by Task 5.
- PayPal remains unchanged apart from identity sourcing: protected by Tasks 2 and 3, with regression validation in Tasks 3 and 6.

No spec gaps were found that require another subsystem-level plan.

### Placeholder scan

- No unresolved placeholders remain.
- Each task includes exact file targets, commands, and concrete code snippets.

### Type consistency

- `syncViewerFromClerkIdentity` is introduced in Task 2 and then reused consistently in Task 3.
- `getCurrentViewer` is established as the Clerk-backed viewer adapter and reused consistently in Tasks 4 and 5.
- User-linking fields are consistently named `authProvider`, `authUserId`, `emailVerifiedAt`, and `lastAuthSyncAt`.
