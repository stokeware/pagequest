# Developer Scripts

These scripts are the command-line entrypoints for routine local development tasks.

## Setup and startup

- `./scripts/bootstrap`: install dependencies, create local env files if missing, and start Docker services.
- `./scripts/validate-env --target local|production`: validate the current environment contract before local work or a hosted build/start.
- `./scripts/local-startup`: start local services, run Prisma migrations, and run the seed command.
- `./scripts/dev`: start the Next.js development server.
- `./scripts/build`: validate the hosted production contract, then build the app for Vercel or another production-style target.
- `pnpm build:vercel`: explicit alias for the Vercel build command; runs the same hosted build wrapper as `pnpm build`.
- `./scripts/start`: start the production server.

## Database and services

- `./scripts/db-migrate`: run `prisma migrate dev`.
- `./scripts/db-migrate-deploy`: run `prisma migrate deploy` against `DIRECT_URL` for hosted environments.
- `./scripts/db-seed`: run the Prisma seed command.
- `./scripts/run-job`: run a background job locally, with optional `--now` and `--payload` overrides for validation.
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
- `./scripts/check`: validate the local environment, then run format check, lint, and unit tests in sequence.
