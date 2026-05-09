# Vercel Deployment

This document defines the production hosting contract for Page Quest.

For the broader repository deployment model, see
[deployment-model.md](./deployment-model.md).

## Production Platform

The intended hosted production stack is:

- Vercel for the Next.js application
- Neon for PostgreSQL
- Resend for transactional email over SMTP
- Auth0 for hosted authentication

This is the only planned hosted deployment path for the current retarget.

## Deployment Ownership

GitHub remains the repository host and source of truth.

- GitHub Actions runs CI on pushes and pull requests through
  `.github/workflows/ci.yml`.
- Vercel connects directly to the GitHub repository.
- Pull requests receive Vercel preview deployments.
- Merges to `main` trigger Vercel production deployments.

GitHub Actions does not own application deployment in this target model.

## Vercel Project Settings

The repo does not check in a `vercel.json` file for this retarget.

- The default Next.js framework detection is sufficient.
- The Vercel project should point at the repository root.
- The production branch should be `main`.
- Preview deployments should stay enabled for pull requests.
- The build command should be `pnpm build:vercel`.
- The install command can stay on Vercel's pnpm default unless the project
  settings need a stricter pinned install command later.

Environment variables should be stored in Vercel, not in GitHub Actions.

- Production must define the full hosted contract for Auth0, Neon, Resend SMTP,
  and NextAuth.
- Preview should define the same shape of variables, using preview-safe values
  and callback URLs where available.

## Hosted Auth Choice

Auth0 is the primary hosted authentication path for this retarget.

- The hosted sign-in flow should target Auth0.
- Local development should continue to use the local credentials auth mode.
- CI should continue to use the local credentials auth mode.
- Seeded demo data should continue to assume local credentials auth.

This keeps hosted identity concerns out of routine local development and test
execution.

## Branch And Environment Expectations

- `main` is the production deployment branch in Vercel.
- Pull request branches are expected to receive Vercel preview deployments.
- GitHub pull requests should show both CI status and Vercel deployment status.

Preview environments are intended for UI review and integration validation.
Full hosted Auth0 sign-in is only guaranteed on a stable production or staging
URL that has been registered as an allowed callback in Auth0. Vercel preview
deployments remain useful for UI review, non-authenticated integration checks,
and validating pages that do not require the hosted callback flow.

## Production Email Variables

Production email delivery uses Resend through SMTP.

- `PAGEQUEST_EMAIL_DELIVERY_MODE=smtp`
- `SMTP_HOST=smtp.resend.com`
- `SMTP_PORT=465`
- `SMTP_SECURE=true`
- `SMTP_USER=resend`
- `SMTP_PASSWORD=<resend-smtp-password>`
- `EMAIL_FROM=<verified-sender-address>`

Local development should keep using Mailpit with the same SMTP variables pointed
at the local Mailpit host and ports.

## Neon Database Variables

Production database access uses two Neon connection strings.

- `DATABASE_URL=<neon-pooled-runtime-url>`
- `DIRECT_URL=<neon-direct-or-unpooled-url>`

Use `DATABASE_URL` for the running application on Vercel. This is the pooled
runtime URL consumed by [lib/prisma.ts](../lib/prisma.ts).

Use `DIRECT_URL` only for Prisma migrations and other administrative commands.
The Prisma CLI config stays pointed at `DATABASE_URL`, and the hosted migration
script overrides that datasource with `DIRECT_URL` so runtime traffic and schema
changes stay on separate Neon URLs.

## Build And Migration Commands

Vercel should build the app through `pnpm build:vercel`, which resolves to the
same `./scripts/build` wrapper used by `pnpm build`. That wrapper:

- validates the hosted production environment contract
- runs `prisma generate`
- runs `next build`

Apply schema changes separately with:

```bash
pnpm db:migrate:deploy
```

That command runs `./scripts/db-migrate-deploy`, requires `DIRECT_URL`, and
executes `prisma migrate deploy` against the direct Neon connection string.

## Runtime Assumptions On Vercel

The deployed app should remain stateless across requests.

- Do not assume writable local disk beyond short-lived request-scoped temp
  files.
- Do not assume a long-lived in-process worker alongside the web app.
- Reminder and other operational jobs should run from an external scheduler or
  one-off function entrypoint, not from a loop inside the Next.js server
  process.

The current repository job runner has a generic serverless function invocation
shape plus local and scheduled execution paths. If future hosted jobs move onto
Vercel, they should target one-off function invocations or an external cron
trigger rather than a resident background worker.

## Summary

Page Quest now has one deployment story:

- GitHub hosts the code and runs CI.
- Vercel owns deployments.
- Neon, Resend, and Auth0 provide the hosted production services.
