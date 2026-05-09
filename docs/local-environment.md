# Local Environment

Use [.env.example](../.env.example) as the single source of truth for local environment variables.

## Files

- Copy [.env.example](../.env.example) to `.env.local` for the Next.js app.
- Copy [.env.example](../.env.example) to `.env` when running CLI tools such as Prisma or Docker Compose.

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
- `PAGEQUEST_AUTH_MODE`: Auth provider selection. Use `local` for routine development and `entra` when testing the hosted identity flow.
- `LOCAL_AUTH_PASSPHRASE`: Shared password used by the local Auth.js credentials provider.
- `ENTRA_EXTERNAL_ID_CLIENT_ID`: App registration client ID for Microsoft Entra External ID.
- `ENTRA_EXTERNAL_ID_CLIENT_SECRET`: Client secret for Microsoft Entra External ID.
- `ENTRA_EXTERNAL_ID_ISSUER`: Issuer URL for the Microsoft Entra External ID OpenID Connect tenant or user flow.
- `ENTRA_EXTERNAL_ID_SCOPE`: Optional override for requested OpenID Connect scopes.
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
- Local Auth.js mode expects one of the seeded emails and the shared passphrase from `LOCAL_AUTH_PASSPHRASE`.
- Hosted identity testing switches `PAGEQUEST_AUTH_MODE` to `entra` and uses the Entra OpenID Connect values above.
