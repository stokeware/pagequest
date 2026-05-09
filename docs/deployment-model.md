# Deployment Model

This document describes the intended deployment approach for Page Quest.

## Hosted Deployment

Page Quest has one hosted deployment path for this retarget:

- Vercel hosts the Next.js application.
- Neon hosts PostgreSQL.
- Resend delivers transactional email over SMTP.
- Auth0 provides hosted authentication.

GitHub remains the repository host and CI runner.

- Pushes and pull requests run `.github/workflows/ci.yml`.
- Pull requests also receive Vercel preview deployments.
- Merges to `main` trigger the Vercel production deployment.

GitHub Actions does not deploy the application in this model. Runtime
environment variables belong in Vercel, while GitHub should hold only CI-facing
secrets if the workflow later needs any.

Hosted Auth0 sign-in is guaranteed only on stable callback domains configured in
Auth0. Vercel preview deployments still matter for UI review and other
non-authenticated validation, but they may need a dedicated staging domain if
the tenant does not allow wildcard or dynamic callback URLs.

See the deployment references for operator details:

- [vercel-deployment.md](./vercel-deployment.md)
- [local-workflow.md](./local-workflow.md)

## Production Platform

Page Quest now targets a hosted production stack built around:

- Vercel for the Next.js application
- Neon for PostgreSQL
- Resend for transactional email over SMTP
- Auth0 for hosted authentication

This is the single intended hosted deployment path for the current retarget.
The repository should not evolve toward parallel hosted deployment systems or
parallel hosted auth providers during this migration.

## System Ownership

Deployment responsibilities are split deliberately.

- GitHub is the repository host and source of truth.
- GitHub Actions owns continuous integration.
- Vercel owns application deployments.
- Neon owns the hosted PostgreSQL service.
- Resend owns transactional email delivery.
- Auth0 owns hosted sign-in.

The existing CI workflow in `.github/workflows/ci.yml` stays focused on
verification. It installs dependencies, validates the local environment
contract, checks formatting, runs lint and unit tests, and builds the app. It
does not deploy the application.

## Deployment Flow

The intended GitHub-to-Vercel flow is:

1. Developers push branches to GitHub and open pull requests.
2. GitHub Actions runs CI for pushes and pull requests.
3. Vercel, connected directly to the GitHub repository, creates preview
   deployments for pull requests.
4. After a pull request is merged to `main`, Vercel performs the production
   deployment.

This keeps CI and deployment separate while still giving pull requests both
code-quality checks and deploy previews.

## Environment Roles

Page Quest now has four meaningful deployment environments.

### Local Development

- Uses local credentials auth.
- Uses local SMTP, typically through Mailpit.
- Uses the local PostgreSQL container and Prisma workflows.
- Does not depend on Auth0, Resend, Neon, or Vercel.

### CI

- Runs in GitHub Actions.
- Uses local credentials auth.
- Uses SMTP configuration suitable for the isolated test environment.
- Validates code quality and buildability, but does not deploy.

### Vercel Preview

- Triggered from GitHub pull requests.
- Intended for UI review and integration validation.
- Should use the hosted deployment model where practical.
- May need stable-domain handling for full Auth0 callback support, depending on
  how the hosted auth phase is finalized.

### Vercel Production

- Triggered from merges to `main`.
- Uses the hosted production stack: Vercel, Neon, Resend, and Auth0.
- Is the only production deployment target.

## Authentication Approach

Auth0 is the primary hosted authentication path for the retarget.

- Hosted sign-in should target Auth0.
- Local development should continue to use the local credentials mode.
- CI should continue to use the local credentials mode.
- Seeded demo data should continue to assume local credentials mode.

This preserves a low-friction developer workflow and keeps automated tests from
depending on an external identity provider.

## Database And Email Approach

The hosted platform choices are intentionally conservative.

- Neon is the hosted PostgreSQL provider.
- Runtime traffic should use the standard runtime database URL.
- Administrative and migration operations should use the direct database URL.
- Resend is the hosted email provider.
- Resend is expected to integrate through SMTP for the first cut of the hosted
  deployment model.

This keeps the production contract aligned with the current codebase direction:
minimal rewrites, explicit hosted services, and local workflows that remain
self-contained.

## Branch Strategy

- `main` is the production deployment branch.
- Pull request branches are expected to receive preview deployments.
- Vercel deployment status should appear alongside GitHub CI status in pull
  requests.

The repository should not add a second deployment path through GitHub Actions
unless a concrete platform limitation forces it.

## Operational Constraints

- GitHub stores source code and CI configuration.
- Vercel stores runtime environment variables for deployed environments.
- Vercel builds should use `pnpm build:vercel`, which validates the hosted env
  contract before running `next build`.
- GitHub Actions should not become the application deployment mechanism.
- Azure should not receive new deployment automation during this retarget.
- Deployed runtime behavior should remain stateless; background jobs should run
  through one-off function invocations or external schedulers, not a resident
  worker inside the web process.

Older Azure assumptions may still exist in later implementation phases, but the
deployment model itself is no longer Azure-first.

## Related Documents

- [vercel-deployment.md](./vercel-deployment.md) records Vercel-specific hosting
  notes.
- [azure-deployment.md](./azure-deployment.md) records the retirement of Azure
  as the active target.
- [local-workflow.md](./local-workflow.md) documents the local developer loop.
- [local-environment.md](./local-environment.md) documents local environment
  expectations.
