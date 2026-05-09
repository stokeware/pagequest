# Local Environment

Use [.env.example](../.env.example) as the single source of truth for local environment variables.

## Files

- Copy [.env.example](../.env.example) to `.env.local` for the Next.js app.
- Copy [.env.example](../.env.example) to `.env` when running CLI tools such as Prisma or Docker Compose.
- Local scripts now load both files, with `.env.local` overriding `.env` when the same variable appears in both places.

## Required Variables

- `APP_URL`: Canonical local application URL.
- `POSTGRES_DB`: Local PostgreSQL database name for Compose.
- `POSTGRES_USER`: Local PostgreSQL username for Compose.
- `POSTGRES_PASSWORD`: Local PostgreSQL password for Compose.
- `POSTGRES_PORT`: Host port mapped to the PostgreSQL container. Defaults to `5433` in this repo because `5432` may already be occupied locally.
- `DATABASE_URL`: Primary Prisma connection string.
- `DIRECT_URL`: Direct Prisma connection string for migrations and administrative operations.
- `NEXTAUTH_URL`: Base URL used by Auth.js in local development.
- `NEXTAUTH_SECRET`: Session and token signing secret for Auth.js.
- `PAGEQUEST_AUTH_MODE`: Auth provider selection. Use `local` for routine development and `auth0` only when validating hosted configuration.
- `LOCAL_AUTH_PASSPHRASE`: Shared password used by the local Auth.js credentials provider.
- `PAGEQUEST_EMAIL_DELIVERY_MODE`: Email adapter selection. Use `smtp`. Hosted delivery also uses `smtp` through Resend.
- `AUTH0_CLIENT_ID`: Auth0 application client ID for the hosted sign-in flow.
- `AUTH0_CLIENT_SECRET`: Auth0 application client secret for the hosted sign-in flow.
- `AUTH0_ISSUER`: HTTPS issuer URL for the Auth0 tenant.
- `MAILPIT_SMTP_PORT`: Host port mapped to Mailpit SMTP.
- `MAILPIT_UI_PORT`: Host port mapped to the Mailpit web UI.
- `SMTP_HOST`: SMTP host the app should use for local email delivery.
- `SMTP_PORT`: SMTP port the app should use for local email delivery.
- `SMTP_USER`: SMTP username. Leave empty for Mailpit.
- `SMTP_PASSWORD`: SMTP password. Leave empty for Mailpit.
- `SMTP_SECURE`: SMTP TLS mode. Use `false` for local Mailpit.
- `EMAIL_FROM`: Default sender address for local emails.

## Local Defaults

- PostgreSQL listens on `127.0.0.1:5433` from the host and on `5432` inside Docker.
- Mailpit SMTP listens on `127.0.0.1:1025`.
- Mailpit UI is available at `http://127.0.0.1:8025`.
- The app is expected to run at `http://127.0.0.1:3000`.
- Local email delivery defaults to `smtp`, which routes invitation emails into Mailpit.
- Local Auth.js mode expects one of the seeded emails and the shared passphrase from `LOCAL_AUTH_PASSPHRASE`.
- Hosted configuration testing switches `PAGEQUEST_AUTH_MODE` to `auth0` and uses the Auth0 values above.

## Validation

- Run `pnpm env:validate -- --target local` before routine development if you want an explicit environment check.
- `./scripts/bootstrap`, `./scripts/dev`, and `./scripts/check` now run the local validation automatically.
- `./scripts/start` runs production validation automatically before the hosted server starts.

## Production Expectations

- Set both `APP_URL` and `NEXTAUTH_URL` to the same public HTTPS origin.
- Replace `NEXTAUTH_SECRET` with a deployment secret that is not the local example placeholder and is at least 32 characters long.
- Use `PAGEQUEST_AUTH_MODE=auth0` for hosted environments.
- Use `PAGEQUEST_EMAIL_DELIVERY_MODE=smtp` for hosted environments.
- Use Resend SMTP values for `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `EMAIL_FROM`.
- Do not point `APP_URL` or `NEXTAUTH_URL` at loopback hosts such as `127.0.0.1` or `localhost` in production.
