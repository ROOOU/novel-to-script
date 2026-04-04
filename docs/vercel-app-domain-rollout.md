# Vercel Rollout Checklist for `app.012294.xyz`

Use this order. Do not skip the database step.

## 1. Vercel Project and Domain

- [x] Create Vercel project `novel-to-script`
- [x] Link local repo to the Vercel project
- [x] Add `012294.xyz` to the Vercel team
- [x] Add `app.012294.xyz` to the `novel-to-script` project
- [x] Create Cloudflare DNS record `app.012294.xyz -> cname.vercel-dns.com`
- [x] Keep Cloudflare on `DNS only` for `app.012294.xyz`

## 2. Production Data Requirement

- [ ] Provision a production Postgres database
- [ ] Set `DATABASE_URL` in Vercel Production

Without `DATABASE_URL`, the app falls back to local file storage. That is not safe on Vercel.

## 3. Required Vercel Production Environment Variables

- [ ] `NEXT_PUBLIC_APP_URL=https://app.012294.xyz`
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...`
- [ ] `CLERK_SECRET_KEY=sk_live_...`
- [ ] `DATABASE_URL=...`
- [ ] `OPENAI_API_KEY=...`
- [ ] `OPENAI_BASE_URL=https://your-provider.example.com/v1`
- [ ] `MODEL_NAME=your-model-name`
- [ ] `PAYPAL_CLIENT_ID=...`
- [ ] `PAYPAL_CLIENT_SECRET=...`
- [ ] `PAYPAL_MODE=live`
- [ ] `PAYPAL_WEBHOOK_ID=...`
- [ ] `PAYPAL_PLAN_ID_CREATOR=...`
- [ ] `PAYPAL_PLAN_ID_PRO=...`

Recommended:

- [ ] `REDIS_URL=...`

Optional database tuning:

- [ ] `DATABASE_POOL_SIZE=...`
- [ ] `DATABASE_IDLE_TIMEOUT=...`
- [ ] `DATABASE_CONNECT_TIMEOUT=...`

Do not reuse local development values like `http://localhost:3000`, Clerk `pk_test_...`, Clerk `sk_test_...`, or `PAYPAL_MODE=sandbox`.

This app can use an OpenAI-compatible provider. In production, keep the auth key in `OPENAI_API_KEY`, and point requests with `OPENAI_BASE_URL` plus `MODEL_NAME`.

## 4. Clerk Production Setup

- [ ] In Clerk Production, set the application domain to `app.012294.xyz`
- [ ] Confirm sign-in path `/sign-in`
- [ ] Confirm sign-up path `/sign-up`
- [ ] Enable `Google`
- [ ] Enable `Email`
- [ ] Redeploy after switching Clerk production domain or keys

## 5. Google OAuth Update

- [ ] Add `https://app.012294.xyz` to Authorized JavaScript origins
- [ ] Replace Authorized redirect URIs with the Clerk Production redirect URIs for this domain

## 6. First Production Deploy

- [ ] Deploy only after all required Production env vars are set
- [ ] Use the `codex/clerk-auth-migration` code or the branch you intend to release
- [ ] Confirm Vercel shows a successful production deployment

## 7. First Verification Pass

- [ ] Open `https://app.012294.xyz`
- [ ] Open `https://app.012294.xyz/sign-in`
- [ ] Open `https://app.012294.xyz/sign-up`
- [ ] Verify Google sign-in works
- [ ] Verify redirect lands on `/{locale}/projects`
- [ ] Verify sign-out returns to the localized home page
- [ ] Verify `/api/auth/session` returns viewer data when signed in
- [ ] Verify a legacy email account links to existing local data
- [ ] Verify a new email account gets default org, workspace, subscription, and credits

## 8. Billing Verification

- [ ] Complete one PayPal purchase in the target environment
- [ ] Confirm payment order is recorded under the correct organization
- [ ] Confirm credits or subscription state update locally
- [ ] Confirm PayPal webhook handling still succeeds

## 9. Stop Conditions

Do not cut real traffic to `app.012294.xyz` yet if any of these are still true:

- [ ] `DATABASE_URL` is missing
- [ ] Clerk is still using test keys
- [ ] Google OAuth still points at the old domain
- [ ] PayPal is still on sandbox while you expect live payments
- [ ] There is no successful production deployment in Vercel
