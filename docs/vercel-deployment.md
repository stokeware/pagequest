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

## Summary

Page Quest now has one deployment story:

- GitHub hosts the code and runs CI.
- Vercel owns deployments.
- Neon, Resend, and Auth0 provide the hosted production services.
