# Azure Deployment

This guide walks through a manual Azure portal setup for Page Quest while still letting Azure generate the GitHub Actions workflow that performs build and deployment.

## What this document assumes

- You want GitHub Actions for CI and Azure App Service deployment.
- You want to create Azure resources manually in the Azure portal.
- You want Azure Deployment Center to generate the deployment workflow file for you.
- You are fine with two workflows in the repository:
    - `.github/workflows/ci.yml` for push and pull request validation
    - one Azure-generated workflow for branch deployment

Azure cannot safely merge its deployment steps into the repo-managed CI workflow automatically. Let Azure create its own deployment workflow file after the portal setup.

## Before you start

Have these ready before you open the Azure portal:

- Azure subscription access with permission to create resources and configure Microsoft Entra External ID.
- GitHub repository admin or maintainer access.
- A dedicated deployment branch strategy. The simplest option is:
    - use all pushes and pull requests for `.github/workflows/ci.yml`
    - deploy only from `main`
- A region choice for all hosted resources. Keep App Service, PostgreSQL, and Communication Services in the same or nearby regions.

## Current hosted requirements from the codebase

The current application requires these hosted settings to start successfully in production mode:

- `APP_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `DATABASE_URL`
- `DIRECT_URL`
- `PAGEQUEST_AUTH_MODE=entra`
- `PAGEQUEST_EMAIL_DELIVERY_MODE=azure-communication-services`
- `EMAIL_FROM`
- `ENTRA_EXTERNAL_ID_CLIENT_ID`
- `ENTRA_EXTERNAL_ID_CLIENT_SECRET`
- `ENTRA_EXTERNAL_ID_ISSUER`
- `ENTRA_EXTERNAL_ID_SCOPE` (optional but recommended)
- `AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING`

The current code does not yet require Azure Blob Storage, Key Vault, Application Insights, or Log Analytics to start. Those services are good next steps, but they are not mandatory for the first successful deployment.

## 1. Create a resource group

In the Azure portal:

1. Open `Resource groups`.
2. Select `Create`.
3. Choose your subscription.
4. Enter a resource group name such as `pagequest-prod-rg` or `pagequest-staging-rg`.
5. Choose the region you want to anchor the deployment around.
6. Create the resource group.

## 2. Create Azure Database for PostgreSQL Flexible Server

This app uses Prisma with PostgreSQL.

In the Azure portal:

1. Open `Azure Database for PostgreSQL flexible servers`.
2. Select `Create`.
3. Use the same subscription and resource group.
4. Pick a server name.
5. Choose the same region as App Service if possible.
6. Use PostgreSQL 16 unless you have a reason to pin lower.
7. Create an admin username and password.
8. Choose a compute/storage tier that fits your environment.
9. For the first deployment, the simplest path is public access with firewall rules.
10. Enable access from Azure services.
11. Add your current client IP so you can inspect the database manually if needed.
12. Create the server.

After the server exists:

1. Open the server.
2. Create a database named `pagequest` if the wizard did not already create one.
3. Record the server host name.
4. Build both connection strings with SSL enabled.

Example shape:

```text
DATABASE_URL=postgresql://USERNAME:PASSWORD@SERVER.postgres.database.azure.com:5432/pagequest?schema=public&sslmode=require
DIRECT_URL=postgresql://USERNAME:PASSWORD@SERVER.postgres.database.azure.com:5432/pagequest?schema=public&sslmode=require
```

If the password contains special characters, URL-encode it before placing it in the connection string.

## 3. Create Azure Communication Services Email

The current production email mode is `azure-communication-services`.

In the Azure portal:

1. Create an `Azure Communication Services` resource.
2. Create an `Email Communication Service` resource if Azure presents it separately in your portal flow.
3. Link the email service and the communication service if Azure asks for connected resources.
4. Configure a managed domain or a custom verified domain for outbound mail.
5. Create or confirm a sender address for `EMAIL_FROM`.
6. Open the Communication Services resource and copy the connection string.

Your hosted sender address should use the verified domain you configured here.

## 4. Configure Microsoft Entra External ID

The app requires hosted auth mode to be `entra`.

You need:

- a Microsoft Entra External ID tenant or configuration you will use for the app
- an application registration for Page Quest
- a client secret
- the issuer URL for the tenant or user flow

The provider ID in this app is `microsoft-entra-external-id`, so the callback URL in Azure must be:

```text
https://YOUR_APP_HOST/api/auth/callback/microsoft-entra-external-id
```

For the first deployment, `YOUR_APP_HOST` is usually your default App Service hostname, for example:

```text
https://pagequest-prod.azurewebsites.net/api/auth/callback/microsoft-entra-external-id
```

General portal flow:

1. Open the Entra admin center.
2. Create or choose the External ID tenant or user flow you want to use.
3. Register a new application for Page Quest.
4. Add a web redirect URI using the callback URL above.
5. Create a client secret.
6. Copy the application client ID.
7. Copy the client secret value.
8. Copy the issuer base URL that corresponds to the tenant or user flow.

Important:

- `ENTRA_EXTERNAL_ID_ISSUER` should be the issuer base URL, not the `/.well-known/openid-configuration` URL.
- The app constructs the well-known URL automatically.
- The issuer must use `https`.

Recommended scope value:

```text
openid profile email offline_access
```

## 5. Create the App Service plan and Web App

In the Azure portal:

1. Open `App Services`.
2. Select `Create` and choose `Web App`.
3. Use the same subscription and resource group.
4. Enter an app name. This becomes the default hostname at `https://APPNAME.azurewebsites.net`.
5. Publish: `Code`.
6. Runtime stack: `Node 22 LTS`.
7. Operating system: `Linux`.
8. Region: keep it aligned with the database and communication resources.
9. Create or select an App Service plan.
10. Review and create the web app.

After the app exists:

1. Open the App Service.
2. In `Overview`, note the default hostname.
3. In `Configuration`, plan to add the required application settings from the next section.
4. Leave the startup command blank unless you intentionally change the deployment packaging model later.

## 6. Add App Service application settings

Use `Configuration` -> `Application settings` in the App Service. Do not use the `Connection strings` section for these values because the app reads standard environment variables.

Set these values:

| Setting                                          | Value                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `APP_URL`                                        | `https://YOUR_APP_HOST`                                                             |
| `NEXTAUTH_URL`                                   | `https://YOUR_APP_HOST`                                                             |
| `NEXTAUTH_SECRET`                                | a random secret with at least 32 characters                                         |
| `DATABASE_URL`                                   | Azure PostgreSQL Prisma URL with `sslmode=require`                                  |
| `DIRECT_URL`                                     | Azure PostgreSQL admin/migration URL with `sslmode=require`                         |
| `PAGEQUEST_AUTH_MODE`                            | `entra`                                                                             |
| `PAGEQUEST_EMAIL_DELIVERY_MODE`                  | `azure-communication-services`                                                      |
| `EMAIL_FROM`                                     | your verified sender address, for example `Page Quest <noreply@yourdomain.example>` |
| `ENTRA_EXTERNAL_ID_CLIENT_ID`                    | client ID from Entra External ID                                                    |
| `ENTRA_EXTERNAL_ID_CLIENT_SECRET`                | client secret from Entra External ID                                                |
| `ENTRA_EXTERNAL_ID_ISSUER`                       | issuer base URL from Entra External ID                                              |
| `ENTRA_EXTERNAL_ID_SCOPE`                        | `openid profile email offline_access`                                               |
| `AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING` | ACS connection string                                                               |

Save the settings and allow App Service to restart.

## 7. Add the same deployment secrets to GitHub

The App Service needs the settings at runtime, but the Azure-generated GitHub workflow also needs values for build-time validation and database migration steps.

In GitHub, create repository secrets or environment secrets with the same names as these runtime values:

- `APP_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `DATABASE_URL`
- `DIRECT_URL`
- `EMAIL_FROM`
- `ENTRA_EXTERNAL_ID_CLIENT_ID`
- `ENTRA_EXTERNAL_ID_CLIENT_SECRET`
- `ENTRA_EXTERNAL_ID_ISSUER`
- `ENTRA_EXTERNAL_ID_SCOPE`
- `AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING`

Azure will usually add a publish profile secret automatically when it scaffolds the deployment workflow. Keep that generated secret as-is.

## 8. Let Azure generate the deployment GitHub Actions workflow

In the App Service:

1. Open `Deployment Center`.
2. Source: `GitHub`.
3. Authorize Azure to access GitHub if prompted.
4. Choose your organization.
5. Choose this repository.
6. Choose the deployment branch. For most teams, this should be `main`.
7. Deployment method or build provider: choose `GitHub Actions`.
8. Finish the wizard and save.

Azure should now:

- add a deployment workflow under `.github/workflows/`
- add or prompt for the publish profile secret used by `azure/webapps-deploy`

Do not remove `.github/workflows/ci.yml`. That file remains your always-run validation workflow.

## 9. Update the Azure-generated workflow for this repo

Azure's default Node workflow is usually written for `npm`, not `pnpm`, and it will not know about this app's Prisma migration step.

After Azure creates the deployment workflow, open it and make these changes.

### Use the repo's toolchain

- Set Node to version `22`.
- Install pnpm `11.0.8`.
- Replace `npm install` or `npm ci` with `pnpm install --frozen-lockfile`.
- Replace `npm run build` with `pnpm build`.

### Add deployment environment variables

In the build job, inject the same deployment values from GitHub secrets:

```yaml
env:
    APP_URL: ${{ secrets.APP_URL }}
    NEXTAUTH_URL: ${{ secrets.NEXTAUTH_URL }}
    NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET }}
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    DIRECT_URL: ${{ secrets.DIRECT_URL }}
    PAGEQUEST_AUTH_MODE: entra
    PAGEQUEST_EMAIL_DELIVERY_MODE: azure-communication-services
    EMAIL_FROM: ${{ secrets.EMAIL_FROM }}
    ENTRA_EXTERNAL_ID_CLIENT_ID: ${{ secrets.ENTRA_EXTERNAL_ID_CLIENT_ID }}
    ENTRA_EXTERNAL_ID_CLIENT_SECRET: ${{ secrets.ENTRA_EXTERNAL_ID_CLIENT_SECRET }}
    ENTRA_EXTERNAL_ID_ISSUER: ${{ secrets.ENTRA_EXTERNAL_ID_ISSUER }}
    ENTRA_EXTERNAL_ID_SCOPE: ${{ secrets.ENTRA_EXTERNAL_ID_SCOPE }}
    AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING: ${{ secrets.AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING }}
```

### Add an explicit production validation step

Add this before the build step:

```yaml
- name: Validate production environment contract
  run: pnpm env:validate -- --target production
```

### Add the Prisma migration step

Add this after dependencies are installed and before the deploy action runs:

```yaml
- name: Apply Prisma migrations
  run: pnpm exec prisma migrate deploy
```

Do not run `pnpm db:seed` in production.

### Keep build and deploy separate from CI

Recommended behavior:

- `ci.yml` runs on every push and pull request.
- Azure deployment workflow runs only from `main`.
- Protect `main` with the CI status check before allowing merges.

## 10. Run the first deployment

Once the Azure-generated workflow is updated:

1. Push the workflow changes to GitHub.
2. Confirm `.github/workflows/ci.yml` passes.
3. Confirm the Azure deployment workflow starts for the deployment branch.
4. Watch the build step.
5. Watch the Prisma migration step.
6. Watch the App Service deploy step.
7. Open `https://YOUR_APP_HOST` after deployment completes.

## 11. Verify the hosted app

Check these items after the first deployment:

1. The site loads over HTTPS.
2. The sign-in page renders without startup errors.
3. Microsoft Entra External ID sign-in redirects correctly and returns to the app.
4. The application can read and write data in PostgreSQL.
5. Invitation or notification emails send through Azure Communication Services.
6. The App Service starts cleanly after a restart.

## 12. Common failure points

If deployment fails, these are the most likely causes in this repo:

- The Azure-generated workflow still uses `npm` instead of `pnpm`.
- GitHub secrets were not added for build-time validation.
- `APP_URL` and `NEXTAUTH_URL` do not match exactly.
- `NEXTAUTH_SECRET` is too short or still uses the placeholder value.
- `PAGEQUEST_AUTH_MODE` was left as `local`.
- `PAGEQUEST_EMAIL_DELIVERY_MODE` was left as `smtp`.
- `DATABASE_URL` or `DIRECT_URL` is missing `sslmode=require` for Azure PostgreSQL.
- `ENTRA_EXTERNAL_ID_ISSUER` was set to the well-known metadata URL instead of the issuer base URL.
- `EMAIL_FROM` does not belong to a verified Azure Communication Services sender domain.

## 13. Rollback and recovery

For an initial rollback strategy:

1. Keep deployments restricted to `main`.
2. Re-run deployment from the last known-good commit if a release fails.
3. If a migration caused the problem, inspect the database before attempting a second deployment.
4. Use App Service deployment history to confirm which package was last applied.
5. Keep database backups enabled on PostgreSQL Flexible Server.

## 14. Recommended follow-up work

After the first deployment is stable, the next Azure improvements worth adding are:

1. Application Insights and Log Analytics for runtime visibility.
2. Key Vault plus managed identity for secret retrieval.
3. Health checks and alerting on the App Service.
4. Deployment slots for safer production swaps.
5. Blob Storage if the application later adds hosted file or asset storage.
