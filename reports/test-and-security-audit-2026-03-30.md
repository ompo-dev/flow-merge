# Flow Merge Audit - 2026-03-30

## Scope

- Auth and license lifecycle
- Billing and payment simulation
- Release roles and channel access
- Dynamic code execution surfaces
- Dependency hygiene
- Test automation baseline

## Automated Checks Run

- `bun run lint`
- `bun run test:coverage`
- `bun run test:e2e`
- `bun run build`
- `bun audit`

## Changes Applied

### Security hardening

- Added `server-only` boundaries to server modules:
  - `src/lib/auth.ts`
  - `src/lib/server-env.ts`
  - `src/lib/prisma.ts`
  - `src/lib/server/license-service.ts`
  - `src/lib/server/abacatepay.ts`
- Added blocked-capability scanning before all `new Function` execution paths:
  - programmable node expressions
  - programmable node code mode
  - runtime `action_code` and `action_function`
- Added request throttling for critical server surfaces:
  - `src/app/api/auth/[...all]/route.ts`
  - `src/app/api/billing/charges/route.ts`
  - `src/app/api/billing/cancel/route.ts`
  - `src/app/api/billing/simulate/route.ts`
  - `src/app/api/license/status/route.ts`
- Added shared in-memory rate limiting buckets for auth, billing, and license polling:
  - `src/lib/server/rate-limit.ts`
- Overrode `dompurify` to `3.3.3` because the current `monaco-editor` latest still pins a vulnerable version:
  - `package.json`
  - `bun.lock`
- Added explicit timeout and upstream error normalization for AbacatePay requests:
  - `src/lib/server/abacatepay.ts`
- Degraded AbacatePay PIX creation failures into controlled API responses instead of raw 500 crashes:
  - `src/app/api/billing/charges/route.ts`
- Removed legacy unused local auth implementation:
  - `src/lib/local-auth.ts`

### Test automation

- Added Vitest with coverage
- Added Playwright E2E infrastructure:
  - `playwright.config.ts`
  - `scripts/e2e-serve.ts`
  - `tests/e2e/*`
- Added unit/integration coverage for:
  - `src/app/api/auth/[...all]/route.ts`
  - `src/app/api/billing/cancel/route.ts`
  - `src/app/api/billing/charges/route.ts`
  - `src/app/api/billing/simulate/route.ts`
  - `src/app/api/license/status/route.ts`
  - `src/lib/billing-rules.ts`
  - `src/lib/code-safety.ts`
  - `src/lib/node-programming.ts`
  - `src/lib/release-access.ts`
  - `src/lib/runtime-engine.ts`
  - `src/lib/server/abacatepay.ts`
  - `src/lib/server-env.ts`
  - `src/lib/server/license-service.ts`
  - `src/lib/server/rate-limit.ts`
  - `src/store/useAuthStore.ts`
- Added browser E2E coverage for:
  - anonymous landing positioning and comparison messaging
  - Google login flow initiation from the landing access node
  - account/settings billing surface for active monthly subscriptions
  - internal role downgrade and local-role simulation visibility
  - blocked account lock screen with PIX payload rendering
  - blocked account recovery after payment confirmation
  - destructive local wipe when the backend marks the account as deleted
  - sign-out back to the anonymous landing surface
  - destructive local wipe when the authenticated user changes across refresh

## Current Validation Snapshot

- `bun run lint`: pass
- `bun run test:coverage`: pass
- `bun run test:e2e`: pass
- `bun run build`: pass
- `bun audit`: pass

Coverage snapshot after this pass:

- `15` test files
- `47` tests passing
- `9` Playwright E2E tests passing
- route coverage:
  - `src/app/api/auth/[...all]/route.ts`: `100%`
  - `src/app/api/license/status/route.ts`: `83.33%`
  - billing routes: `74-75%`
- server module coverage:
  - `src/lib/server/abacatepay.ts`: `87.5%`
  - `src/lib/server/license-service.ts`: `58.13%`
- client store coverage:
  - `src/store/useAuthStore.ts`: `60.6%`

## Findings Fixed

1. Dynamic code execution had no safety gate before `new Function`.
   Status: fixed with capability blocking in `src/lib/code-safety.ts`.

2. Server-only modules could be imported accidentally into client bundles.
   Status: fixed with `server-only` guards.

3. Legacy browser-local auth code remained in the repo without any live references.
   Status: removed.

4. Auth, billing, and license endpoints had no throttling boundary.
   Status: fixed with route-level rate limiting and dedicated tests for throttling behavior.

5. The dependency tree shipped a vulnerable `dompurify` via `monaco-editor`.
   Status: fixed with a package override to `dompurify 3.3.3` and a clean `bun audit`.

6. AbacatePay failures could bubble as raw unclassified backend errors.
   Status: fixed with timeout/upstream normalization in the provider client and controlled route degradation for PIX creation.

## Residual Risks

1. Dynamic code is still not sandboxed.
   Even with blocked globals and network/storage APIs, `new Function` remains a local execution surface. If the product ever supports untrusted shared/imported workflows at scale, this should move to a hardened sandbox or isolated worker/runtime.

2. DeepSeek key is still persisted in browser local storage.
   Files:
   - `src/store/useFlowStore.ts`
   Risk:
   - any XSS or shared-device compromise exposes the key
   Suggested next step:
   - move to desktop secure storage where available and avoid persistent storage on web

3. Test coverage is still thin outside the commercial/security core.
   Current automated coverage now includes critical browser flows, but remains focused on auth/billing/roles/code-execution boundaries rather than the full canvas/runtime/UI surface.

## Priority Next Steps

1. Replace web local-storage persistence for AI keys with safer storage rules.
2. Add higher-depth tests for:
   - Prisma-backed license transitions
   - destructive account deletion countdown and local wipe behavior
3. Expand E2E from mocked commercial flows to:
   - real payment recovery beyond mocked status transitions
   - real Google OAuth callback completion instead of login-init mock
   - session restore across a true Better Auth cookie round-trip
