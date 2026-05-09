# Vercel Deployment

This guide is written for a first-time operator. It assumes you have never used
Vercel or Neon before and want a production deployment of Page Quest at
`https://pagequest.ing`.

For the broader hosting model, see [deployment-model.md](./deployment-model.md).

## What This Deployment Uses

Page Quest's hosted production stack is:

- Vercel for the Next.js application
- Neon for PostgreSQL
- Resend for SMTP email delivery
- Auth0 for hosted sign-in

GitHub remains the source repository and CI host.

- Pull requests can receive Vercel preview deployments.
- Merges to `main` trigger the production deployment.

## Before You Start

Have these things ready before you begin:

1. A GitHub account with admin access to this repository.
2. A Vercel account.
3. A Neon account.
4. A Resend account.
5. An Auth0 account.
6. A credit card or other payment method ready if Vercel asks for one during
   domain purchase.
7. Access to a terminal in the repository root for the migration step.

You will create and collect these production values during the process:

- `APP_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `DATABASE_URL`
- `DIRECT_URL`
- `PAGEQUEST_AUTH_MODE`
- `PAGEQUEST_EMAIL_DELIVERY_MODE`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_ISSUER`
- `AUTH0_AUDIENCE` optional
- `AUTH0_SCOPE` optional
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `EMAIL_FROM`

The production build fails if required values are missing or mismatched, so the
steps below are intentionally explicit.

## Production Rules This App Enforces

Before you configure anything, know the rules that Page Quest enforces in
production:

- `APP_URL` must be set.
- `NEXTAUTH_URL` must be set.
- `APP_URL` and `NEXTAUTH_URL` must be identical.
- Both URLs must be public `https` URLs, not `localhost` or `127.0.0.1`.
- `PAGEQUEST_AUTH_MODE` must be `auth0`.
- `PAGEQUEST_EMAIL_DELIVERY_MODE` must be `smtp`.
- `NEXTAUTH_SECRET` must be replaced and be at least 32 characters long.
- `DATABASE_URL` and `DIRECT_URL` are both required.
- `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, and `AUTH0_ISSUER` are required.
- `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and
  `SMTP_PASSWORD` are required.

Vercel builds this app with:

```bash
pnpm build:vercel
```

That command runs the repository build wrapper, which validates the production
environment before running `next build`.

## Recommended Order

Follow this order. It minimizes backtracking:

1. Create the Neon database.
2. Verify a sender in Resend and collect SMTP credentials.
3. Create the Auth0 application and configure callback URLs.
4. Import the GitHub repository into Vercel.
5. Add all production environment variables in Vercel.
6. Run Prisma production migrations against Neon.
7. Trigger the first successful production deployment.
8. Buy `pagequest.ing` in Vercel and attach it to the project.
9. Update Auth0 and Resend settings to use the final production domain.
10. Re-deploy and verify the live application.

## Step 1: Create The Neon Production Database

Neon provides two different connection styles that this app uses:

- A pooled connection for the running Vercel app
- A direct connection for Prisma migrations

### 1.1 Sign in to Neon

1. Open `https://console.neon.tech/signup`.
2. Sign up or sign in.
3. If Neon asks you to create an organization, accept the default personal
   organization unless you already have a team organization you want to use.

### 1.2 Create the project

1. In the Neon onboarding flow, create a new project.
2. For the project name, enter `pagequest-production`.
3. Choose a region close to the majority of your users and close to your Vercel
   deployment region if possible.
   Example: `US East (Ohio)`.
4. Leave the default branch as `production`.
5. Finish the onboarding flow.

Neon creates a project, a `production` branch, a default database, and a role.

### 1.3 Rename the database if you want cleaner names

Neon often creates a default database named `neondb`.

You can keep `neondb`, or rename it to `pagequest` if you want clearer naming.
If you keep the default, that is fine. The connection strings are what matter.

### 1.4 Copy the pooled runtime connection string

1. Open your Neon project dashboard.
2. Click the `Connect` button near the top of the project page.
3. In the connection modal:

- Branch: select `production`
- Database: select your production database
- Role: select the default role or your chosen app role

4. Keep connection pooling enabled.
5. Copy the full connection string.

It will look similar to this:

```text
postgresql://alex:super-secret-password@ep-cool-darkness-a1b2c3d4-pooler.us-east-2.aws.neon.tech/pagequest?sslmode=require&channel_binding=require
```

Save that value as:

```text
DATABASE_URL=<pooled-neon-url>
```

### 1.5 Copy the direct migration connection string

1. In the same Neon `Connect` modal, turn off the `Connection pooling` toggle.
2. Copy the new full connection string.

It will look similar to this:

```text
postgresql://alex:super-secret-password@ep-cool-darkness-a1b2c3d4.us-east-2.aws.neon.tech/pagequest?sslmode=require&channel_binding=require
```

Save that value as:

```text
DIRECT_URL=<direct-neon-url>
```

### 1.6 What to keep from Neon

You should now have these two values saved somewhere secure:

- `DATABASE_URL` from the pooled connection
- `DIRECT_URL` from the direct connection

For this application:

- `DATABASE_URL` is for the running site on Vercel.
- `DIRECT_URL` is for `pnpm db:migrate:deploy` and other admin operations.

## Step 2: Set Up Resend For Production Email

Page Quest sends mail through SMTP, not through a provider-specific SDK. In
production, use Resend SMTP.

### 2.1 Sign in to Resend

1. Open `https://resend.com/signup`.
2. Create an account or sign in.
3. Complete any email verification steps Resend requires.

### 2.2 Decide what sender address you want

Pick the sender address you want your app to use.

Good example:

```text
Page Quest <noreply@pagequest.ing>
```

If you prefer a subdomain for mail, this is also fine:

```text
Page Quest <noreply@mail.pagequest.ing>
```

For a first deployment, `noreply@pagequest.ing` is the simplest choice.

### 2.3 Verify the sending domain in Resend

You have two workable options:

- Verify `pagequest.ing` directly
- Verify a mail-only subdomain such as `mail.pagequest.ing`

If you want the least complexity, verify `pagequest.ing` directly.

In Resend:

1. Open the dashboard.
2. Go to `Domains`.
3. Click `Add Domain`.
4. Enter either `pagequest.ing` or `mail.pagequest.ing`.
5. Click the button to continue.
6. Resend will show DNS records to add.

Do not stop here. You may not be able to complete the DNS records until after
the domain exists in Vercel. That is normal.

### 2.4 Get the SMTP credentials

In Resend:

1. Open `SMTP` or `API Keys / SMTP Credentials`, depending on the current UI.
2. Create or reveal the SMTP password.
3. Record the following values:

```text
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASSWORD=<the-password-resend-shows-you>
EMAIL_FROM=Page Quest <noreply@pagequest.ing>
```

If you chose a mail subdomain, make `EMAIL_FROM` match that verified sender.

## Step 3: Create The Auth0 Application

Page Quest requires hosted Auth0 auth in production.

### 3.1 Sign in to Auth0

1. Open `https://manage.auth0.com/`.
2. Create an Auth0 account if you do not already have one.
3. Create or select the tenant you want to use for Page Quest.

Use a tenant name that clearly belongs to production if possible.
Example: `pagequest-prod`.

### 3.2 Create the application

1. In the Auth0 dashboard sidebar, open `Applications`.
2. Select `Applications` again if Auth0 shows a nested menu.
3. Click `Create Application`.
4. Enter the name `Page Quest Production`.
5. Choose `Regular Web Applications`.
6. Click `Create`.

This app is server-rendered and uses server-side auth flows, so `Regular Web
Applications` is the right choice.

### 3.3 Collect the basic Auth0 values

On the Auth0 application page, record:

- `Client ID`
- `Client Secret`
- your tenant domain

For this app, save them as:

```text
AUTH0_CLIENT_ID=<client-id-from-auth0>
AUTH0_CLIENT_SECRET=<client-secret-from-auth0>
AUTH0_ISSUER=https://your-tenant-name.us.auth0.com
```

Your issuer must be a full `https` URL.

Example:

```text
AUTH0_ISSUER=https://pagequest-prod.us.auth0.com
```

### 3.4 Configure callback and logout URLs

In the Auth0 application settings, find the URL fields and populate them.

During the first deployment, you can use the Vercel production URL as a
temporary value. After you attach `pagequest.ing`, come back and replace these
with the final domain.

Use these fields:

- `Allowed Callback URLs`
- `Allowed Logout URLs`
- `Allowed Web Origins`

Temporary first-deploy example using the Vercel domain:

```text
Allowed Callback URLs
https://pagequest.vercel.app/api/auth/callback/auth0

Allowed Logout URLs
https://pagequest.vercel.app

Allowed Web Origins
https://pagequest.vercel.app
```

Final production values after the custom domain is attached:

```text
Allowed Callback URLs
https://pagequest.ing/api/auth/callback/auth0

Allowed Logout URLs
https://pagequest.ing

Allowed Web Origins
https://pagequest.ing
```

If you later add `www.pagequest.ing`, add that explicitly if you intend to use
it. This guide assumes the canonical site is `https://pagequest.ing`.

### 3.5 Optional Auth0 values

This repo can also read these optional values:

- `AUTH0_AUDIENCE`
- `AUTH0_SCOPE`

For a basic web sign-in flow, you can leave `AUTH0_AUDIENCE` unset.

If you do not set `AUTH0_SCOPE`, the app defaults to:

```text
openid profile email offline_access
```

If you prefer to store it explicitly in Vercel, use:

```text
AUTH0_SCOPE=openid profile email offline_access
```

## Step 4: Create The Vercel Project

### 4.1 Sign in to Vercel

1. Open `https://vercel.com/signup` or `https://vercel.com/login`.
2. Sign in.
3. If Vercel asks whether you want a personal account or a team, either is fine.
   For a single-family app, the personal account is usually simpler.

### 4.2 Import the GitHub repository

1. Open `https://vercel.com/new`.
2. If GitHub is not connected yet, click the button to connect GitHub.
3. Authorize the Vercel GitHub app.
4. On the `Import Git Repository` screen, find this repository.
5. Click `Import`.

### 4.3 Confirm the project settings before deploy

On the project creation screen, verify these settings carefully:

- Framework Preset: `Next.js`
- Root Directory: repository root
- Production Branch: `main`

Then open the build settings section if Vercel exposes it and confirm:

- Build Command: `pnpm build:vercel`

If Vercel leaves the install command blank and detects pnpm correctly, that is
fine.

### 4.4 Do not deploy yet if the screen requires environment variables first

If Vercel offers an `Environment Variables` section before the initial deploy,
fill it in now using the next section.

If Vercel allows you to import first and edit settings after, that is also fine.
The key requirement is that the first real production build must have the full
environment.

## Step 5: Add Production Environment Variables In Vercel

Open your Vercel project, then navigate like this:

1. From the Vercel dashboard, open the Page Quest project.
2. In the left sidebar, click `Settings`.
3. Click `Environment Variables`.

Add each variable below.

For each one:

1. Click `Add New` or `Add Variable`.
2. Enter the variable name in the `Name` field.
3. Paste the value into the `Value` field.
4. Select the `Production` environment.
5. Save it.

For your first deployment, you can also add the same values to `Preview` if you
want preview deployments to build successfully, but production is the minimum
required for go-live.

### 5.1 Application URL values

Use the temporary Vercel domain until `pagequest.ing` is attached.

If your project name in Vercel is `pagequest`, the initial value is usually:

```text
APP_URL=https://pagequest.vercel.app
NEXTAUTH_URL=https://pagequest.vercel.app
```

After the custom domain is attached, change both to:

```text
APP_URL=https://pagequest.ing
NEXTAUTH_URL=https://pagequest.ing
```

These two values must match exactly.

### 5.2 Session secret

Generate a long random secret in your terminal:

```bash
openssl rand -base64 48
```

Then save it in Vercel as:

```text
NEXTAUTH_SECRET=<paste-the-generated-secret>
```

Use a value at least 32 characters long.

### 5.3 Database values

Paste the two Neon values you collected earlier:

```text
DATABASE_URL=<pooled-neon-url>
DIRECT_URL=<direct-neon-url>
```

### 5.4 Auth mode and email mode

These values are exact:

```text
PAGEQUEST_AUTH_MODE=auth0
PAGEQUEST_EMAIL_DELIVERY_MODE=smtp
```

### 5.5 Auth0 values

Use the values from Auth0:

```text
AUTH0_CLIENT_ID=<client-id-from-auth0>
AUTH0_CLIENT_SECRET=<client-secret-from-auth0>
AUTH0_ISSUER=https://your-tenant-name.us.auth0.com
```

Optional:

```text
AUTH0_SCOPE=openid profile email offline_access
AUTH0_AUDIENCE=<leave unset unless you specifically configured one>
```

### 5.6 SMTP values

Use the Resend SMTP settings:

```text
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASSWORD=<resend-smtp-password>
EMAIL_FROM=Page Quest <noreply@pagequest.ing>
```

If you verified `mail.pagequest.ing` instead, make the sender match that domain.

### 5.7 Production variable set summary

If you want a single checklist to copy into Vercel, this is the complete
production contract:

```text
APP_URL=https://pagequest.vercel.app
NEXTAUTH_URL=https://pagequest.vercel.app
NEXTAUTH_SECRET=<generate-a-long-random-secret>
DATABASE_URL=<pooled-neon-url>
DIRECT_URL=<direct-neon-url>
PAGEQUEST_AUTH_MODE=auth0
PAGEQUEST_EMAIL_DELIVERY_MODE=smtp
AUTH0_CLIENT_ID=<client-id-from-auth0>
AUTH0_CLIENT_SECRET=<client-secret-from-auth0>
AUTH0_ISSUER=https://your-tenant-name.us.auth0.com
AUTH0_SCOPE=openid profile email offline_access
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASSWORD=<resend-smtp-password>
EMAIL_FROM=Page Quest <noreply@pagequest.ing>
```

After the domain is live, update the first two lines to:

```text
APP_URL=https://pagequest.ing
NEXTAUTH_URL=https://pagequest.ing
```

## Step 6: Run The Production Database Migration

The database must have the current Prisma schema before the live app starts
serving production traffic.

Run this from the repository root on your machine.

### 6.1 Export the Neon direct connection string for the command

In your terminal:

```bash
export DIRECT_URL='postgresql://USER:PASSWORD@HOSTNAME/pagequest?sslmode=require&channel_binding=require'
export DATABASE_URL='postgresql://USER:PASSWORD@HOSTNAME-pooler/pagequest?sslmode=require&channel_binding=require'
pnpm db:migrate:deploy
```

If your database name is `neondb`, use that instead of `pagequest`.

### 6.2 Expected result

The command should finish successfully and apply any pending Prisma migrations.

If it fails because an environment variable is missing, check that both
`DIRECT_URL` and `DATABASE_URL` are exported in the shell running the command.

## Step 7: Trigger The First Production Deployment

### 7.1 Start the deploy

If the project has already been imported, do this in Vercel:

1. Open the project.
2. Click `Deployments`.
3. If no deployment happened yet, trigger one from the import flow or push to
   `main`.
4. If a deployment already failed, open it and click `Redeploy` after fixing the
   environment variables.

### 7.2 What success looks like

The production deployment should:

- install dependencies
- run `pnpm build:vercel`
- pass environment validation
- run `next build`
- publish a production URL ending in `.vercel.app`

### 7.3 If the build fails

Common first-deploy failures are:

- missing `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, or `AUTH0_ISSUER`
- missing `SMTP_USER` or `SMTP_PASSWORD`
- `APP_URL` and `NEXTAUTH_URL` not matching
- `NEXTAUTH_SECRET` still using a placeholder
- a loopback URL such as `http://localhost:3000`

Fix the environment variable in `Settings -> Environment Variables`, then redeploy.

## Step 8: Buy `pagequest.ing` Through Vercel

The exact checkout screens can vary slightly, but the Vercel path is stable:
buy or manage domains from the Vercel dashboard, then attach the domain to the
project from the project's `Domains` settings.

### 8.1 Search for the domain in Vercel

1. Open `https://vercel.com/domains` while signed in.
2. Use the search box to search for `pagequest.ing`.
3. If it is available, choose the purchase option.
4. Complete the checkout flow.

What to enter:

- Domain to buy: `pagequest.ing`
- Registrant contact information: your legal contact details
- Auto-renew: recommended
- WHOIS privacy: enable it if Vercel offers it for this TLD

If `pagequest.ing` is unavailable, stop and choose a different domain before you
continue. The rest of this guide assumes that domain is available and purchased.

### 8.2 Attach the purchased domain to the Page Quest project

Once the purchase is complete:

1. Open the Page Quest project in Vercel.
2. In the sidebar, click `Settings`.
3. Click `Domains`.
4. Click `Add Domain`.
5. In the input, type `pagequest.ing`.
6. Confirm the add action.

Because the domain is owned in Vercel, DNS is usually simpler than bringing in a
domain from another registrar.

### 8.3 Decide whether to add `www.pagequest.ing`

For this app, the cleanest setup is:

- canonical primary domain: `pagequest.ing`
- optional redirect domain: `www.pagequest.ing`

If you want both:

1. While still in `Settings -> Domains`, click `Add Domain` again.
2. Add `www.pagequest.ing`.
3. Mark `pagequest.ing` as the primary domain.
4. Configure `www.pagequest.ing` to redirect to `pagequest.ing` if Vercel offers
   a redirect setting in the domain UI.

If you do not care about `www`, you can skip it entirely.

### 8.4 Wait for verification and SSL

Vercel automatically provisions SSL after the domain is attached and verified.

On the `Domains` page, wait until the domain status is healthy and ready.

## Step 9: Update Vercel, Auth0, And Resend To The Final Domain

Once `pagequest.ing` is attached and healthy, update all systems so the final
public origin is consistent.

### 9.1 Update Vercel environment variables

In Vercel `Settings -> Environment Variables`:

1. Edit `APP_URL`.
2. Change the value to:

```text
https://pagequest.ing
```

3. Edit `NEXTAUTH_URL`.
4. Change the value to:

```text
https://pagequest.ing
```

5. Save both changes.

### 9.2 Update Auth0 callback settings

In Auth0, return to the Page Quest production application and replace the
temporary Vercel domain values.

Use:

```text
Allowed Callback URLs
https://pagequest.ing/api/auth/callback/auth0

Allowed Logout URLs
https://pagequest.ing

Allowed Web Origins
https://pagequest.ing
```

If you decided to support `www.pagequest.ing`, add those explicitly where needed.

### 9.3 Finish Resend domain verification if needed

If Resend was waiting for DNS verification:

1. Go back to Resend `Domains`.
2. Open the domain you added earlier.
3. Complete any remaining DNS records if Resend asks for them.
4. Wait until the domain status shows verified.

Then confirm `EMAIL_FROM` still matches the verified sender domain.

## Step 10: Redeploy And Verify The Live Site

### 10.1 Redeploy after the final URL changes

Any environment variable change in Vercel applies only to new deployments.

After updating `APP_URL` and `NEXTAUTH_URL`:

1. Open the Vercel project.
2. Open `Deployments`.
3. Open the latest production deployment.
4. Click `Redeploy`.

### 10.2 Verify the application manually

Test these items in a browser:

1. Open `https://pagequest.ing`.
2. Confirm the home page loads over HTTPS with no certificate warning.
3. Start the sign-in flow.
4. Confirm Auth0 redirects back to `https://pagequest.ing` after login.
5. Create or resend an invitation from the admin experience.
6. Confirm the email arrives from the expected sender address.
7. Open the invitation link from the email.
8. Confirm invitation acceptance works.
9. Confirm the app reads and writes real production data.

### 10.3 Verify the deployment and domain in Vercel

In Vercel, confirm:

- the latest production deployment is marked ready
- `pagequest.ing` is attached to the production environment
- SSL is active
- the production branch is still `main`

## Preview Deployments

Preview deployments are useful, but hosted auth has one extra detail: Auth0
callback URLs must be allowed explicitly.

If you want full sign-in on preview deployments, you need a stable preview-safe
callback strategy in Auth0. If you do not set that up, preview deployments are
still useful for:

- layout review
- non-authenticated page checks
- visual QA
- smoke tests that do not require the hosted callback flow

## Environment Variable Reference

Use this table when double-checking Vercel settings.

| Variable                        | Required | Production example                    |
| ------------------------------- | -------- | ------------------------------------- |
| `APP_URL`                       | Yes      | `https://pagequest.ing`               |
| `NEXTAUTH_URL`                  | Yes      | `https://pagequest.ing`               |
| `NEXTAUTH_SECRET`               | Yes      | generated random secret               |
| `DATABASE_URL`                  | Yes      | pooled Neon URL                       |
| `DIRECT_URL`                    | Yes      | direct Neon URL                       |
| `PAGEQUEST_AUTH_MODE`           | Yes      | `auth0`                               |
| `PAGEQUEST_EMAIL_DELIVERY_MODE` | Yes      | `smtp`                                |
| `AUTH0_CLIENT_ID`               | Yes      | Auth0 client ID                       |
| `AUTH0_CLIENT_SECRET`           | Yes      | Auth0 client secret                   |
| `AUTH0_ISSUER`                  | Yes      | `https://pagequest-prod.us.auth0.com` |
| `AUTH0_AUDIENCE`                | No       | leave unset unless configured         |
| `AUTH0_SCOPE`                   | No       | `openid profile email offline_access` |
| `SMTP_HOST`                     | Yes      | `smtp.resend.com`                     |
| `SMTP_PORT`                     | Yes      | `465`                                 |
| `SMTP_SECURE`                   | Yes      | `true`                                |
| `SMTP_USER`                     | Yes      | `resend`                              |
| `SMTP_PASSWORD`                 | Yes      | Resend SMTP password                  |
| `EMAIL_FROM`                    | Yes      | `Page Quest <noreply@pagequest.ing>`  |

## First Deployment Checklist

Use this checklist when you are ready to go live:

1. Neon production project exists.
2. `DATABASE_URL` and `DIRECT_URL` are copied from Neon.
3. Resend SMTP password is created.
4. `EMAIL_FROM` uses a verified sending domain.
5. Auth0 application exists as a `Regular Web Application`.
6. Auth0 callback and logout URLs are correct.
7. Vercel project is connected to the repository root.
8. Production branch is `main`.
9. Vercel build command is `pnpm build:vercel`.
10. All required production environment variables are set in Vercel.
11. `pnpm db:migrate:deploy` has been run successfully against Neon.
12. The production deployment succeeds.
13. `pagequest.ing` has been purchased in Vercel.
14. `pagequest.ing` is attached to the project and has SSL.
15. `APP_URL` and `NEXTAUTH_URL` now point to `https://pagequest.ing`.
16. Hosted sign-in, invitation email delivery, and invitation acceptance all
    work on the live site.

## Troubleshooting

### Vercel build says an environment variable is missing

Open `Settings -> Environment Variables` in Vercel and compare every required
variable against the reference table in this document.

### Auth0 login works, but the callback fails

Check all three Auth0 fields:

- `Allowed Callback URLs`
- `Allowed Logout URLs`
- `Allowed Web Origins`

They must match the live domain exactly, including `https`.

### Email sending fails

Check these values in Vercel:

- `SMTP_HOST=smtp.resend.com`
- `SMTP_PORT=465`
- `SMTP_SECURE=true`
- `SMTP_USER=resend`
- `SMTP_PASSWORD` is the current Resend SMTP password
- `EMAIL_FROM` uses a verified sender domain

### The site loads, but database operations fail

Double-check that:

- `DATABASE_URL` is the pooled Neon URL
- the Neon project is active
- Prisma migrations were applied with `pnpm db:migrate:deploy`

## Summary

The shortest correct production story for this repo is:

1. Create Neon, Resend, and Auth0.
2. Import the repo into Vercel.
3. Set the exact production environment values.
4. Run `pnpm db:migrate:deploy` against Neon.
5. Deploy successfully on the Vercel `.vercel.app` domain.
6. Purchase `pagequest.ing` in Vercel.
7. Attach the domain, update URLs in Vercel and Auth0, and redeploy.
8. Verify sign-in, email, and invitation flows on `https://pagequest.ing`.
