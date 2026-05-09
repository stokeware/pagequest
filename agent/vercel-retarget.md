# Page Quest Vercel Retarget Plan

Status: Ready for execution by a coding agent
Updated: 2026-05-09

## 1. Objective

Retarget Page Quest from the current Azure-oriented production contract to a
lower-friction hosted stack built around:

- Vercel for the Next.js application
- Neon for PostgreSQL
- Resend for transactional email
- Auth0 for hosted authentication

GitHub remains the code repository host and source of truth. Vercel should be
connected directly to the GitHub repository so pull requests receive preview
deployments and `main` receives production deployments.

This plan is written as an execution sequence for a coding agent. It focuses on
repo changes, tests, deployment contracts, and documentation. Manual control
plane setup in Vercel, Neon, Resend, and Auth0 is called out where needed, but
the code path is intentionally optimized to minimize code churn.

## 2. Recommended platform decisions

### Primary auth choice: Auth0

Use Auth0 as the hosted auth provider for the first retarget.

Reasons:

- The repo already uses Auth.js via `next-auth` and a provider-based auth model.
- Auth0 slots into the existing Auth.js architecture with much less code churn
  than Clerk.
- The current local credentials mode can stay in place for local development,
  CI, and Playwright without requiring an external identity dependency.

### Email choice: Resend over SMTP first

Use Resend through SMTP for the first hosted email integration.

Reasons:

- SMTP is already implemented in `lib/email/service.ts`.
- This avoids introducing a second email transport abstraction or SDK rewrite.
- Resend-specific API integration can be deferred unless SMTP proves limiting.

### Database choice: Neon with pooled runtime URL and direct migration URL

Use Neon as the hosted PostgreSQL provider with:

- `DATABASE_URL` for runtime connections
- `DIRECT_URL` for migrations and administrative commands

The current Prisma runtime already uses `pg` plus `@prisma/adapter-pg`, which is
compatible with a normal hosted PostgreSQL connection string.

## 3. Current repo findings that drive the plan

1. Production environment validation is currently hard-coded to require Entra
   auth and Azure email in `lib/env.ts` and `tests/environment-validation.test.ts`.
2. Auth currently supports only `local` and `entra` modes in
   `lib/auth/config.ts` and `lib/auth.ts`.
3. The hosted auth UI is explicitly branded for Microsoft Entra External ID in
   `app/(public)/sign-in/page.tsx` and
   `components/public/sign-in-form.tsx`.
4. SMTP email already works in `lib/email/service.ts`, while the Azure
   Communication Services path is intentionally not wired.
5. Runtime Prisma uses `pg` through `lib/prisma.ts`, so Neon should not require
   a fundamental database access rewrite.
6. The repository already has a single GitHub Actions CI workflow in
   `.github/workflows/ci.yml`. That should stay focused on CI. Vercel should own
   deployment.
7. Production env validation currently runs in `scripts/start`, but Vercel does
   not use `next start` the same way an App Service deployment does. Production
   validation must move earlier into the Vercel build path.

## 4. Delivery principles for the retarget

- Keep local auth and local SMTP behavior intact for local development and CI.
- Minimize the first hosted cutover by choosing Auth0 and Resend SMTP instead of
  rewriting auth or email abstractions from scratch.
- Keep deployment responsibilities split cleanly:
  GitHub Actions for CI, Vercel for deployment.
- Make the production contract provider-specific only where required.
- Preserve a small rollback path by introducing the new hosted configuration
  behind additive code changes first, then removing Azure-only assumptions.

## 5. Phase-by-phase execution plan

## Phase 0: Establish the target contract and branch strategy

### Goal

Freeze the intended hosted architecture and prevent the migration from drifting
into two parallel auth systems or two deployment systems.

### Tasks

1. Create a short architecture note in docs that declares the new production
   platform as Vercel, Neon, Resend, and Auth0.
2. Declare Auth0 as the primary hosted auth path for this retarget.
3. Explicitly keep GitHub as the repository host and CI runner.
4. Explicitly keep the local credentials auth mode for local-only development,
   tests, and seeded demo data.
5. Record the deployment model:
   GitHub push and pull request events trigger CI in GitHub Actions, while
   Vercel connects to GitHub for preview and production deploys.

### Files to touch

- `agent/vercel-retarget.md`
- `README.md`
- `docs/azure-deployment.md`
- new deployment docs file, such as `docs/vercel-deployment.md`

### Validation

- The repo has one clear deployment story and one clear hosted auth choice.
- There is no ambiguity about whether GitHub Actions or Vercel owns deployment.

## Phase 1: Replace the Azure-only production environment contract

### Goal

Make production validation describe the new hosted stack instead of enforcing
Azure-specific providers.

### Tasks

1. Update `lib/env.ts` so the production contract allows:
   - `PAGEQUEST_AUTH_MODE=auth0`
   - `PAGEQUEST_EMAIL_DELIVERY_MODE=smtp`
   - Resend SMTP variables
   - Auth0 provider variables
2. Remove the Azure-only production assertions that currently require:
   - `PAGEQUEST_AUTH_MODE` to equal `entra`
   - `PAGEQUEST_EMAIL_DELIVERY_MODE` to equal
     `azure-communication-services`
3. Add Auth0-specific env parsing helpers alongside the current local auth
   parsing. The exact names can be either provider-specific or generic, but the
   repo should pick one style and use it everywhere.
4. Keep `APP_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `DATABASE_URL`,
   `DIRECT_URL`, and `EMAIL_FROM` as required production inputs.
5. Add a dedicated Vercel production validation path so the validation runs
   during build or before build, not only during `next start`.
6. Update `scripts/validate-env.mts` documentation and any script comments so
   the target contract is clear.

### Files to touch

- `lib/env.ts`
- `lib/auth/config.ts`
- `lib/email/config.ts`
- `scripts/validate-env.mts`
- `tests/environment-validation.test.ts`

### Validation

- Unit tests pass for both local mode and hosted production mode.
- Production validation succeeds with an Auth0 plus SMTP contract.
- Production validation fails clearly when required hosted variables are absent.

## Phase 2: Generalize the auth layer from Entra-only hosting to local plus Auth0

### Goal

Retain Auth.js and the current role/session model while replacing the Entra
provider with Auth0.

### Tasks

1. Change the auth mode model from `local | entra` to `local | auth0`.
2. Replace Entra-specific config functions in `lib/auth/config.ts` with Auth0
   config functions, for example:
   - `getAuth0Config()`
   - provider label text for Auth0
3. Replace the custom Entra OAuth provider in `lib/auth.ts` with the Auth0
   provider from `next-auth/providers/auth0`, unless a custom OAuth config is
   required for a repo-specific reason discovered during implementation.
4. Keep the local credentials provider intact for local development and CI.
5. Keep the role synchronization path that upserts a user record and loads role
   assignments from Prisma. Only the hosted profile extraction should change.
6. Rename any Entra-specific types, helper names, and error messages so the auth
   layer reads cleanly after the migration.
7. Update the sign-in route and sign-in form so hosted auth copy references
   Auth0 instead of Entra.
8. Preserve the current redirect and landing-path behavior after hosted sign-in.
9. Review callback URL behavior for preview deploys. If Auth0 preview callback
   support is awkward, document that full hosted sign-in is guaranteed only on a
   stable production or staging URL, while Vercel preview deploys remain useful
   for UI review.

### Files to touch

- `lib/auth/config.ts`
- `lib/auth.ts`
- `app/api/auth/[...nextauth]/route.ts`
- `app/(public)/sign-in/page.tsx`
- `components/public/sign-in-form.tsx`
- `tests/auth-config.test.ts`
- auth-related unit or integration tests that assert Entra-specific behavior

### Validation

- Local credentials auth still works for local development.
- Hosted auth configuration resolves correctly in unit tests.
- Role synchronization still works after hosted sign-in.
- No UI copy references Microsoft Entra External ID after the cutover.

## Phase 3: Retarget hosted email to Resend using SMTP

### Goal

Use Resend with the existing SMTP transport so invitation and transactional
email work in production without introducing a new transport abstraction.

### Tasks

1. Keep `PAGEQUEST_EMAIL_DELIVERY_MODE='smtp'` as the hosted email path.
2. Remove Azure Communication Services from the production contract.
3. Keep the local Mailpit flow unchanged for local development.
4. Document the production SMTP variables required for Resend, such as:
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_SECURE`
   - `SMTP_USER`
   - `SMTP_PASSWORD`
   - `EMAIL_FROM`
5. Verify that the existing SMTP implementation in `lib/email/service.ts` does
   not make local-only assumptions.
6. Add or update tests that exercise SMTP config resolution in hosted mode.
7. Decide whether to keep the Azure email mode in code as a dormant legacy mode
   or remove it entirely. Prefer removal if the repo is fully committing to the
   new platform.

### Files to touch

- `lib/email/config.ts`
- `lib/email/service.ts`
- `lib/env.ts`
- invitation or email tests that assert delivery mode behavior
- deployment documentation and env templates

### Validation

- Local SMTP tests continue to pass.
- Production env validation succeeds with Resend SMTP settings.
- No production code path points at the Azure Communication Services stub.

## Phase 4: Make Neon the production database contract

### Goal

Use Neon cleanly for runtime traffic and schema migrations.

### Tasks

1. Keep `lib/prisma.ts` on the existing `pg` plus `PrismaPg` adapter path unless
   Neon-specific behavior proves incompatible during validation.
2. Decide and document the URL split:
   - `DATABASE_URL` uses the Neon pooled runtime URL
   - `DIRECT_URL` uses the Neon direct or unpooled URL for migrations
3. Add a production migration script for hosted deployment, such as a script
   that runs `prisma migrate deploy` against `DIRECT_URL`.
4. Ensure Prisma generation remains part of the build or install flow where
   needed.
5. Update deployment docs so operators know which Neon connection string goes in
   which variable.
6. Review whether `prisma.config.ts` should remain `DATABASE_URL`-only or
   whether migration docs and scripts should explicitly override the datasource
   URL using `DIRECT_URL`.
7. If needed, add a smoke test or helper script that verifies database
   connectivity with the hosted env contract.

### Files to touch

- `lib/prisma.ts`
- `prisma.config.ts`
- `package.json`
- `scripts/db-migrate`
- new production migration script, if added
- deployment documentation

### Validation

- Local database behavior remains unchanged.
- Production migration commands are explicit and documented.
- Hosted runtime can connect using Neon-backed env values.

## Phase 5: Retarget deployment from App Service assumptions to Vercel

### Goal

Make the repo deploy naturally on Vercel without hidden Azure assumptions.

### Tasks

1. Decide whether to add a `vercel.json` file or rely entirely on Vercel project
   settings. Prefer `vercel.json` only if the repo benefits from checked-in
   build configuration.
2. Move production environment validation into the Vercel deployment path.
   Acceptable patterns include:
   - a dedicated Vercel build command that runs env validation before build
   - a checked-in build wrapper used only for hosted deployments
3. Ensure the build does not depend on Azure-specific startup behavior.
4. Document required Vercel project settings:
   - GitHub repository connection
   - production branch set to `main`
   - preview deployments enabled for pull requests
   - production and preview environment variables
5. Do not add GitHub Actions deployment steps unless a missing Vercel feature
   forces it. The default target model is direct Vercel plus GitHub integration.
6. Review any runtime assumptions about long-lived servers, background jobs, or
   local disk state. Document them if Vercel serverless behavior could affect
   future features.

### Files to touch

- `package.json`
- `scripts/build`
- optional `vercel.json`
- deployment docs

### Validation

- The repo has a documented Vercel build path.
- The production deployment contract is checked before or during Vercel build.
- GitHub Actions remains CI-only.

## Phase 6: Integrate GitHub and Vercel cleanly

### Goal

Use GitHub for repository hosting and code review while letting Vercel own the
deploy lifecycle.

### Tasks

1. Document the intended GitHub-to-Vercel flow:
   - pushes and pull requests run `.github/workflows/ci.yml`
   - pull requests also receive Vercel preview deployments
   - merges to `main` trigger Vercel production deployment
2. Add a deployment checklist that includes connecting the repo via the Vercel
   GitHub app or import flow.
3. Document how preview deploys relate to hosted auth, especially if Auth0
   callback URLs are restricted to stable domains.
4. Document which secrets live in Vercel versus GitHub:
   - Vercel stores runtime env vars for the app
   - GitHub stores only CI-related secrets if needed later
5. If the team wants deployment status visibility in GitHub pull requests,
   confirm that Vercel status checks are enabled through the GitHub integration.

### Files to touch

- `README.md`
- `docs/vercel-deployment.md`
- optional contributor workflow docs

### Validation

- The docs describe a single, coherent GitHub plus Vercel workflow.
- There is no duplicate deployment automation in GitHub Actions.

## Phase 7: Update tests, fixtures, and developer documentation

### Goal

Finish the retarget by removing Azure-specific expectations from tests and docs
while preserving local development ergonomics.

### Tasks

1. Update unit tests that mention Entra or Azure Communication Services.
2. Keep Playwright and CI on local auth unless there is a strong reason to make
   browser tests depend on Auth0.
3. Update any docs that currently describe Azure as the production target.
4. Add a deployment environment matrix to the docs that distinguishes:
   - local development
   - CI
   - Vercel preview
   - Vercel production
5. Add a concise operator checklist for first deployment:
   - create Neon project and database
   - create Auth0 tenant and application
   - verify Resend sender domain
   - connect GitHub repo to Vercel
   - set Vercel env vars
   - run migrations
   - verify sign-in and invitation email flow

### Files to touch

- `README.md`
- `docs/local-environment.md`
- `docs/azure-deployment.md`
- `docs/vercel-deployment.md`
- auth and environment tests

### Validation

- No user-facing or deployment-facing docs claim Azure is the required target.
- Local developer workflow remains simple.
- CI remains self-contained and does not require hosted providers.

## 6. Suggested execution order for the coding agent

Execute the migration in this order:

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5
6. Phase 7

Phase 6 should be documented alongside Phases 5 and 7, since it mostly affects
deployment docs and contributor workflow notes rather than runtime code.

## 7. Concrete file-level worklist

Use this as a direct implementation checklist.

1. Update `lib/env.ts` to define the new production contract.
2. Update `tests/environment-validation.test.ts` to reflect Auth0 and SMTP.
3. Update `lib/auth/config.ts` to replace Entra config with Auth0 config.
4. Update `lib/auth.ts` to replace the Entra provider with Auth0 while keeping
   local credentials mode.
5. Update `app/(public)/sign-in/page.tsx` and
   `components/public/sign-in-form.tsx` to remove Entra-specific UI text.
6. Update `tests/auth-config.test.ts` for Auth0 labels and config parsing.
7. Decide whether to simplify `lib/email/config.ts` and `lib/email/service.ts`
   by removing Azure email mode.
8. Add a hosted migration path for Neon-backed production deployment.
9. Add Vercel deployment documentation and move production env validation into
   the Vercel build path.
10. Update `README.md` and deployment docs to describe the GitHub plus Vercel
    workflow.

## 8. Risks and mitigation

### Risk: preview deployments do not authenticate cleanly with Auth0

Mitigation:

- Keep Vercel preview deploys for UI review and non-authenticated checks.
- Use a stable staging alias if end-to-end hosted sign-in must be tested before
  production.

### Risk: Vercel build succeeds without validating the hosted env contract

Mitigation:

- Make environment validation part of the Vercel build path.
- Do not rely on `scripts/start` for production validation on Vercel.

### Risk: migrations run against the wrong Neon URL

Mitigation:

- Document `DATABASE_URL` versus `DIRECT_URL` clearly.
- Add an explicit production migration command.

### Risk: over-migrating auth by trying to support Auth0 and Clerk at once

Mitigation:

- Implement Auth0 first.
- Treat Clerk as a separate follow-up track, not part of the first cutover.

## 9. Clerk alternate track

Only use this if Auth0 is rejected after Phase 0.

Clerk is not the preferred first migration path because it would likely require
more substantial changes to the current Auth.js-based architecture.

If Clerk is chosen instead of Auth0:

1. Re-scope Phase 2 before editing code.
2. Decide whether Auth.js remains in the repo or whether Clerk replaces it.
3. Expect broader changes in:
   - route handlers
   - session access helpers
   - middleware or guards
   - sign-in UI
   - test setup
4. Do not mix Clerk and Auth0 support in the same first-pass migration unless a
   strong product requirement demands both.

## 10. Definition of done

The retarget is complete when all of the following are true:

1. Local development still uses local credentials auth and local SMTP.
2. Production validation targets Auth0, Neon, Resend, and Vercel.
3. The hosted auth flow no longer references Entra.
4. The hosted email flow no longer depends on Azure assumptions.
5. The deployment story is GitHub for source and CI, Vercel for deploys.
6. The docs explain how to configure Vercel, Neon, Auth0, and Resend.
7. The repo can be deployed to Vercel with explicit environment variables and a
   documented migration step.
