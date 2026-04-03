# Clerk Rollout Execution Runbook

Use this runbook for the production cutover of the Clerk auth migration.

Evidence file for this rollout:

- `docs/release-evidence/clerk-rollout-2026-04-03.md`

## 1. Engineering Owner Tasks (Must Complete Before Traffic Cutover)

1. Verify branch health gates.
What: confirm code health on release commit.
How to verify:
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run preflight:production`
Evidence location:
- paste command outputs in `docs/release-evidence/clerk-rollout-2026-04-03.md`
- attach CI links

2. Validate authenticated session contract.
What: ensure Clerk-authenticated users resolve to viewer payload.
How to verify:
- sign in with production-like account
- call `GET /api/auth/session`
- confirm response shape: `{ ok: true, viewer: ... }`
Evidence location:
- API response sample and request id in evidence doc

3. Validate protected route behavior.
What: ensure unauthenticated access is blocked and authenticated access does not loop.
How to verify:
- open `/{locale}/projects`, `/{locale}/billing` while signed out and confirm redirect to `/{locale}/login`
- repeat while signed in and confirm page loads
Evidence location:
- screenshot links and route checklist in evidence doc

4. Validate generation routes require viewer context.
What: ensure generation endpoints no longer continue with anonymous/demo defaults.
How to verify:
- call `POST /api/generate` and `POST /api/storyboard` while signed out
- confirm shared `401 UNAUTHORIZED`
Evidence location:
- API response samples with request ids in evidence doc

## 2. Ops Owner Tasks (Must Complete Before Traffic Cutover)

1. Confirm production env set and sane.
What: set required Clerk, DB, PayPal, and app-domain env values.
How to verify:
- run `npm run preflight:production` with production env
- verify no `pk_test_`, `sk_test_`, `localhost`, or `PAYPAL_MODE=sandbox`
Evidence location:
- preflight output and env checklist in evidence doc

2. Confirm Clerk production dashboard setup.
What: production instance, domain, methods, redirect paths.
How to verify:
- production Clerk app domain matches `app.012294.xyz`
- sign-in methods include Google and Email
- redirect paths configured for `/sign-in` and `/sign-up`
Evidence location:
- dashboard screenshots and checklist in evidence doc

3. Confirm Google OAuth production redirect setup.
What: Google OAuth client points to Clerk production redirect URIs.
How to verify:
- verify Authorized JavaScript origins and redirect URIs
- complete one real Google sign-in
Evidence location:
- screenshots and successful sign-in note in evidence doc

4. Confirm production data safety.
What: do not run production on file-backed runtime.
How to verify:
- ensure `DATABASE_URL` is set and points to production Postgres
- verify successful production deployment in Vercel
Evidence location:
- Vercel deployment link and DB verification note

## 3. Joint Engineering + Ops Validation (Must Complete Before Traffic Cutover)

1. Legacy user continuity check.
What: legacy verified-email account maps to existing local records.
How to verify:
- sign in with legacy account
- verify projects, credits, subscription, and payment history continuity
Evidence location:
- user id / org id continuity note in evidence doc

2. New user bootstrap check.
What: new account gets default org/workspace/subscription/credits.
How to verify:
- sign in with new email
- verify local user + org + workspace + free subscription + initial credits
Evidence location:
- record ids and screenshot/API snippets in evidence doc

3. Billing and webhook safety check.
What: payment ownership and webhook reconciliation remain correct.
How to verify:
- complete one credit-pack purchase
- complete one subscription purchase
- confirm webhook events reconcile and local state updates
Evidence location:
- order ids/subscription ids/webhook event ids in evidence doc

## 4. Burn-In Monitoring (Support + Engineering, First 24-72 Hours)

Track at least hourly during first day, then daily:

- Google sign-in success rate
- Email sign-in success rate
- `/api/auth/session` 401 rate
- `AUTH_ACCOUNT_LINK_CONFLICT` count
- PayPal checkout completion rate
- PayPal webhook failure rate
- support tickets mentioning login redirect, missing projects, missing credits

Suggested initial alert thresholds:

- `/api/auth/session` 401 rate > 5% for 15 minutes
- auth account-link conflicts >= 3 within 30 minutes
- PayPal webhook failures >= 2 consecutive events
- checkout completion drop >= 20% versus pre-rollout baseline

Evidence location:

- metrics snapshots and incident notes in evidence doc

## 5. Stop/Rollback Conditions

Pause rollout immediately if any of these occur:

- legacy users lose existing projects/credits/subscription continuity
- signed-in users repeatedly receive `401` on `/api/auth/session`
- PayPal payments complete but local credit/subscription state does not update
- webhook verification or reconciliation repeatedly fails

Rollback checklist:

1. keep PR/branch reference available for comparison
2. restore previous production auth/env configuration
3. verify login + billing sanity on previous stable configuration
4. record rollback timestamp, reason, and owner in evidence doc
