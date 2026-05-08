# Developer Scripts

These scripts are the command-line entrypoints for routine local development tasks.

## Setup and startup

- `./scripts/bootstrap`: install dependencies, create local env files if missing, and start Docker services.
- `./scripts/local-startup`: start local services, run Prisma migrations, and run the seed command.
- `./scripts/dev`: start the Next.js development server.
- `./scripts/build`: build the app for production.
- `./scripts/start`: start the production server.

## Database and services

- `./scripts/db-migrate`: run `prisma migrate dev`.
- `./scripts/db-seed`: run the Prisma seed command.
- `./scripts/services-up`: start Docker Compose services.
- `./scripts/services-down`: stop Docker Compose services.
- `./scripts/services-logs`: stream Docker Compose logs.
- `./scripts/services-status`: show Docker Compose service status.

## Quality checks

- `./scripts/lint`: run ESLint.
- `./scripts/format`: apply Prettier formatting.
- `./scripts/format-check`: check formatting without writing changes.
- `./scripts/test`: run Vitest once.
- `./scripts/test-watch`: run Vitest in watch mode.
- `./scripts/test-e2e`: run Playwright tests.
- `./scripts/check`: run format check, lint, and unit tests in sequence.
