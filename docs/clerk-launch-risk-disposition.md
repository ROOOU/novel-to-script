# Clerk Launch Risk Disposition

Status as of 2026-04-03:

- PR branch: `codex/clerk-auth-migration`
- Latest fix: `5cab810` closed the two pre-landing redirect blockers
- Latest follow-up: `generate` and `storyboard` now use the viewer-required platform-context contract
- Local verification: `npm run typecheck`, `npm test`

This document separates the remaining Clerk migration risks into three buckets:

1. must fix before merge
2. must validate before production rollout
3. safe to observe during burn-in

Execution runbook:

- `docs/clerk-rollout-execution-runbook.md`

## 1. Must Fix Before Merge

No known merge-blocking code risks remain from the original review set.

The prior highest-risk issue has now been closed:

- `src/app/api/generate/route.ts`
- `src/app/api/storyboard/route.ts`

These routes now use the viewer-required platform-context helper instead of continuing on optional
viewer defaults when identity resolution fails.

## 2. Must Validate Before Production Rollout

These are not merge blockers if the branch remains in Phase 1 bridge mode, but they must be
proven before production cutover.

### Identity-linking and legacy-user continuity

Run a real production-like validation for:

- legacy user signs in with a verified Clerk email
- local user is linked instead of duplicated
- existing projects remain visible
- existing credits remain visible
- existing subscription and billing history remain visible

Primary code path:

- `src/server/auth/service.ts`
- `src/server/auth/session.ts`

### `/api/auth/session` on real Clerk-authenticated traffic

Confirm `GET /api/auth/session` returns the expected viewer payload when the user is authenticated
through Clerk, not just in tests.

Primary code path:

- `src/app/api/auth/session/route.ts`
- `src/server/auth/http.ts`

### PayPal ownership and reconciliation

Validate that the auth migration did not change which local organization owns:

- one-time credit-pack purchases
- subscription purchases
- webhook reconciliation

Primary areas:

- `src/app/api/billing/**`
- `src/server/billing/**`

### Production env and provider setup

These are still checklist items, not proven rollout facts:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- production `DATABASE_URL`
- live PayPal keys and webhook id
- Clerk production instance and domain alignment
- Google OAuth production callback configuration

### Build and deploy gate

CI now includes a full `npm run build` gate, and the repository has a production preflight command:

- `npm run build`
- `npm run preflight:production`

Before rollout, explicitly run and record:

- a production-like smoke test on the deployed preview or staging target

## 3. Safe To Observe During Burn-In

These should be monitored during the Phase 1 bridge period rather than blocking merge.

### Viewer-sync failure rate

Watch for users who are authenticated in Clerk but fail viewer resolution and get treated as
logged out.

Signals to monitor:

- `GET /api/auth/session` `401` rate
- redirects from protected localized pages back to `/{locale}/login`
- `AUTH_ACCOUNT_LINK_CONFLICT`
- `CLERK_PRIMARY_EMAIL_MISSING`

### Login and redirect continuity

Watch for unexpected user reports involving:

- post-login redirect landing on the wrong localized page
- sign-out returning to the wrong localized home page
- preview deployments behaving differently from production

### Payment-flow regressions after auth switch

Watch for:

- PayPal checkout completion drops
- webhook failures
- credits not appearing after successful payment
- subscriptions failing to appear in billing summary

## 4. Recommended Owners

Suggested ownership split for closing the remaining work:

- engineering: optional-viewer write-path hardening, build gate, smoke coverage
- product/ops: rollout checklist execution, OAuth/provider setup, release go/no-go
- support/monitoring: burn-in dashboard, alert thresholds, conflict-recovery playbook

## 5. Merge Recommendation

Current recommendation:

- merge is reasonable from the current code state
- production rollout should wait until the checklist items above are explicitly validated
- legacy auth secret removal stays in Phase 2 after burn-in, not in the initial cutover
