# Azure Deployment

This guide is written for someone who has never deployed an app to Azure before. It explains where to click in the Azure portal, what values to type into the fields, what those values mean, and how those values map back to Page Quest.

The goal is:

1. Create the Azure resources manually in the Azure portal.
2. Let Azure create the GitHub Actions deployment workflow for you.
3. Keep the normal repository CI workflow separate from deployment.

## What You Will End Up With

When you finish this guide, you should have:

1. One GitHub Actions CI workflow already stored in this repository at `.github/workflows/ci.yml`.
2. One Azure-generated GitHub Actions deployment workflow in `.github/workflows/`.
3. One Azure App Service hosting the Next.js app.
4. One Azure Database for PostgreSQL Flexible Server holding the production database.
5. One Azure Communication Services setup for email.
6. One Microsoft Entra External ID app registration for sign-in.
7. All required runtime settings stored in App Service.
8. All required build and deployment secrets stored in GitHub.

## Important Notes Before You Start

### This guide assumes two workflows, not one

Azure Deployment Center will create its own deployment workflow file. That is expected.

You should keep:

- `.github/workflows/ci.yml` for code quality checks on push and pull request
- Azure's generated workflow for deployment from `main`

Do not try to combine them in the Azure portal.

### Azure screens can change slightly

Azure changes labels and menu positions over time. If a menu item is not exactly where this guide says it is, use the global search box at the top of the Azure portal page and type the resource name or menu name directly.

### Recommended beginner approach

If this is your first Azure deployment, create a non-production environment first, even if you eventually want production.

Use names like these while learning:

- Resource group: `pagequest-staging-rg`
- App Service app name: `pagequest-staging`
- PostgreSQL server: `pagequest-staging-db`

After you are comfortable with the flow, you can repeat it with production names.

## 0. Decide Your Names and Values Before Opening Azure

It is much easier if you choose your values once and reuse them everywhere.

Use this worksheet.

### Azure values to choose

| Item                       | Example value                      | What it is used for                                                   |
| -------------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| Azure subscription         | your existing subscription         | Billing and permissions                                               |
| Azure region               | `East US`                          | Region for App Service and nearby resources                           |
| Resource group             | `pagequest-staging-rg`             | Container for all Azure resources                                     |
| App Service app name       | `pagequest-staging`                | Public app host becomes `https://pagequest-staging.azurewebsites.net` |
| PostgreSQL server name     | `pagequest-staging-db`             | Database server resource name                                         |
| PostgreSQL database name   | `pagequest`                        | Actual database inside the PostgreSQL server                          |
| PostgreSQL admin username  | `pagequestadmin`                   | Admin login for server creation                                       |
| Email sender display value | `Page Quest <noreply@YOUR-DOMAIN>` | Value for `EMAIL_FROM`                                                |

### GitHub branch choice

Use:

- CI on every push and pull request
- deployment only from `main`

### Runtime environment values this app requires

Page Quest currently requires these hosted environment variables to start in production mode:

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
- `ENTRA_EXTERNAL_ID_SCOPE`
- `AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING`

The current code does not require Blob Storage, Key Vault, Application Insights, or Log Analytics for the first successful deployment. You can add those later.

## 1. Sign In to the Azure Portal

1. Open a browser.
2. Go to `https://portal.azure.com`.
3. Sign in with the Microsoft account that has access to your Azure subscription.
4. Wait for the Azure portal home screen to load.

What you should see:

- a left-side navigation area
- a search box across the top of the page
- a main dashboard area in the center

If you do not see the left-side menu, use the top search box for every resource in this guide.

## 2. Create a Resource Group

The resource group is the top-level container that will hold your App Service, database, and email resources.

### Where to navigate

1. In the Azure portal top search box, type `Resource groups`.
2. Click the search result named `Resource groups`.
3. On the Resource groups page, click the `Create` button near the top.

### What to type

On the `Create a resource group` page, fill in:

- Subscription: choose your Azure subscription
- Resource group: type a name such as `pagequest-staging-rg`
- Region: choose the region you want to use, for example `East US`

### What to click next

1. Click `Review + create`.
2. Wait for Azure to validate the form.
3. Click `Create`.

### What to expect

Azure will show a deployment progress screen. When it finishes:

1. Click `Go to resource group`.
2. Keep this browser tab open if possible. You will reuse this resource group in the next steps.

## 3. Create Azure Database for PostgreSQL Flexible Server

Page Quest uses PostgreSQL through Prisma. This database is required.

### Where to navigate

1. In the Azure portal top search box, type `Azure Database for PostgreSQL flexible servers`.
2. Click the matching service result.
3. On the PostgreSQL Flexible Servers page, click `Create`.

### Fill in the Basics tab

You will see a multi-tab creation form. Start on `Basics`.

Use these values:

- Subscription: choose the same subscription as your resource group
- Resource group: choose the resource group you created earlier, for example `pagequest-staging-rg`
- Server name: type a unique Azure server name such as `pagequest-staging-db`
- Region: choose the same region as your resource group when possible
- PostgreSQL version: choose `16`
- Workload type or compute tier: choose the smallest non-free option that fits your budget for a first deployment
- Admin username: type a username such as `pagequestadmin`
- Password: create a strong password
- Confirm password: type the same password again

Write down the admin username and password somewhere safe. You will need them later to build connection strings.

### Networking choices for a beginner setup

If Azure offers multiple access modes, choose the easiest first-time option:

- Public access
- Allow Azure services and resources to access this server

If you see a field for firewall rules:

- Add your current public IP if Azure offers an `Add current client IP address` button

This is the simplest beginner-friendly setup. You can harden networking later.

### Storage and availability choices

If Azure shows tabs like `Compute + storage`, `Networking`, `Security`, or `High availability`, keep the defaults unless you have a strong reason to change them.

For a first deployment:

- keep backups enabled
- keep high availability off unless you specifically want the extra cost

### Finish creation

1. Click `Review + create`.
2. Wait for validation to complete.
3. Click `Create`.

### Create the actual database inside the server

After Azure finishes creating the PostgreSQL server:

1. Click `Go to resource`.
2. In the server page left menu, look for `Databases`.
3. Click `Databases`.
4. Click `Add` or `Create`.
5. Enter database name: `pagequest`
6. Save or create the database.

### Record the values you need

On the PostgreSQL server resource page, note these values:

- Server name or host name
- Admin username
- Database name `pagequest`

The host usually looks like this:

```text
pagequest-staging-db.postgres.database.azure.com
```

### Build the connection strings

You now need to build two environment variable values.

Replace the placeholders below with your real values:

```text
DATABASE_URL=postgresql://pagequestadmin:YOUR_PASSWORD@pagequest-staging-db.postgres.database.azure.com:5432/pagequest?schema=public&sslmode=require
DIRECT_URL=postgresql://pagequestadmin:YOUR_PASSWORD@pagequest-staging-db.postgres.database.azure.com:5432/pagequest?schema=public&sslmode=require
```

Important:

- Use your real admin username in place of `pagequestadmin`
- Use your real password in place of `YOUR_PASSWORD`
- Keep `:5432`
- Keep `?schema=public&sslmode=require`
- If your password contains special characters such as `@`, `:`, `/`, `?`, or `#`, URL-encode the password before inserting it into the connection string

For the current app, `DATABASE_URL` and `DIRECT_URL` can use the same Azure PostgreSQL value.

## 4. Create Azure Communication Services for Email

Page Quest currently expects hosted email mode to be `azure-communication-services`.

### Part A: Create the Communication Services resource

1. In the Azure portal top search box, type `Communication Services`.
2. Click `Communication Services`.
3. Click `Create`.

On the create screen, enter:

- Subscription: your Azure subscription
- Resource group: your existing resource group, for example `pagequest-staging-rg`
- Resource name: a name such as `pagequest-staging-acs`
- Data location or region: choose a location appropriate for your deployment

Then:

1. Click `Review + create`.
2. Click `Create`.

### Part B: Create the Email Communication Service resource

Azure may show this as a separate service.

1. In the Azure portal top search box, type `Email Communication Services`.
2. Click the matching result.
3. Click `Create`.

Enter:

- Subscription: your Azure subscription
- Resource group: your existing resource group
- Resource name: something like `pagequest-staging-email`
- Data location or region: choose the same or nearby region as your app

Then click:

1. `Review + create`
2. `Create`

### Part C: Link email service to communication service

Azure's exact layout can vary. Usually the next step is inside either the Communication Services resource or the Email Communication Service resource.

Look for menu items such as:

- `Email`
- `Connected resources`
- `Domains`
- `Provision domains`

If Azure prompts you to connect the email service to the communication service, choose the two resources you just created and save the relationship.

### Part D: Set up a sender domain

You need a sender domain for the `EMAIL_FROM` value.

You may see two broad options:

1. Azure-managed domain
2. Custom domain that you verify through DNS

For a first deployment, use the easiest option available to you.

If you use an Azure-managed domain:

- follow Azure's prompts to provision the managed domain
- wait until the domain status becomes ready or verified

If you use a custom domain:

1. Choose `Custom domain`
2. Azure will show DNS records you must add at your DNS provider
3. Add those DNS records exactly as shown
4. Return to Azure and wait for domain verification

### Part E: Choose the sender address

Once the domain exists, create or identify a sender address.

Example:

```text
Page Quest <noreply@your-verified-domain.example>
```

This full string becomes your `EMAIL_FROM` environment variable.

### Part F: Copy the connection string

1. Open the `Communication Services` resource you created.
2. In the left menu, click `Keys` or `Access keys`.
3. Copy one of the connection strings.

This full value becomes:

```text
AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING
```

## 5. Configure Microsoft Entra External ID

Page Quest requires hosted auth mode to be `entra`, so this part is mandatory.

### What you are creating here

You need:

1. An Entra External ID tenant or configuration
2. An app registration for Page Quest
3. A client secret for that app
4. The issuer URL

### Open the right admin experience

You can start from either:

- `https://entra.microsoft.com`
- or Azure portal search for `Microsoft Entra ID`

If you are already in the Azure portal:

1. Use the top search box and type `Microsoft Entra ID`.
2. Click the result.

### Create or choose the External ID environment

Depending on your Azure account, you may already have an Entra tenant. If not, Azure may guide you through creating one.

Look for menu items like:

- `External Identities`
- `Microsoft Entra External ID`
- `Tenants`
- `Overview`

If you need to create a tenant, follow Azure's tenant creation wizard and wait until it is ready.

### Register the application

1. In Microsoft Entra, go to `App registrations`.
2. Click `New registration`.

Fill in:

- Name: `Page Quest`
- Supported account types: use the default choice Azure recommends for your External ID scenario unless you have a specific identity design already
- Redirect URI:
    - Platform: `Web`
    - URI: leave blank for the moment if you do not yet know your App Service hostname, or fill it in if you already do

If you do not yet know the App Service hostname, you can come back later and edit the redirect URI.

Click `Register`.

### Copy the application client ID

After registration, the app overview page will show values like:

- Application (client) ID
- Directory (tenant) ID

Copy the `Application (client) ID`.

This becomes:

```text
ENTRA_EXTERNAL_ID_CLIENT_ID
```

### Create the client secret

1. In the app registration left menu, click `Certificates & secrets`.
2. In the `Client secrets` section, click `New client secret`.
3. Description: type something like `Page Quest App Service deploy`.
4. Expiration: choose the option you prefer.
5. Click `Add`.

Important:

- Copy the secret `Value` immediately
- Do not copy the Secret ID unless you intentionally want that for something else

The copied secret value becomes:

```text
ENTRA_EXTERNAL_ID_CLIENT_SECRET
```

### Add the redirect URI

The app uses this provider callback path:

```text
/api/auth/callback/microsoft-entra-external-id
```

So if your App Service hostname is:

```text
https://pagequest-staging.azurewebsites.net
```

then your full redirect URI must be:

```text
https://pagequest-staging.azurewebsites.net/api/auth/callback/microsoft-entra-external-id
```

To add it:

1. In the app registration left menu, click `Authentication`.
2. If `Web` is not already listed, click `Add a platform`.
3. Choose `Web`.
4. In the Redirect URIs field, paste the full callback URI.
5. Click `Configure` or `Save`.

### Find the issuer URL

This is the part most people get wrong.

The app needs the issuer base URL, not the `/.well-known/openid-configuration` document URL.

Look for the issuer in your External ID tenant or user flow configuration. Azure's exact UI can vary. Common places to inspect are:

- External ID user flow overview
- OpenID Connect metadata page
- Endpoints page
- Token issuer field

If Azure shows a metadata URL ending in `/.well-known/openid-configuration`, remove that trailing portion and keep only the issuer base URL.

For this app:

- `ENTRA_EXTERNAL_ID_ISSUER` must start with `https://`
- do not paste the full metadata document URL into `ENTRA_EXTERNAL_ID_ISSUER`

### Scope value

Use this exact value unless you have a special reason to change it:

```text
openid profile email offline_access
```

This becomes:

```text
ENTRA_EXTERNAL_ID_SCOPE
```

## 6. Create the App Service Plan and Web App

This is the actual web host for your Next.js app.

### Where to navigate

1. In the Azure portal top search box, type `App Services`.
2. Click `App Services`.
3. Click `Create`.
4. Choose `Web App` if Azure asks you to pick a type.

### Fill in the Basics tab

Enter these values:

- Subscription: your Azure subscription
- Resource group: your existing resource group, for example `pagequest-staging-rg`
- Name: type a unique app name such as `pagequest-staging`
- Publish: `Code`
- Runtime stack: `Node 22 LTS`
- Operating system: `Linux`
- Region: choose the same region or a nearby region to your PostgreSQL resource

When you type the App Service name, Azure will reserve the public hostname:

```text
https://pagequest-staging.azurewebsites.net
```

Write that URL down. It will be used for:

- `APP_URL`
- `NEXTAUTH_URL`
- the Entra redirect URI

### Create or choose an App Service plan

On the same create screen, Azure will ask for an App Service plan.

If a plan section is visible:

1. Click `Create new`.
2. Enter a plan name such as `pagequest-staging-plan`.
3. Choose a pricing tier appropriate for your budget.

For a first deployment, a smaller Linux plan is usually fine unless you already know you need more capacity.

### Review and create

1. Click `Review + create`.
2. Wait for Azure validation.
3. Click `Create`.

### After the app is created

1. Click `Go to resource`.
2. On the App Service overview page, find the `Default domain` or hostname.
3. Confirm it matches the app name you chose.

Example:

```text
https://pagequest-staging.azurewebsites.net
```

## 7. Add App Service Application Settings

This is where you put the runtime environment variables that the app reads when it starts.

### Where to navigate

1. Open your App Service resource.
2. In the left menu, scroll to the `Settings` section.
3. Click `Environment variables` if Azure shows that label.
4. If your Azure screen instead uses the older label, click `Configuration`.
5. Make sure you are on the `Application settings` tab, not the `Connection strings` tab.

Important:

- Put these values in `Application settings`
- do not put them into Azure's `Connection strings` section for this app

### How to add each setting

For each variable below:

1. Click `Add`.
2. In the Name field, type the variable name exactly.
3. In the Value field, paste the value exactly.
4. Click `Apply` or `OK`.

After you finish all variables:

1. Click `Save` at the top.
2. Confirm the save if Azure asks.
3. Wait for App Service to restart.

### Exact settings to add

Use your real values in place of the examples.

| Name                                             | What to paste in Value                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `APP_URL`                                        | `https://pagequest-staging.azurewebsites.net`                                                     |
| `NEXTAUTH_URL`                                   | `https://pagequest-staging.azurewebsites.net`                                                     |
| `NEXTAUTH_SECRET`                                | a long random string with at least 32 characters, for example a password-manager-generated secret |
| `DATABASE_URL`                                   | your full Azure PostgreSQL connection string                                                      |
| `DIRECT_URL`                                     | your full Azure PostgreSQL connection string                                                      |
| `PAGEQUEST_AUTH_MODE`                            | `entra`                                                                                           |
| `PAGEQUEST_EMAIL_DELIVERY_MODE`                  | `azure-communication-services`                                                                    |
| `EMAIL_FROM`                                     | `Page Quest <noreply@your-verified-domain.example>`                                               |
| `ENTRA_EXTERNAL_ID_CLIENT_ID`                    | the Entra application client ID                                                                   |
| `ENTRA_EXTERNAL_ID_CLIENT_SECRET`                | the Entra client secret value                                                                     |
| `ENTRA_EXTERNAL_ID_ISSUER`                       | the issuer base URL from Entra External ID                                                        |
| `ENTRA_EXTERNAL_ID_SCOPE`                        | `openid profile email offline_access`                                                             |
| `AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING` | the Azure Communication Services connection string                                                |

### Example values block

This is an example only. Replace everything with your real values.

```text
APP_URL=https://pagequest-staging.azurewebsites.net
NEXTAUTH_URL=https://pagequest-staging.azurewebsites.net
NEXTAUTH_SECRET=replace-this-with-a-real-random-secret-at-least-32-characters-long
DATABASE_URL=postgresql://pagequestadmin:YOUR_PASSWORD@pagequest-staging-db.postgres.database.azure.com:5432/pagequest?schema=public&sslmode=require
DIRECT_URL=postgresql://pagequestadmin:YOUR_PASSWORD@pagequest-staging-db.postgres.database.azure.com:5432/pagequest?schema=public&sslmode=require
PAGEQUEST_AUTH_MODE=entra
PAGEQUEST_EMAIL_DELIVERY_MODE=azure-communication-services
EMAIL_FROM=Page Quest <noreply@your-verified-domain.example>
ENTRA_EXTERNAL_ID_CLIENT_ID=YOUR-CLIENT-ID
ENTRA_EXTERNAL_ID_CLIENT_SECRET=YOUR-CLIENT-SECRET-VALUE
ENTRA_EXTERNAL_ID_ISSUER=https://YOUR-ISSUER-BASE-URL
ENTRA_EXTERNAL_ID_SCOPE=openid profile email offline_access
AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING=endpoint=https://...;accesskey=...
```

### Values that must match exactly

- `APP_URL` and `NEXTAUTH_URL` must be identical
- both must use `https`
- neither may point to `localhost` or `127.0.0.1`
- `NEXTAUTH_SECRET` must not be the placeholder from `.env.example`

## 8. Add the Same Secrets to GitHub

The Azure App Service uses the settings at runtime, but the Azure-generated GitHub workflow will also need many of the same values during build and deployment.

### Where to navigate in GitHub

1. Open your GitHub repository in the browser.
2. Click the `Settings` tab.
3. In the left sidebar, click `Secrets and variables`.
4. Click `Actions`.

You are now on the page where GitHub Actions secrets are created.

### How to add a secret

For each secret:

1. Click `New repository secret`.
2. In `Name`, enter the secret name exactly.
3. In `Secret`, paste the value.
4. Click `Add secret`.

### Secrets to add

Add these repository secrets:

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

Use the exact same values you stored in App Service.

### Azure-generated publish profile secret

When Azure Deployment Center creates the deployment workflow, it will usually also create or ask you to create a publish profile secret for the App Service.

Do not rename or delete that generated publish profile secret.

## 9. Let Azure Generate the Deployment GitHub Actions Workflow

This is the step where Azure creates the deployment workflow file automatically.

### Where to navigate

1. Open your App Service resource in Azure.
2. In the left menu, find `Deployment`.
3. Click `Deployment Center`.

### Fill in Deployment Center

Azure's layout may vary a bit, but you will usually choose:

- Source: `GitHub`
- Organization: your GitHub organization or username
- Repository: your Page Quest repository
- Branch: `main`
- Authentication or deployment method: `GitHub Actions`

If Azure asks you to authorize GitHub:

1. Click the authorize button.
2. Sign in to GitHub.
3. Grant the requested access.
4. Return to Azure after authorization completes.

### Finish the Deployment Center setup

1. Click `Save` or `Finish`.
2. Wait for Azure to complete the setup.

### What Azure should create

After this step, Azure should create:

1. a deployment workflow file in `.github/workflows/`
2. a publish profile secret used by `azure/webapps-deploy`, or instructions for you to add it

Do not delete `.github/workflows/ci.yml`. That workflow is still needed.

## 10. Update the Azure-Generated Workflow for This Repository

Azure's default Node workflow is not specific to this repository. You must edit it so it matches how Page Quest actually builds.

### Open the generated workflow

After Azure creates it:

1. Open your GitHub repository.
2. Click `Code`.
3. Open `.github/workflows/`.
4. Open the new Azure-generated deployment workflow file.

### Changes you must make

#### Use pnpm instead of npm

Find the install and build steps and change them so the workflow uses:

- Node `22`
- pnpm `11.0.8`
- `pnpm install --frozen-lockfile`
- `pnpm build`

#### Generate the Prisma client

Add this immediately after dependency installation:

```yaml
- name: Generate Prisma client
  run: pnpm exec prisma generate
```

This step is required on clean runners such as GitHub Actions.

#### Add production environment validation

Add this after Prisma generation and before the build step:

```yaml
- name: Validate production environment contract
  run: pnpm env:validate -- --target production
```

#### Add the deployment environment variables

In the job that builds the app, add an `env:` block like this:

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

#### Add Prisma migrations

Before the deploy action runs, add:

```yaml
- name: Apply Prisma migrations
  run: pnpm exec prisma migrate deploy
```

Do not add `pnpm db:seed` to production deployment.

## 11. Run the First Deployment

After the Azure-generated workflow is updated:

1. Commit and push the workflow changes to GitHub.
2. Open the GitHub repository `Actions` tab.
3. Confirm the CI workflow passes.
4. Confirm the Azure deployment workflow starts on `main`.

### What to watch in the deployment workflow

Open the workflow run and check these stages:

1. Dependency installation succeeds
2. Prisma client generation succeeds
3. Production environment validation succeeds
4. `pnpm build` succeeds
5. `pnpm exec prisma migrate deploy` succeeds
6. App Service deployment succeeds

### Open the deployed site

After deployment finishes:

1. Return to the Azure App Service overview page
2. Click the site URL shown there, or manually open your App Service hostname in the browser
3. Confirm the site loads over HTTPS

## 12. Verify the Hosted App After Deployment

Check these items in order.

### Basic startup

1. Open the home page
2. Open the sign-in page
3. Confirm neither page crashes

### Authentication

1. Click the sign-in flow
2. Confirm Azure redirects you to the Entra sign-in experience
3. Sign in with a valid user
4. Confirm Azure redirects back to the Page Quest site

### Database connectivity

After sign-in:

1. Open the areas of the app that load campaign or participant data
2. Confirm data loads rather than showing server errors

### Email

Trigger a workflow in the app that sends email if one is available in your test scenario.

Confirm:

1. The app does not throw an immediate email configuration error
2. The email sender address matches your verified Azure Communication Services sender

## 13. Common Problems and What They Usually Mean

### The Azure deployment workflow fails during install

Likely causes:

- Azure's generated workflow still uses `npm`
- pnpm setup was not added

### The workflow fails with missing Prisma client errors

Likely cause:

- `pnpm exec prisma generate` was not added after install

### The workflow fails environment validation

Likely causes:

- one or more GitHub secrets were not created
- `APP_URL` and `NEXTAUTH_URL` do not match
- `NEXTAUTH_SECRET` is too short
- `PAGEQUEST_AUTH_MODE` is not `entra`
- `PAGEQUEST_EMAIL_DELIVERY_MODE` is not `azure-communication-services`

### The app deploys but sign-in fails

Likely causes:

- the Entra redirect URI is wrong
- `ENTRA_EXTERNAL_ID_ISSUER` is wrong
- the client secret is missing or expired

### The app deploys but database access fails

Likely causes:

- `DATABASE_URL` or `DIRECT_URL` is malformed
- the PostgreSQL firewall does not allow the connection path you chose
- `sslmode=require` is missing from the connection string

### The app deploys but email fails

Likely causes:

- `AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING` is wrong
- `EMAIL_FROM` is not using a verified sender address

## 14. Rollback and Recovery for a Beginner

If the first deployment goes wrong:

1. Do not immediately keep pushing random fixes.
2. Open the failing GitHub Actions run and read the first failing step carefully.
3. If the problem is a bad code change, redeploy the last known-good commit.
4. If the problem is a bad environment variable, correct the App Service setting and the matching GitHub secret.
5. If the problem is a bad migration, stop and inspect the database before redeploying.

Keep backups enabled on Azure Database for PostgreSQL Flexible Server.

## 15. Good Next Steps After the First Successful Deployment

Once the site is working, the next Azure improvements worth doing are:

1. Add Application Insights and Log Analytics for monitoring.
2. Add Key Vault plus managed identity for secret management.
3. Add App Service health checks and alerts.
4. Add deployment slots for safer releases.
5. Add Blob Storage later if the application begins storing uploaded assets.
