# Clerk Production Rollout Checklist

## 1. Production Instance

- [ ] Confirm you are configuring the Clerk production instance, not the development instance.
- [ ] Confirm the production application domain matches the real public site domain.

## 2. Environment Variables

### Clerk

- [ ] Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [ ] Set `CLERK_SECRET_KEY`

### PayPal

- [ ] Set `PAYPAL_CLIENT_ID`
- [ ] Set `PAYPAL_CLIENT_SECRET`
- [ ] Set `PAYPAL_MODE=live`
- [ ] Set `PAYPAL_WEBHOOK_ID`
- [ ] Set `PAYPAL_PLAN_ID_CREATOR`
- [ ] Set `PAYPAL_PLAN_ID_PRO`

### Legacy cleanup

- [ ] Remove `AUTH_SECRET`
- [ ] Remove `NOVELSCRIPT_AUTH_SECRET`

## 3. Clerk Dashboard Setup

### Sign-in methods

- [ ] Enable `Google`
- [ ] Enable `Email`
- [ ] Decide whether password login remains enabled or stays lower priority than Google and email magic link

### Google OAuth

- [ ] Create or confirm the production Google OAuth client
- [ ] Add the production Clerk redirect URI in Google Cloud
- [ ] Save the Google client id and secret in Clerk
- [ ] Complete one real Google sign-in against the production domain

### Redirect paths

- [ ] Confirm sign-in path is `/sign-in`
- [ ] Confirm sign-up path is `/sign-up`
- [ ] Confirm post-login redirect can land on `/en-US/projects`
- [ ] Confirm post-login redirect can land on `/zh-CN/projects`

## 4. Route Protection Validation

- [ ] Verify unauthenticated access to `/:locale/projects`
- [ ] Verify unauthenticated access to `/:locale/billing`
- [ ] Verify unauthenticated access to `/api/projects/*`
- [ ] Verify unauthenticated access to `/api/billing/*`
- [ ] Confirm authenticated access does not cause redirect loops

## 5. Legacy User Migration Checks

- [ ] Sign in with an email that already exists in the local database
- [ ] Confirm the login uses a verified Clerk email
- [ ] Confirm the local user is linked instead of duplicated
- [ ] Confirm existing projects remain visible
- [ ] Confirm existing credits remain visible
- [ ] Confirm existing subscription state remains visible
- [ ] Confirm existing PayPal payment history still belongs to the same organization

## 6. New User Bootstrap Checks

- [ ] Sign in with a brand new email
- [ ] Confirm a local user record is created
- [ ] Confirm a default organization is created
- [ ] Confirm a default workspace is created
- [ ] Confirm a free subscription is created
- [ ] Confirm a credit account is created
- [ ] Confirm the initial free credit grant is appended to the ledger

## 7. Core Runtime Checks

- [ ] Confirm `/api/auth/session` returns the current viewer for an authenticated Clerk session
- [ ] Confirm the localized login page still routes correctly
- [ ] Confirm the header sign-out button returns the user to the localized home page
- [ ] Confirm sign-up buttons route to `/sign-up`
- [ ] Confirm sign-in buttons route to `/{locale}/login` and reach Clerk sign-in correctly

## 8. Billing Safety Checks

- [ ] Complete one credit pack purchase in the production-like environment
- [ ] Confirm the payment order is recorded under the expected local organization
- [ ] Confirm credits are granted after successful payment
- [ ] Complete one subscription purchase
- [ ] Confirm the subscription state updates locally
- [ ] Confirm the billing summary page still loads after the auth migration
- [ ] Confirm PayPal webhooks still reconcile orders and subscriptions correctly

## 9. Deployment Checks

- [ ] Deploy with Clerk production keys
- [ ] Confirm middleware is active in production
- [ ] Confirm `npm test` passed on the branch before release
- [ ] Confirm `npm run typecheck` passed on the branch before release

## 10. Post-Launch Monitoring

- [ ] Watch Google sign-in success rate
- [ ] Watch email login success rate
- [ ] Watch legacy-account link conflicts
- [ ] Watch `/api/auth/session` 401 rates
- [ ] Watch PayPal checkout completion rate
- [ ] Watch PayPal webhook failures
- [ ] Watch support requests related to login, redirects, or missing credits

## 11. Rollback Notes

- [ ] Keep the Clerk migration branch and PR link available during rollout
- [ ] Record the previous production auth configuration before switching
- [ ] Make sure someone can quickly restore environment variables if rollout must be reversed
