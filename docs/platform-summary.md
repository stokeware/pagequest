# Platform Summary

Page Quest has one hosted deployment path for this retarget:

- Vercel hosts the Next.js application.
- Neon hosts PostgreSQL.
- Resend delivers transactional email over SMTP.
- Auth0 provides hosted authentication.
- GitHub remains the repository host and runs CI.

Azure is no longer the active production target.

## Environment Matrix

| Environment       | Auth                                                                                   | Email                         | Data                                      | Deployment owner  |
| ----------------- | -------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------- | ----------------- |
| Local development | `local` credentials                                                                    | Local SMTP via Mailpit        | Local PostgreSQL and Prisma               | Developer machine |
| CI                | `local` credentials                                                                    | SMTP with CI-safe test values | CI database setup                         | GitHub Actions    |
| Vercel preview    | `auth0` when preview callback URLs are supported, otherwise preview-safe UI validation | Resend SMTP preview values    | Neon preview or shared hosted environment | Vercel            |
| Vercel production | `auth0`                                                                                | Resend SMTP production values | Neon production                           | Vercel            |

Playwright and CI remain self-contained and should not require live Auth0 sign-in for routine verification.

## Deployment Flow

1. Push branches and pull requests to GitHub.
2. GitHub Actions runs CI through `.github/workflows/ci.yml`.
3. Vercel creates preview deployments for pull requests.
4. Merges to `main` trigger the Vercel production deployment.

## Documentation

- [docs/local-environment.md](./docs/local-environment.md) covers local env files, defaults, and validation.
- [docs/local-workflow.md](./docs/local-workflow.md) covers the routine local development loop.
- [docs/deployment-model.md](./docs/deployment-model.md) records the repo-wide deployment contract.
- [docs/vercel-deployment.md](./docs/vercel-deployment.md) covers Vercel settings, hosted variables, and the first deployment checklist.
- [docs/azure-deployment.md](./docs/azure-deployment.md) records Azure retirement for this retarget.
