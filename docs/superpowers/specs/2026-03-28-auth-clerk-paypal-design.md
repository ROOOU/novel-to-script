# NovelScript Authentication Migration Design

> Date: 2026-03-28
> Status: Approved for implementation
> Scope: Replace self-built authentication with Clerk while keeping PayPal as the only payment provider for an overseas individual-creator SaaS.

## 1. Decision Summary

NovelScript will migrate authentication from the current self-built email/password and signed-cookie session system to Clerk.

PayPal will remain the only payment provider in this phase.

Target users remain overseas individual creators. The preferred sign-in methods are:

- Google sign-in
- Email magic link
- Optional email/password as a lower-priority fallback inside Clerk

The migration goal is to remove long-term authentication security and maintenance burden from the application while preserving the existing local business model:

- local user profile
- organization and workspace bootstrap
- project ownership
- credit account and ledger
- PayPal payment orders
- subscription state and entitlements

## 2. Why This Change

The current auth model is functional but too expensive to maintain over time for a solo product:

- password verification is implemented locally
- session cookies are signed locally
- account recovery, email verification, account linking, session revocation, and login risk handling would all need ongoing custom work

By contrast, the current PayPal integration already matches product positioning and is structurally aligned with the existing billing model:

- one-time credit pack purchases
- subscription checkout
- webhook verification
- payment fulfillment into local subscription and credits state

Therefore, authentication should be outsourced first, while billing remains local and PayPal-backed.

## 3. Product Direction

### 3.1 Audience

The product serves overseas individual creators, not teams or enterprise buyers.

### 3.2 Authentication UX

NovelScript should present authentication in this priority order:

1. Continue with Google
2. Continue with Email
3. Optional password sign-in inside Clerk, but not as the main product story

This reduces friction for creators and keeps support burden lower than a self-managed password-first model.

### 3.3 Billing UX

PayPal remains the only payment method in this phase.

This keeps billing coherent with current product positioning and avoids expanding payment scope during the auth migration.

## 4. Current-State Assessment

### 4.1 Keep

The following areas remain strategic and should be preserved:

- PayPal integration and webhook flow
- local billing domain
- local subscription and credit ledger
- organization, workspace, project, and artifact model
- project workspace UX and generation pipeline

Key current files worth preserving structurally:

- `src/server/billing/paypal.ts`
- `src/server/billing/payments.ts`
- platform domain and runtime layers

### 4.2 Replace or Reshape

The following areas are part of the auth migration surface:

- `src/server/auth/service.ts`
- `src/server/auth/session.ts`
- `src/app/api/auth/session/route.ts`
- `src/features/saas/LoginForm.tsx`

These areas currently combine authentication, session management, and business-user bootstrap. After migration, they must be separated.

## 5. Target Architecture

### 5.1 Responsibility Split

Clerk will own:

- sign-in methods
- session issuance and validation
- Google OAuth
- email magic link
- email verification
- optional password sign-in

NovelScript will continue to own:

- business user records
- organization and workspace provisioning
- billing ownership
- PayPal orders, subscriptions, capture, and webhook handling
- entitlements, credits, and usage
- project and artifact authorization

### 5.2 Identity Model

The system will move from:

- self-built session cookie -> local user lookup -> business data

to:

- Clerk session -> Clerk user id -> local business user lookup -> business data

### 5.3 Local User Model

The local `users` table remains the source of truth for business identity inside NovelScript, but no longer serves as the primary authentication account store.

Recommended additions to the local user model:

- `authProvider`
- `authUserId`
- `emailVerifiedAt` or equivalent verified flag
- `lastAuthSyncAt`

Existing fields that should become legacy-oriented instead of central:

- `passwordHash`

The new model treats the local user row as a business profile linked to an external auth identity.

## 6. Login and User-Provisioning Flow

### 6.1 New User Flow

1. User signs in with Google or email via Clerk.
2. Server receives Clerk identity.
3. NovelScript checks for a local user by `authUserId`.
4. If none exists, it checks for a verified-email match against an existing local user.
5. If no match exists, NovelScript creates:
   - local user
   - default organization
   - default workspace
   - free subscription
   - initial credit account and initial ledger grant
6. User is redirected into the product.

### 6.2 Existing User Flow

1. Existing user signs in through Clerk.
2. NovelScript receives Clerk identity and verified email.
3. If the verified email matches a legacy local account, NovelScript binds that account to the Clerk identity.
4. Existing organization, workspace, projects, credits, and payment records remain attached to the same local user and organization context.

### 6.3 Binding Guardrails

Automatic binding must only occur when:

- the Clerk email is verified
- the email match is unique
- there is no conflicting auth identity already linked

If any of these conditions fail, the system must stop automatic linking and return a recoverable error or admin-resolution path.

## 7. Session Strategy

The current signed cookie session should be retired from the primary path.

The target runtime model is:

- Clerk session provides authenticated identity
- NovelScript builds a local viewer object from Clerk identity
- downstream APIs read the local viewer, not a self-signed cookie payload

This means the old session layer should be replaced by a thin adapter focused on:

- reading Clerk auth context
- resolving local user
- loading organization, workspace, subscription, and credit account as needed

## 8. Billing Boundary

PayPal stays unchanged in this phase except for identity sourcing.

The billing domain must continue to anchor on local business entities:

- local user id
- organization id
- workspace id where applicable
- payment order id
- subscription id

PayPal must not become directly coupled to Clerk-specific business logic beyond the user-identity lookup needed to determine the current local viewer.

This protects the billing model from auth-vendor lock-in.

## 9. Module-Level Refactor Plan

### 9.1 Authentication Service Layer

Current `src/server/auth/service.ts` should be reshaped from password authentication into business-user synchronization logic.

New responsibilities:

- resolve local user from Clerk identity
- create local user and default tenancy if absent
- bind legacy user to Clerk identity when safe
- return local viewer bootstrap data

Old responsibility to remove:

- direct password verification as the primary auth path

### 9.2 Session Layer

Current `src/server/auth/session.ts` should stop issuing and verifying self-built signed session tokens for the main flow.

Its future role, if the file remains, should be a minimal compatibility or adapter layer around current viewer resolution.

### 9.3 Auth API

`src/app/api/auth/session/route.ts` should stop being the login endpoint.

Recommended target behavior:

- `GET` returns current local viewer summary for authenticated users
- `POST` password login is removed from the main path and eventually deleted
- `DELETE` logout should be handled by Clerk-driven sign-out flow instead of local cookie clearing

### 9.4 Login UI

`src/features/saas/LoginForm.tsx` should no longer be a custom email/password-first form.

It should become either:

- Clerk hosted or embedded UI wrapped in NovelScript branding, or
- a custom login screen that triggers Clerk auth methods

Preferred ordering:

1. Google
2. Email magic link
3. Optional password

### 9.5 Viewer and Request Context

Any file that currently depends on self-built session parsing must move to Clerk-based identity resolution, especially:

- viewer access helpers
- request identity
- request context resolution
- API auth guards

The system should not redesign authorization semantics in this phase. Only the identity source changes.

## 10. Migration Strategy

This migration should be incremental, not a hard cutover.

### Phase 1: Introduce Clerk Without Touching PayPal

Goals:

- integrate Clerk
- enable Google and email auth
- synchronize local business users
- preserve existing PayPal behavior

Acceptance criteria:

- new users can sign in and receive local workspace bootstrap
- legacy users can sign in with matching verified email and keep existing data
- billing pages and PayPal checkout continue to work

### Phase 2: Replace Self-Built Session Dependencies

Goals:

- migrate all authenticated page and API identity reads to Clerk-backed viewer resolution
- stop depending on self-signed session cookies for the main path

Acceptance criteria:

- pages and APIs work without the old local session cookie
- local viewer is consistently resolved from Clerk identity
- logout and session refresh behavior are stable

### Phase 3: Remove Legacy Auth Paths

Goals:

- retire local password-first flows
- delete obsolete token-signing logic
- update docs and environment configuration

Acceptance criteria:

- no production auth-critical flow depends on self-built session signing
- legacy password logic is clearly removed or isolated for archival reasons only
- docs match the final runtime model

## 11. Risks and Controls

### 11.1 Wrong Account Linking

This is the highest-risk area.

Controls:

- only link on verified email
- require uniqueness
- reject ambiguous matches
- audit legacy-user migration with backups and sampled verification before full rollout

### 11.2 Billing Regression During Auth Migration

Controls:

- do not refactor billing in the same phase
- keep payment ownership anchored on local entities
- isolate auth changes to identity resolution

### 11.3 Scope Expansion

Controls:

- do not add team features
- do not redesign subscription management portal
- do not add extra auth providers beyond the chosen user-facing methods
- do not combine auth migration with broader billing redesign

### 11.4 Environment Drift

Controls:

- separate Clerk environment variables from PayPal variables
- remove hidden reliance on local auth secret as mainline auth stabilizes
- update setup docs alongside code rollout

## 12. Out of Scope

The following are intentionally excluded from this design:

- team collaboration or member invitation
- enterprise SSO
- multi-provider account center
- deep account-security management UI
- additional payment providers
- major billing-domain redesign

## 13. Recommendation

Proceed with:

- Clerk for authentication
- PayPal as the only payment provider
- incremental migration in three phases

This gives NovelScript the best balance of:

- lower security burden
- better overseas-user sign-in UX
- preserved billing stability
- minimal disruption to the product's current project and credit model
