# Azure Deployment

Azure is no longer the active production deployment target for Page Quest.

The current retarget defines a single hosted deployment model built on Vercel,
Neon, Resend, and Auth0.

## Current Guidance

- Do not add new Azure-specific deployment automation.
- Do not treat GitHub Actions as the deployment system for the application.
- Keep GitHub Actions focused on CI.
- Use Vercel for preview and production deployments.

For the active deployment contract, see
[deployment-model.md](./deployment-model.md) and
[vercel-deployment.md](./vercel-deployment.md).

This document exists to make the repository intent explicit while older Azure
assumptions are removed in later phases of the retarget.
