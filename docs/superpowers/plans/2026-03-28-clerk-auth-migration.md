<!-- /autoplan restore point: /Users/shengyufei/.gstack/projects/ROOOU-novel-to-script/main-autoplan-restore-20260403-021820.md -->
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

---

## AUTOPLAN REVIEW WORKING NOTES

### Intake

- Target plan selected for `/autoplan`: this file, because it is the newest feature-specific implementation plan in the repo and it has a matching repo design spec at `docs/superpowers/specs/2026-03-28-auth-clerk-paypal-design.md`.
- UI scope: yes. The plan changes login UX, auth entry points, redirects, and new sign-in/sign-up pages.
- Base branch: `main`
- Restore point: `/Users/shengyufei/.gstack/projects/ROOOU-novel-to-script/main-autoplan-restore-20260403-021820.md`

### Phase 1, Step 0, System Audit

- Recent auth-adjacent hot files are `package.json`, `src/server/billing/payments.ts`, `src/app/page.tsx`, `src/components/AppShellHeader.tsx`, and `src/components/MobileNav.tsx`.
- No `TODOS.md`, no tracked `TODO/FIXME/HACK/XXX` hotspots, no stash entries, no prior gstack design artifact for this branch.
- Repo reality today:
  - Password auth, tenant bootstrap, and free-plan provisioning all live inside `src/server/auth/service.ts`.
  - Signed-cookie session minting and verification live inside `src/server/auth/session.ts`.
  - Request identity and workspace fallback still parse that cookie directly in `src/server/shared/platform/context/request-identity.ts` and `src/server/shared/platform/context/workspace-resolution.ts`.
  - Header and mobile nav still route all auth entry to `/{locale}/login`.

### 0A. Premise Challenge

Reasonable premises worth keeping:

1. Outsourcing authentication is directionally right for a solo SaaS. The current stack owns password hashing, cookie signing, and tenant bootstrap in one path, which is high-maintenance surface area.
2. Keeping business identity, org/workspace ownership, PayPal orders, subscriptions, and credits local is also right. Billing and project authorization already hang off local org and workspace state, not a third-party identity ID.
3. Keeping PayPal as the only payment provider during the auth migration is good scope discipline.

Premises that need explicit confirmation before the review continues:

1. The plan assumes a same-release hard cut-over is safe enough. The repo says otherwise. Signed-cookie session parsing currently feeds request identity and workspace fallback, so a full rip-and-replace changes more than "login".
2. The plan assumes verified-email auto-linking is sufficient migration policy. That is only true if duplicate legacy emails, unverified emails, and partial staging rehearsals are handled as first-class failure modes.
3. The plan assumes legacy password and cookie code should be deleted in the same migration wave. That is attractive, but it raises rollback risk sharply.

### 0B. What Already Exists

| Sub-problem | Existing code | Reuse verdict |
|---|---|---|
| New-user bootstrap | `src/server/auth/service.ts` creates user, org, workspace, free subscription, credit account, and initial ledger grant | Reuse by extraction, not rewrite |
| Current viewer hydration | `src/server/auth/service.ts` already loads user, org, workspace, subscription, and credit account into one viewer object | Reuse shape, swap identity source |
| Billing ownership | `src/server/billing/payments.ts` already records orders against local organization and user IDs | Keep as-is |
| Login entry points | `src/app/[locale]/login/page.tsx`, `src/features/saas/LoginForm.tsx`, `src/components/AppShellHeader.tsx`, `src/components/MobileNav.tsx` centralize sign-in UI | Reuse, but update all links coherently |
| Auth route contract | `src/app/api/auth/session/route.ts` is currently the one public auth API surface | Treat as compatibility boundary |

### 0C. Dream State Mapping

```text
CURRENT
  Self-built password auth
    -> signed cookie session
    -> request identity + workspace derived from cookie
    -> local org/workspace/billing state

THIS PLAN
  Clerk auth
    -> Clerk user/session
    -> local viewer sync
    -> request identity + workspace resolved from viewer
    -> local org/workspace/billing state

12-MONTH IDEAL
  Clerk owns auth UX and session validation
    -> local identity sync is explicit, observable, and idempotent
    -> auth rollout is reversible
    -> legacy paths are removed only after burn-in
    -> billing and project authorization remain vendor-independent
```

### 0C-bis. Implementation Alternatives

| Approach | What it does | Pros | Cons | Verdict |
|---|---|---|---|---|
| A. Hard cut-over in one migration | Add Clerk, switch viewer/session path, replace auth API, replace UI, then delete legacy cookie/password flow immediately | Most complete in one pass | Highest rollback risk, underestimates blast radius into request-context code and auth entry points | Viable but risky |
| B. Two-phase bridge | Add Clerk identity sync and Clerk-backed viewer first, keep a temporary compatibility boundary for legacy cookie/logout while UI and route consumers switch, then remove legacy after burn-in | Same end state, much safer rollback posture, easier to test in staging | One extra cleanup pass | Recommended baseline |
| C. UI-only Clerk wrapper | Use Clerk sign-in UI but keep local cookie session under the hood | Smallest diff | Does not remove core auth maintenance burden, worst long-term architecture | Reject |

### 0D. Mode-Specific Analysis

- Review mode fixed by `/autoplan`: `SELECTIVE EXPANSION`
- Baseline scope to review:
  - Clerk runtime integration
  - Local business-user sync
  - Viewer/session adapter migration
  - Auth route contract update
  - Login UX replacement
  - Legacy auth retirement
- Candidate cherry-picks inside blast radius:
  - Explicit rollback and burn-in checklist for the auth cut-over
  - Auth migration observability: link-conflict logging, session-resolution failures, viewer-sync failures
  - A temporary compatibility shim for `/login`, `/sign-in`, and logout behavior so nav/header/mobile flows do not drift

### Premise Gate, Pending User Confirmation

- Confirm whether the plan should be reviewed against Approach A, the one-wave hard cut-over, or Approach B, the two-phase bridge with explicit burn-in before legacy deletion.
- Confirm whether verified-email auto-linking is the intended default, with conflict cases routed to recovery/admin handling rather than silent fallback.

### Premise Gate, Confirmed

- User selected the two-phase bridge. The rest of this review assumes:
  1. Clerk becomes the new auth source first.
  2. Viewer resolution, redirects, and billing identity reads are migrated next.
  3. Legacy password and signed-cookie code are removed only after staging burn-in and production verification.
- Verified-email auto-linking remains the default policy, but conflict cases must stop and surface explicit recovery handling. No silent fallback.

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | Intake | Review the feature-specific Clerk migration plan instead of the broader roadmap | Mechanical | P3 Pragmatic, P5 Explicit | This file is the newest implementation plan and already has a matching repo design spec | `docs/development-plan.md` |
| 2 | Intake | Treat UI scope as in-scope for the review | Mechanical | P1 Completeness | The plan changes login UX, redirects, entry points, and auth pages, so skipping design review would miss real user-facing risk | `No design review` |
| 3 | CEO Step 0 | Review against a two-phase bridge, not a one-wave cut-over | User challenge resolved | P1 Completeness, P6 Bias toward action | Same end state, much better rollback posture, and it matches the codebase blast radius more honestly | One-wave hard cut-over |

---

## PHASE 1, CEO REVIEW

### 0E. Temporal Interrogation

```text
HOUR 1
  Clerk installed, middleware added, new auth config exists.
  Risk: product still has old /login flow, old session route, and viewer reads tied to signed cookies.

HOUR 6
  Clerk-backed viewer sync exists, but local repositories/domain types now need new auth fields.
  Risk: user sync works in one runtime but not the other, or layout/pages still call an old viewer contract.

DAY 1
  Login page and auth route are switched.
  Risk: nav/header/mobile still point to the wrong entry, logout semantics drift, session-dependent routes fail in mixed state.

WEEK 1
  Burn-in period should confirm:
  - verified-email linking works for legacy accounts
  - org/workspace bootstrap stays idempotent
  - PayPal orders still attach to the same local org
  - no viewer-resolution failures on root pages, billing, or projects routes

MONTH 6 REGRET CHECK
  The foolish outcome would be "we migrated auth vendors but kept a fragile, custom account-linking layer with weak observability and no safe rollback." That is the trap to avoid.
```

### 0F. Mode Selection

- Mode: `SELECTIVE EXPANSION`
- Chosen baseline architecture: two-phase bridge
- Accepted expansions into baseline scope:
  - explicit burn-in and rollback path
  - auth migration observability
  - coherent `/login` -> Clerk entry compatibility across header, mobile nav, and page redirects

### CEO DUAL VOICES

#### CODEX SAYS (CEO, strategy challenge)

- Outside voice execution attempted with `codex exec`, but it failed before producing review output because Codex could not open its websocket session for this workspace path. The error was a UTF-8 header conversion failure on the non-ASCII workspace path segment.
- Status: `[unavailable]`

#### CLAUDE SUBAGENT (CEO, strategic independence)

- Not run. This session policy does not allow spawning sub-agents unless the user explicitly asks for delegation.
- Status: `[unavailable]`

#### CEO DUAL VOICES, CONSENSUS TABLE

```text
CEO DUAL VOICES - CONSENSUS TABLE
=================================================================
Dimension                               Claude   Codex   Consensus
--------------------------------------  -------  ------  ---------
1. Premises valid?                      N/A      N/A     primary-reviewer only
2. Right problem to solve?              N/A      N/A     primary-reviewer only
3. Scope calibration correct?           N/A      N/A     primary-reviewer only
4. Alternatives sufficiently explored?  N/A      N/A     primary-reviewer only
5. Competitive/market risks covered?    N/A      N/A     primary-reviewer only
6. 6-month trajectory sound?            N/A      N/A     primary-reviewer only
=================================================================
```

### Section 1, Architecture Review

#### Full system architecture, current -> proposed

```text
CURRENT
  /login form
    -> POST /api/auth/session
      -> authenticateUser()
        -> users.getByEmail()
        -> organizations.listByOwnerUserId()
        -> workspaces.listByOrganizationId()
        -> createSessionToken()
          -> signed cookie
            -> getCurrentSession()
              -> getCurrentViewer()
                -> pages/layouts/routes

PROPOSED SAFE BRIDGE
  Clerk sign-in UI
    -> Clerk session/auth()
      -> syncViewerFromClerkIdentity()
        -> users.getByAuthUserId() OR safe verified-email bind
        -> local user/org/workspace/subscription/credit account
          -> getCurrentViewer()
            -> pages/layouts/routes
  Temporary compatibility boundary
    -> /login redirects or branded wrapper
    -> legacy logout path preserved until burn-in completes
```

#### Four-path data flow for viewer resolution

```text
HAPPY
  Clerk session -> auth user id -> local user bound -> org/workspace loaded -> viewer returned

NIL
  No Clerk session -> unauthenticated viewer -> public page or 401 route response

EMPTY
  Clerk session exists, but local org/workspace missing -> explicit migration error, no silent null

ERROR
  Clerk currentUser/auth backend call fails or local sync throws -> logged auth-sync failure, user-visible retry/auth error
```

Findings:

1. The plan understates the true architecture blast radius. It names `service.ts`, `session.ts`, and the schema, but the repo also requires domain type changes, repository interface changes, both runtimes, and every page/route that imports `getCurrentViewer()` or relies on `viewer.session.locale`.
2. The plan treats route auth and page auth as the same migration step. They are not. `clerkMiddleware()` protects routes, but page-level viewer hydration still needs a consistent local adapter shape. If those drift, you get a product that is "authenticated" but not usable.
3. The plan deletes the old session contract too close to the route swap. That is the exact kind of cleanup that feels tidy in review and burns time in rollback.

Auto-decisions:

- Keep a single viewer shape as the contract boundary. Pages, layouts, and route handlers should not need to care whether identity started as a cookie or a Clerk session.
- Add repository/domain/runtime changes to the implementation scope now. Pretending they do not exist is fake minimalism.

### Section 2, Error & Rescue Map

```text
METHOD/CODEPATH                     | WHAT CAN GO WRONG                         | EXCEPTION CLASS
------------------------------------|-------------------------------------------|-----------------------------
syncViewerFromClerkIdentity         | auth user id not found, email conflict    | AUTH_ACCOUNT_LINK_CONFLICT
syncViewerFromClerkIdentity         | duplicate provisioning on retry           | UNIQUE_VIOLATION / DUP_BOOTSTRAP
syncViewerFromClerkIdentity         | org/workspace bootstrap partially fails   | AUTH_BOOTSTRAP_FAILED
getCurrentViewer                    | Clerk session exists, primary email absent| CLERK_PRIMARY_EMAIL_MISSING
getCurrentViewer                    | Clerk backend lookup/rate limit failure   | CLERK_USER_FETCH_FAILED
getCurrentViewer                    | local org/workspace missing               | VIEWER_CONTEXT_MISSING
/api/auth/session GET               | authenticated user not yet synced locally | VIEWER_NOT_READY
/login and nav redirects            | mixed /login and /sign-in route semantics | AUTH_ROUTE_DRIFT
```

```text
EXCEPTION CLASS              | RESCUED? | RESCUE ACTION                                | USER SEES
-----------------------------|----------|----------------------------------------------|------------------------------
AUTH_ACCOUNT_LINK_CONFLICT   | N  GAP   | stop link, log structured context, recovery  | clear account-link conflict
DUP_BOOTSTRAP                | N  GAP   | idempotent create-or-bind semantics          | transparent success or retry
AUTH_BOOTSTRAP_FAILED        | N  GAP   | compensating rollback + retry-safe recovery  | temporary setup failure
CLERK_PRIMARY_EMAIL_MISSING  | N  GAP   | fail closed, direct user to verified email   | "complete email verification"
CLERK_USER_FETCH_FAILED      | N  GAP   | retry/backoff, auth error telemetry          | temporary sign-in failure
VIEWER_CONTEXT_MISSING       | N  GAP   | explicit migration error, no silent null     | support/retry message
AUTH_ROUTE_DRIFT             | N  GAP   | keep compatibility redirect until burn-in    | consistent sign-in path
```

CEO judgment: too many silent-null outcomes are still implied. The current plan must stop using `return null` as the migration escape hatch for missing viewer context.

### Section 3, Security & Threat Model

- Threat: unsafe legacy-account auto-linking by email alone.
  - Likelihood: medium
  - Impact: high
  - Required mitigation: verified email, unique match, no existing bound auth user, structured audit log.
- Threat: exposing more Clerk user data than necessary.
  - Likelihood: medium
  - Impact: medium
  - Required mitigation: only pass required fields into local sync and frontend viewer payloads.
- Threat: split auth surfaces during migration.
  - Likelihood: high
  - Impact: medium
  - Required mitigation: one canonical auth route contract, one canonical sign-in entry path, explicit logout behavior during bridge.

### Section 4, Data Flow & Interaction Edge Cases

```text
INTERACTION                    | EDGE CASE                         | HANDLED IN PLAN?
------------------------------|-----------------------------------|------------------
Legacy account first Clerk use| verified email matches 2 accounts | no
Legacy account first Clerk use| email not verified                | partially
Login entry from header       | /login vs /sign-in mismatch       | no
Logout during bridge          | Clerk session cleared, local UI stale | no
Root page redirect            | viewer exists but locale unknown  | no
Billing checkout after login  | local viewer not provisioned yet  | no
```

Auto-decision:

- Add explicit "viewer not ready" and "account linking conflict" user states to the plan. An auth migration without those states is pretending the edge cases do not exist.

### Section 5, Code Quality Review

- The repo is currently explicit. The plan should stay explicit too. That means extracting bootstrap and viewer-build logic from `authenticateUser()` rather than rebuilding the same sequence in parallel under a Clerk-only function.
- `src/server/auth/service.ts` is already doing too much. The right move is to reuse its bootstrap knowledge, not create a second, nearly identical bootstrap path that diverges in six weeks.
- The plan also needs to call out that `User`, `CreateUserInput`, `UpdateUserInput`, and `UserRepository` will all change, not just the database schema.

### Section 6, Test Review

CEO-level test gaps that must become engineering requirements:

- verified-email link success
- verified-email link rejection on duplicate match
- idempotent new-user bootstrap on retry
- page/layout viewer hydration under authenticated Clerk session
- nav/login/logout compatibility during bridge
- PayPal checkout after Clerk-authenticated viewer resolution

### Section 7, Performance Review

- The plan currently uses `currentUser()` in the proposed adapter path. Official Clerk docs note that `currentUser()` performs a backend fetch and counts against Backend API rate limits. That is a real cost if every layout/page path calls through it. Use it carefully, and do not spray it through every auth read path without a reason.
- If root layout, root page, locale page, and auth routes all call into a Clerk-backed viewer adapter separately, you can turn a basic page load into extra auth traffic fast.

### Section 8, Observability & Debuggability Review

Missing and now required:

- structured logs for account-link conflict
- structured logs for viewer-context-missing
- auth migration counters:
  - clerk_sync_success
  - clerk_sync_conflict
  - clerk_sync_bootstrap_failure
  - viewer_resolution_failure
- burn-in checklist with "go/no-go" criteria before deleting legacy auth

### Section 9, Deployment & Rollout Review

Required deployment sequence:

```text
1. Ship Clerk config + middleware + local sync code dark
2. Verify staging link/bind/bootstrap flows
3. Switch login UI and auth route contract
4. Burn in production with legacy cleanup disabled
5. Remove legacy password/cookie code only after metrics stay clean
```

Rollback flow:

```text
If Clerk-backed viewer resolution fails at launch:
  revert login entry to existing /login experience
    -> keep local cookie/session path active
      -> investigate sync failures offline
```

### Section 10, Long-Term Trajectory Review

- Good 6-month outcome: auth is outsourced, business identity remains local, billing stays vendor-independent, and the repo has one clear viewer contract.
- Bad 6-month outcome: Clerk owns sign-in, but the app still has half a custom auth system hiding in sync logic, edge-case null returns, and drifted routes.
- The plan should optimize for "boring, reversible auth platform boundary," not "beautiful one-PR cleanup."

### Section 11, Design & UX Review

- The login experience is user-facing and currently under-specified.
- The plan swaps in Clerk UI, but it does not say what happens to localized copy, branded wrapper behavior, loading states, account-link conflict messaging, or what the user sees when a legacy account cannot auto-bind.
- That is not just design polish. It affects trust during an auth migration.

### NOT in scope

- Team/org UX redesign. The migration should preserve hidden-tenancy behavior, not reopen product positioning.
- Payment provider expansion beyond PayPal. Good idea later, wrong migration.
- Deep profile/settings redesign. Not needed to change the identity provider safely.

### What already exists

- Existing bootstrap flow in `src/server/auth/service.ts`
- Existing viewer aggregation in `src/server/auth/service.ts`
- Existing local org/workspace/billing ownership in billing services and route handlers
- Existing auth entry surfaces in header, mobile nav, login page, and `/api/auth/session`

### Dream state delta

- This migration gets us to outsourced auth, but not to "finished auth platform" unless the plan adds rollback, observability, and explicit conflict handling.
- Without those, we trade password maintenance burden for migration-support burden.

### Error & Rescue Registry

- Methods/codepaths mapped: 8
- Current explicit rescue gaps: 7
- Current critical silent-failure gaps: 3

### Failure Modes Registry

```text
CODEPATH                         | FAILURE MODE                         | RESCUED? | TEST? | USER SEES?           | LOGGED?
---------------------------------|--------------------------------------|----------|-------|----------------------|--------
viewer sync                      | duplicate legacy email match         | N        | N     | ambiguous failure    | N
viewer sync                      | org/workspace bootstrap partial fail | N        | N     | silent/null risk     | N
page/layout viewer read          | Clerk user fetch fails               | N        | N     | auth break           | N
header/mobile auth entry         | /login and /sign-in drift            | N        | N     | wrong route / bounce | N
billing checkout after sign-in   | viewer not ready                     | N        | N     | opaque 401/400       | N
```

Rows 1-3 are critical gaps right now.

### Completion Summary

```text
+====================================================================+
|            MEGA PLAN REVIEW - COMPLETION SUMMARY                   |
+====================================================================+
| Mode selected        | SELECTIVE EXPANSION                         |
| System Audit         | auth blast radius wider than plan admits    |
| Step 0               | two-phase bridge chosen                     |
| Section 1  (Arch)    | 3 issues found                              |
| Section 2  (Errors)  | 8 error paths mapped, 7 gaps                |
| Section 3  (Security)| 3 issues found, 1 high severity             |
| Section 4  (Data/UX) | 6 edge cases mapped, 5 unhandled            |
| Section 5  (Quality) | 2 issues found                              |
| Section 6  (Tests)   | baseline gaps identified                    |
| Section 7  (Perf)    | 1 issue found                               |
| Section 8  (Observ)  | 4 gaps found                                |
| Section 9  (Deploy)  | 2 risks flagged                             |
| Section 10 (Future)  | reversibility weak without bridge           |
| Section 11 (Design)  | 2 issues found                              |
+--------------------------------------------------------------------+
| NOT in scope         | written (3 items)                           |
| What already exists  | written                                     |
| Dream state delta    | written                                     |
| Error/rescue registry| written                                     |
| Failure modes        | written                                     |
| TODOS.md updates     | pending cross-phase synthesis               |
| Outside voice        | unavailable                                 |
+====================================================================+
```

---

## PHASE 2, DESIGN REVIEW

### Step 0, Design Scope Assessment

#### 0A. Initial Design Rating

- Initial design rating: `4/10`
- Why it is low:
  - the plan says "replace the login page with Clerk UI" but does not define the user-facing states that matter during migration
  - localized auth entry is inconsistent today, header and mobile nav still point to `/{locale}/login`
  - trust-critical messages like account-link conflict, verification required, and viewer-not-ready are not described at all

#### 0B. DESIGN.md Status

- No `DESIGN.md` found in the repo root or docs.
- Decision: do not block this migration on a new design system document. Reuse the existing marketing shell and auth-card vocabulary already present in `LoginForm`, `LandingPage`, `AppShellHeader`, and `MobileNav`.

### What already exists

- `src/features/saas/LoginForm.tsx` already provides a branded marketing-shell + auth-card wrapper.
- `src/components/AppShellHeader.tsx` and `src/components/MobileNav.tsx` already define the public auth entry behavior.
- i18n copy already contains localized login titles, subtitles, and action language in `src/i18n/messages/en-US.ts` and `src/i18n/messages/zh-CN.ts`.

#### 0D. Focus Areas

1. Information hierarchy for the auth entry experience
2. Interaction states during migration failures
3. Trust and emotional continuity for legacy-account linking
4. Mobile and localized route coherence

### Design Dual Voices

#### CODEX SAYS (design, UX challenge)

- Not re-run. The same non-ASCII workspace path bug that blocked the Phase 1 Codex run would block this phase too.
- Status: `[unavailable]`

#### CLAUDE SUBAGENT (design, independent review)

- Not run due session policy on sub-agent delegation.
- Status: `[unavailable]`

#### DESIGN LITMUS SCORECARD

```text
DESIGN DUAL VOICES - LITMUS SCORECARD
=================================================================
Dimension                               Claude   Codex   Consensus
--------------------------------------  -------  ------  ---------
1. Brand clear in first screen?         N/A      N/A     primary-reviewer only
2. One strong visual anchor?            N/A      N/A     primary-reviewer only
3. Scanable by headlines only?          N/A      N/A     primary-reviewer only
4. Each section has one job?            N/A      N/A     primary-reviewer only
5. Cards actually necessary?            N/A      N/A     primary-reviewer only
6. Motion/hierarchy intentional?        N/A      N/A     primary-reviewer only
7. Premium if decoration removed?       N/A      N/A     primary-reviewer only
=================================================================
```

### Pass 1, Information Architecture

Rating: `5/10`

Problem:

- The plan defines component swaps, but not what the user should understand first.
- During auth migration, the first screen job is not "show Clerk." It is:
  1. reassure the user they are in the right product
  2. show the primary action
  3. explain what happens to an existing account

Required fix:

```text
LOGIN ENTRY HIERARCHY
  1. NovelScript identity + localized title
  2. Primary Clerk sign-in choices
  3. One-sentence account continuity note
  4. Recovery/help path for link conflicts
```

### Pass 2, Interaction State Coverage

Rating: `2/10`

Missing state table:

```text
FEATURE                    | LOADING | EMPTY | ERROR | SUCCESS | PARTIAL
---------------------------|---------|-------|-------|---------|--------
Clerk sign-in entry        | spinner in auth card | n/a | auth provider unavailable | user enters Clerk flow | social provider disabled
Legacy email auto-link     | "checking your account" | n/a | duplicate/unverified/conflict | account linked | verification required
Viewer hydration after sign-in | shell loading state | n/a | viewer not ready | redirect to projects | org/workspace bootstrap pending
Logout during bridge       | sign-out pending | n/a | sign-out failed | returned to public entry | Clerk cleared but local refresh stale
```

Auto-decision:

- Add this table to the implementation plan. This is not optional design detail. It is the visible part of the migration.

### Pass 3, User Journey & Emotional Arc

Rating: `4/10`

```text
STEP | USER DOES                     | USER FEELS              | PLAN SPECIFIES?
-----|-------------------------------|-------------------------|----------------
1    | lands on login                | "am I in the right app?"| partially
2    | chooses Google/email          | low-friction hope       | yes
3    | legacy account gets linked    | uncertainty             | no
4    | lands in projects             | relief / continuity     | partially
5    | hits conflict or verification | anxiety                 | no
```

The missing emotional beat is step 3. The plan assumes linking is backend plumbing. For the user, that is the scariest moment in the whole migration.

### Pass 4, AI Slop Risk

Rating: `7/10`

- Good: existing auth shell is simple and branded enough.
- Risk: dropping raw Clerk UI into the shell without specifying copy, spacing, and fallback states creates a "stock auth widget in a product wrapper" feel.
- Decision: keep the existing wrapper, but specify one branded continuity sentence under the auth entry and one recovery message pattern for conflict states.

### Pass 5, Design System Alignment

Rating: `6/10`

- There is no formal `DESIGN.md`, but there is an informal product vocabulary:
  - marketing shell
  - auth card
  - simple primary/secondary actions
  - localized copy
- The plan should explicitly say the Clerk entry must live inside the current branded shell and preserve the existing route-level localization behavior.

### Pass 6, Responsive & Accessibility

Rating: `3/10`

Missing and now required:

- mobile route parity: header and mobile nav must both land in the same auth entry flow
- keyboard navigation through Clerk entry inside the existing wrapper
- visible error copy for link conflict and verification-required states
- no locale loss on redirect to authenticated projects

### Pass 7, Unresolved Design Decisions

```text
DECISION NEEDED                              | IF DEFERRED, WHAT HAPPENS
---------------------------------------------|-----------------------------------------------
What does account-link conflict look like?   | engineer ships raw provider error text
What does "viewer not ready" show?           | user sees bounce, blank, or opaque 401
Does /login stay as localized wrapper?       | header/mobile/nav drift between auth paths
How is sign-out represented during bridge?   | user thinks logout worked when session is stale
```

### NOT in scope

- redesigning the whole landing/auth visual identity
- adding new motion systems or major auth-page marketing sections
- organization-management UX

### Design Review, Completion Summary

```text
+====================================================================+
|         DESIGN PLAN REVIEW - COMPLETION SUMMARY                    |
+====================================================================+
| Step 0               | design scope confirmed                      |
| Pass 1 (IA)          | 1 issue found                               |
| Pass 2 (States)      | 1 major gap found                           |
| Pass 3 (Journey)     | 1 issue found                               |
| Pass 4 (Slop)        | acceptable with constraints                 |
| Pass 5 (Alignment)   | reuse existing shell vocabulary             |
| Pass 6 (Resp/A11y)   | 1 major gap found                           |
| Pass 7 (Decisions)   | 4 unresolved design decisions surfaced      |
| Mockups              | skipped                                     |
| Outside voice        | unavailable                                 |
+====================================================================+
```

---

## PHASE 3, ENGINEERING REVIEW

### Step 0, Scope Challenge

#### What existing code already solves part of this?

- User bootstrap, org creation, workspace creation, free subscription grant, and initial credits all already exist in `src/server/auth/service.ts`.
- Viewer hydration already exists in `src/server/auth/service.ts`.
- Auth-required route behavior already centralizes through `src/server/auth/http.ts`.
- Legacy redirect behavior is already treated as contract and tested in `src/app/legacy-route-redirects.test.ts`.

#### Minimum diff that still achieves the goal

1. Add Clerk as the identity source.
2. Extract and reuse the existing local bootstrap logic.
3. Preserve one stable `getCurrentViewer()` contract during the bridge.
4. Keep `/login` as the branded localized entry while introducing Clerk-native `/sign-in` and `/sign-up`.
5. Preserve logout compatibility until the bridge is fully burned in.

#### Complexity check

- This plan clearly exceeds the 8-file smell threshold.
- That is acceptable only because auth is cross-cutting. The wrong response is not to pretend it is small. The right response is to sequence it in a reversible way.

#### Search check

- Layer 1, tried and true: use Clerk middleware and built-in auth UI, keep local business authorization separate.
- Layer 2, current docs: Clerk App Router guidance uses middleware plus server helpers like `auth()` and `currentUser()`.
- Layer 3, first principles: the expensive part is not signing users in. It is preserving local business identity and viewer shape without breaking existing route/page contracts.

### Engineering Dual Voices

#### CODEX SAYS (eng, architecture challenge)

- Not available for the same Phase 1 workspace-path UTF-8 bug.

#### CLAUDE SUBAGENT (eng, independent review)

- Not run due session delegation policy.

#### ENG DUAL VOICES, CONSENSUS TABLE

```text
ENG DUAL VOICES - CONSENSUS TABLE
=================================================================
Dimension                               Claude   Codex   Consensus
--------------------------------------  -------  ------  ---------
1. Architecture sound?                  N/A      N/A     primary-reviewer only
2. Test coverage sufficient?            N/A      N/A     primary-reviewer only
3. Performance risks addressed?         N/A      N/A     primary-reviewer only
4. Security threats covered?            N/A      N/A     primary-reviewer only
5. Error paths handled?                 N/A      N/A     primary-reviewer only
6. Deployment risk manageable?          N/A      N/A     primary-reviewer only
=================================================================
```

### 1. Architecture Review

#### Dependency graph

```text
Clerk middleware / auth helpers
  -> src/server/auth/session.ts
    -> src/server/auth/service.ts
      -> src/server/shared/platform/repositories/index.ts
      -> src/server/shared/platform/domain/entities.ts
      -> src/server/shared/platform/db/schema.ts
      -> src/server/shared/platform/db/runtime.ts
      -> src/server/shared/platform/runtime/persistent-runtime.ts

src/server/auth/http.ts
  -> route handlers under src/app/api/**

src/server/auth/service.ts or session.ts
  -> root pages / locale layout / login page / billing / projects / admin / jobs
```

Findings:

1. The plan is missing required type and repository work. Adding `authProvider`, `authUserId`, `emailVerifiedAt`, and `lastAuthSyncAt` only in the DB schema is incomplete. `User`, `CreateUserInput`, `UpdateUserInput`, `UserRepository`, and both runtime implementations also need to change.
2. The proposed `GET /api/auth/session` rewrite is incomplete because current signed-out behavior still depends on `DELETE /api/auth/session` from `AppShellHeader.tsx`. Removing that without a compatibility path breaks logout immediately.
3. The proposed Clerk-backed viewer adapter risks breaking any page that still reads `viewer.session.locale`. Today that includes root pages and localized login behavior.

#### Rollback posture

```text
SAFE
  switch login to Clerk
    -> keep DELETE /api/auth/session compatibility
      -> preserve old viewer contract during burn-in

UNSAFE
  switch login to Clerk
    -> delete cookie/session helpers
      -> pages/routes still expecting old viewer/session shape fail
```

### 2. Code Quality Review

- Keep one viewer contract. Do not make pages import a new Clerk-specific shape while routes use another.
- The plan should explicitly extract reusable bootstrap/build-viewer helpers from the existing auth service. Re-encoding that logic separately is a DRY violation waiting to happen.
- `src/server/auth/clerk.ts` is acceptable if it becomes the single home for auth config and runtime helpers. If it remains just a thin env wrapper, it may be needless file count.

### 3. Test Review

#### Coverage diagram

```text
CODE PATH COVERAGE
===========================
[+] src/server/auth/service.ts
    ├── existing bootstrap flow
    │   ├── [GAP] [CRITICAL] reuse under Clerk path
    │   ├── [GAP] duplicate-provision retry safety
    │   └── [GAP] verified-email conflict path
    │
    └── viewer aggregation
        ├── [GAP] Clerk-backed happy path
        └── [GAP] missing org/workspace path

[+] src/server/auth/session.ts
    ├── [GAP] no-auth Clerk session -> null viewer
    ├── [GAP] primary email missing
    └── [GAP] backend lookup failure

[+] src/app/api/auth/session/route.ts
    ├── [★ TESTED] current POST/DELETE legacy contract
    ├── [GAP] new GET viewer contract
    └── [GAP] DELETE compatibility during bridge

[+] src/components/AppShellHeader.tsx / MobileNav.tsx
    ├── [GAP] sign-in path consistency
    └── [GAP] logout compatibility after auth swap

USER FLOW COVERAGE
===========================
[+] Existing account, first Clerk sign-in
    ├── [GAP] [->E2E] verified email unique match
    ├── [GAP] [->E2E] duplicate email conflict
    └── [GAP] [->E2E] unverified email blocked

[+] New user, first Clerk sign-in
    ├── [GAP] org/workspace/subscription/credits provisioned
    └── [GAP] [->E2E] lands in localized projects page

[+] Signed-in browsing
    ├── [GAP] root / and /{locale} redirect with new viewer shape
    ├── [GAP] billing route remains authorized
    └── [GAP] projects route remains authorized

[+] Logout flow
    └── [GAP] [->E2E] header logout clears auth and returns to public entry

REGRESSION
===========================
[CRITICAL] Header/mobile logout currently call DELETE /api/auth/session.
If the route becomes GET-only without a compatibility plan, logout regresses immediately.

[CRITICAL] Root and locale pages currently redirect using viewer/session shape.
If `viewer.session.locale` disappears before those pages are updated, redirect behavior regresses immediately.
```

#### Test requirements to add

- `src/server/auth/__tests__/service.clerk.test.ts`
  - new user bootstrap
  - verified unique email bind
  - unverified email rejection
  - duplicate/conflict rejection
  - idempotent retry behavior
- `src/server/auth/__tests__/session.clerk.test.ts`
  - no session
  - missing primary email
  - successful viewer sync
- `src/app/api/auth/session/route.test.ts`
  - authenticated `GET`
  - unauthenticated `GET`
  - bridge-period `DELETE` compatibility or explicit replacement
- `src/app/[locale]/login/page.test.ts`
  - localized wrapper still renders branded Clerk entry
  - signed-in redirect still works without old session shape
- `src/app/legacy-route-redirects.test.ts`
  - keep redirect contract intact after auth migration
- `[->E2E]` auth migration happy path
  - legacy user signs in with Google/email and lands in projects with existing org/credits
- `[->E2E]` auth conflict path
  - duplicate legacy email or unverified email gets a recovery state, not a blank failure

Test plan artifact written:

- `/Users/shengyufei/.gstack/projects/ROOOU-novel-to-script/shengyufei-main-eng-review-test-plan-20260403-025323.md`

### 4. Performance Review

- Do not let every page/layout call a Clerk backend fetch if a lighter auth check or cached viewer path can be used.
- Root page, locale page, locale layout, and login page all currently perform viewer-dependent redirects or rendering. Consolidate where possible so the migration does not add duplicate auth/network work to basic navigation.

### NOT in scope

- broad auth/profile settings product work
- replacing route-level auth helpers across every route with direct Clerk calls
- billing refactor beyond identity sourcing

### What already exists

- route auth boundary via `requireViewerResponse()`
- legacy route redirect tests
- auth entry links in header/mobile
- localized login shell and copy

### Failure Modes Registry

```text
CODEPATH                              | FAILURE MODE                              | RESCUED? | TEST? | USER SEES?             | LOGGED?
--------------------------------------|-------------------------------------------|----------|-------|------------------------|--------
GET /api/auth/session                 | viewer sync not ready                     | N        | N     | opaque 401             | N
DELETE /api/auth/session              | removed during bridge                     | N        | N     | sign-out silently fails| N
root redirect                         | viewer.session.locale missing             | N        | N     | wrong redirect / crash | N
request identity fallback             | no viewer passed, cookie parser deleted   | N        | N     | downstream auth break  | N
workspace resolution                  | no viewer fallback wired                  | N        | N     | wrong workspace context| N
```

Rows 1-4 are critical until the bridge plan covers them explicitly.

### Worktree Parallelization Strategy

| Step | Modules touched | Depends on |
|---|---|---|
| Clerk runtime + middleware | root config, `src/server/auth/` | — |
| Local user sync + data model | `src/server/auth/`, `src/server/shared/platform/` | runtime available |
| Auth route + login UI bridge | `src/app/api/auth/`, `src/features/saas/`, `src/app/[locale]/`, `src/app/sign-in`, `src/app/sign-up`, shared header/nav | viewer contract stabilized |
| Legacy cleanup + docs | `src/server/auth/`, docs | bridge verified |

Parallel lanes:

- Lane A: Clerk runtime + middleware -> local user sync
- Lane B: auth route + login UI bridge
- Lane C: legacy cleanup + docs

Execution order:

- Launch Lane A first.
- Start Lane B once the viewer contract is locked.
- Lane C waits for burn-in evidence.

Conflict flags:

- Lanes A and B both touch `src/server/auth/`. Coordinate carefully or run sequentially.

### Engineering Review, Completion Summary

```text
+====================================================================+
|           ENGINEERING REVIEW - COMPLETION SUMMARY                  |
+====================================================================+
| Step 0               | scope accepted, bridge required             |
| Architecture Review  | 3 issues found                              |
| Code Quality Review  | 3 issues found                              |
| Test Review          | diagram produced, 12+ gaps identified       |
| Performance Review   | 2 issues found                              |
| Failure modes        | 5 mapped, 4 critical                        |
| Worktree strategy    | 3 lanes, 1 major conflict area              |
| Outside voice        | unavailable                                 |
+====================================================================+
```

## Cross-Phase Themes

1. **Contract stability beats cleanup speed**
   - Flagged in CEO, design, and engineering review.
   - The migration succeeds if the viewer contract stays stable while the auth source changes. It fails if we optimize for deleting old code too early.

2. **Silent auth edge cases are the real risk**
   - Flagged in CEO and engineering review, and visible in the design pass.
   - Duplicate-email linking, missing viewer context, and mixed auth-route behavior are the sharp edges. They need visible states, logs, and tests.

3. **Route coherence matters as much as identity correctness**
   - Flagged in design and engineering review.
   - `/login`, `/sign-in`, header auth actions, mobile nav, and logout behavior all need to tell the same story or users will distrust the migration instantly.

## Deferred to TODOS.md

- Auth migration burn-in dashboard and alerts
- Account-link conflict recovery path
- Legacy auth cleanup after burn-in

### Decision Audit Trail, Continued

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 4 | CEO Arch | Expand scope to include domain/repository/runtime auth-field changes | Mechanical | P1 Completeness, P2 Boil lakes | Schema-only changes would leave the data model and repository contracts inconsistent | Schema-only update |
| 5 | CEO Deploy | Defer destructive legacy auth cleanup until post-burn-in | Taste | P1 Completeness, P6 Bias toward action | Cleanup is good, but only after the bridge proves stable in production | Same-wave deletion |
| 6 | Design States | Require explicit conflict, verification, and viewer-not-ready UI states | Mechanical | P1 Completeness, P5 Explicit | Auth migrations fail in the user’s hands, not just in backend logs | Generic provider error text |
| 7 | Eng Route Contract | Preserve or replace `DELETE /api/auth/session` deliberately during the bridge | Mechanical | P1 Completeness | Header/mobile logout already depend on it, so silent removal is a regression | GET-only route swap |
| 8 | Eng Viewer Contract | Keep one stable viewer shape until all page/route consumers are migrated | Mechanical | P5 Explicit | Root pages and layouts still consume session-derived locale and auth context | Split Clerk-only vs legacy viewer shapes |
| 9 | Eng Tests | Promote logout-route regression and locale-viewer regression to critical tests | Mechanical | P1 Completeness | Both are existing behaviors that the diff would otherwise break immediately | Happy-path-only auth tests |

## AUTOPLAN APPROVAL

- Approval date: `2026-04-03` Asia/Shanghai
- Selected path: `A` — keep the reviewed plan as a two-phase Clerk bridge, then defer destructive legacy-auth cleanup until after burn-in.
- Approval scope: proceed with the reviewed direction, not a declaration that all review findings are cleared.
- Cross-check: subagent `Euler` verified the plan has no missing required sections; only heading consistency cleanup was needed.
- Runtime note: external Codex outside-voice execution was unavailable in this workspace because the non-ASCII path triggered a websocket/header failure, so the dual-voice tables remain accurately marked unavailable.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | `issues_open` | 1 proposal, 1 accepted, 3 deferred |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | `issues_open` | 20 issues, 4 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | `issues_open` | score: 4/10 -> 7/10, 6 decisions |

**UNRESOLVED:** 4 total unresolved review decisions remain open, all in the design/runtime edge-state layer.

**VERDICT:** OPTION A APPROVED — implement the two-phase bridge. CEO + ENG + DESIGN reviews all ran, but the plan still carries open execution risks and is not in a fully clear state yet.
