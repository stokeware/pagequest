# Local Workflow

This document is the local developer workflow for Page Quest.

For environment variable details, see [local-environment.md](./local-environment.md).

## Prerequisites

- Node.js 22 LTS
- pnpm 11
- Docker with Compose
- `uv` with Python 3.12 available
- Playwright browser dependencies for end-to-end tests

## First-time setup

From the repository root:

```bash
./scripts/bootstrap
```

This does the following:

- installs Node dependencies with pnpm
- creates `.env` from [.env.example](../.env.example) if it does not exist
- creates `.env.local` from [.env.example](../.env.example) if it does not exist
- starts the local Docker services

After bootstrap finishes, run the local startup workflow:

```bash
./scripts/local-startup
```

This starts Docker services, runs Prisma migrations, and executes the seed command.

## Daily startup

Use this flow for normal development:

```bash
./scripts/local-startup
./scripts/dev
```

The local app is expected to run at `http://127.0.0.1:3000`.

## Local services

The default local service endpoints are:

- app: `http://127.0.0.1:3000`
- PostgreSQL host port: `127.0.0.1:5433`
- Mailpit SMTP: `127.0.0.1:1025`
- Mailpit UI: `http://127.0.0.1:8025`

Useful service commands:

```bash
./scripts/services-up
./scripts/services-status
./scripts/services-logs
./scripts/services-down
```

## Database workflow

Use the Prisma wrappers in `scripts/` instead of calling Prisma directly.

```bash
./scripts/db-migrate
./scripts/db-seed
```

Current Phase 0 note: the seed command is a placeholder until the Phase 1 domain model and real seed data are added.

## Testing and checks

Unit tests:

```bash
./scripts/test
./scripts/test-watch
```

End-to-end tests:

```bash
./scripts/test-e2e
```

Linting and formatting:

```bash
./scripts/lint
./scripts/format
./scripts/format-check
```

Combined local check:

```bash
./scripts/check
```

If `./scripts/check` fails on formatting alone, run `./scripts/format` and rerun the check.

## Production-style commands

```bash
./scripts/build
./scripts/start
```

## Recommended local loop

For a clean local development cycle:

1. Start services and database setup with `./scripts/local-startup`.
2. Run the app with `./scripts/dev`.
3. Make code changes.
4. Run `./scripts/test` for fast feedback.
5. Run `./scripts/lint` before finishing a change.
6. Run `./scripts/check` before handing work off or opening a PR.

## Script index

- `./scripts/bootstrap`: initial setup helper
- `./scripts/local-startup`: local services plus Prisma startup flow
- `./scripts/dev`: Next.js development server
- `./scripts/build`: production build
- `./scripts/start`: production server
- `./scripts/services-up`: start Docker services
- `./scripts/services-status`: inspect Docker services
- `./scripts/services-logs`: stream Docker logs
- `./scripts/services-down`: stop Docker services
- `./scripts/db-migrate`: Prisma migration workflow
- `./scripts/db-seed`: Prisma seed workflow
- `./scripts/test`: one-shot Vitest run
- `./scripts/test-watch`: watch-mode Vitest run
- `./scripts/test-e2e`: Playwright test run
- `./scripts/lint`: ESLint
- `./scripts/format`: Prettier write mode
- `./scripts/format-check`: Prettier check mode
- `./scripts/check`: format check, lint, and unit tests
