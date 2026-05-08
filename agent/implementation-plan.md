# Page Quest Implementation Plan

Status: Ready for execution by a coding agent
Source: product-spec.md
Updated: 2026-05-07

## 1. Objective

Implement the MVP described in the product specification as a local-first Next.js application that can be developed and tested on a single machine, while keeping Azure production deployment requirements explicit in the architecture and delivery flow.

This plan is written as an execution sequence for a coding agent. Each phase should be completed in order unless a later phase explicitly depends on unfinished infrastructure.

## 2. Delivery principles

- Build the smallest end-to-end vertical slice first, then widen coverage.
- Keep local development fast and repeatable.
- Preserve production alignment with Azure services through adapters and configuration, not separate code paths.
- Prefer testable server-side business logic over embedding rules directly in UI components.
- Ship admin and competitor flows incrementally, but keep the database and authorization model coherent from the start.

## 3. Target architecture

Use the latest stable patch releases available at implementation time within the compatible major lines called out below.

## Application shape

- Single Next.js 16 application using the App Router and React 19.
- TypeScript on the current stable release line across application, database, tests, and tooling.
- Prisma 7 for schema, migrations, and data access.
- Auth.js for authentication integration, implemented with the stable
  `next-auth` package line and matching `@auth/*` adapters where needed.
- Tailwind CSS 4, shadcn/ui, Motion for React, and a small custom design system layer.

## Local environment

- Node.js 22 LTS.
- pnpm 11 as the package manager.
- `uv` as the default Python project, environment, and package manager,
  using Python 3.12 if any Python-based tooling is introduced.
- Docker Compose for PostgreSQL and local developer support services.
- Mailpit for local email capture.
- Optional Azurite or local filesystem-backed asset storage adapter.
- Playwright 1.59 for browser-level testing against the local app.

## Hosted environment

- Azure App Service for the Next.js application.
- Azure Database for PostgreSQL Flexible Server.
- Azure Communication Services Email.
- Azure Blob Storage.
- Microsoft Entra External ID.
- Azure Key Vault, Application Insights, and Log Analytics.

## 4. Execution rules for the coding agent

- Do not scaffold every feature at once. Finish each phase with a working, validated checkpoint.
- Prefer server-side domain functions for scoring, invitation validation, quest status transitions, and authorization checks.
- Keep all external integrations behind application interfaces so local and Azure implementations can share call sites.
- Add tests with each business rule and high-risk flow instead of postponing test coverage.
- Use feature flags only when a production integration cannot be completed in the same phase.

## 5. Phase-by-phase plan

## Phase 0: Repository and toolchain foundation

### Goal

Create the project scaffold and local development baseline.

### Tasks

1. Initialize a Next.js 16 app with App Router, React 19, current-stable
   TypeScript, Tailwind CSS 4, ESLint 10, and pnpm 11.
2. Add shadcn/ui using the current `shadcn` CLI and Tailwind CSS 4-compatible
   component templates, then establish the shared UI primitives folder
   structure.
3. Add core developer tooling: Prettier 3 if desired by the repo, Vitest 4,
   Playwright 1.59, Prisma 7, Zod 4, React Hook Form 7, Auth.js via
   `next-auth` plus matching `@auth/*` packages, and Motion for React 12.
4. Create a `uv` project based on Python 3.12 for any incidental
   Python-based tooling or scripts needed during development, and create the
   matching virtual environment requirement within that `uv` project when this
   step is executed.
5. Add Docker Compose for local PostgreSQL and Mailpit.
6. Create env templates for local development and document required variables.
7. Add scripts for `dev`, `build`, `lint`, `test`, `test:e2e`, `db:migrate`,
   `db:seed`, and `dev:services`.
8. Add a base README section for local startup and test execution.

### Deliverables

- Working app scaffold.
- Reproducible local dependency startup.
- Standard scripts for local development and CI.

### Validation

- Install dependencies successfully.
- Start Docker Compose services successfully.
- Start the Next.js app locally.
- Run lint and the placeholder test suite.

## Phase 1: Core domain model and database

### Goal

Create the MVP data model and migration flow.

### Tasks

1. Define the Prisma schema for User, Role or role assignment, Quest, QuestParticipant, Invitation, Challenge, ChallengeCompletion, ReadingEntry, BookReference if retained, and AuditLog.
2. Model quest statuses, invitation statuses, entry types, and challenge review states as enums.
3. Add indexes for leaderboard and history queries.
4. Create initial Prisma migrations.
5. Add seed data for one admin user, one sample quest, several sample participants, scoring rules, and representative reading entries.
6. Add typed domain helpers for scoring calculations and quest status derivation.

### Deliverables

- Prisma schema and migration history.
- Seed script that supports local demo and test data.
- Shared domain functions for points and quest state.

### Validation

- Apply migrations to the local PostgreSQL container.
- Run the seed script.
- Execute unit tests for scoring and quest status helpers.

## Phase 2: App shell, design system, and route map

### Goal

Establish navigation, layout, and the visual system before feature screens multiply.

### Tasks

1. Build the public site shell with Home, How it works, Sign in, and Accept invitation routes.
2. Build authenticated layout shells for competitor and administrator experiences.
3. Create a whimsical but readable design foundation with theme tokens, typography, spacing, and component states.
4. Add mobile-first navigation patterns for competitor flows and a clear admin navigation rail or header.
5. Create reusable empty states, stat cards, table patterns, form wrappers, and confirmation dialogs.

### Deliverables

- Stable route structure and shared layouts.
- Reusable design components.
- Responsive foundations for future screens.

### Validation

- Verify responsive behavior on phone and desktop breakpoints.
- Run accessibility checks on core layouts.
- Add component tests for shared UI primitives where practical.

## Phase 3: Authentication and authorization

### Goal

Enable secure local and production-ready sign-in paths.

### Tasks

1. Integrate Auth.js with a local development mode and a production-oriented Microsoft Entra External ID configuration.
2. Define role-aware session handling for administrator and competitor experiences.
3. Protect authenticated routes and server actions.
4. Implement invitation acceptance flow prerequisites so only invited users can join a private quest.
5. Add middleware or server-side guards for admin-only pages and mutations.

### Deliverables

- Working local sign-in flow.
- Production-ready auth integration points.
- Authorization utilities usable across routes and server actions.

### Validation

- Test sign-in and sign-out locally.
- Test admin route protection and competitor route access.
- Add unit or integration tests for authorization guards.

## Phase 4: Invitation and participant onboarding

### Goal

Implement the private quest onboarding path.

### Tasks

1. Build admin invitation creation, resend, revoke, and status views.
2. Generate secure invitation tokens with expiration.
3. Build the invitation acceptance screen and account-linking flow.
4. Add local email delivery through Mailpit and keep the email sending interface compatible with Azure Communication Services.
5. Record invitation acceptance and create quest participation records.

### Deliverables

- End-to-end invitation flow.
- Local email testing path.
- Production-compatible email abstraction.

### Validation

- Send invitation emails locally and inspect them in Mailpit.
- Accept a valid invite and reject expired or revoked invites.
- Cover token validation and join flow with tests.

## Phase 5: Quest administration

### Goal

Give the administrator enough control to run a competition.

### Tasks

1. Build quest list, create, edit, publish, archive, and duplicate flows.
2. Add quest configuration for name, description, dates, timezone, status, and visibility.
3. Add scoring rule configuration for pages, audiobook minutes, books, and challenges.
4. Enforce the MVP rule that only one quest can be active at a time.
5. Add automatic or derived quest status transitions based on dates.

### Deliverables

- Admin quest management UI and server actions.
- Validated scoring configuration storage.
- Business logic preventing invalid quest state combinations.

### Validation

- Test quest creation and editing locally.
- Add unit tests for active-quest constraints and status transitions.
- Confirm duplicate quest flow copies expected fields without copying historical entries.

## Phase 6: Challenge management

### Goal

Support quest challenges and optional review workflows.

### Tasks

1. Build challenge catalog CRUD under admin tools.
2. Support challenge fields: title, description, category, point rule, repeatability, and review requirement.
3. Associate challenges with a quest.
4. Build pending challenge review screens for admins.
5. Add challenge completion state handling for approved, rejected, or auto-approved submissions.

### Deliverables

- Admin challenge management.
- Challenge-to-quest associations.
- Review workflow support for future moderation complexity.

### Validation

- Test creating repeatable and one-time challenges.
- Test completion approval flows.
- Add business-rule tests for duplicate completion behavior.

## Phase 7: Competitor progress logging

### Goal

Make logging fast and reliable on mobile and desktop.

### Tasks

1. Build the Log Progress screen with entry types for books, pages, audiobook minutes, and challenge completions.
2. Use React Hook Form and Zod for validation.
3. Enforce quest-date validation and configurable edit or delete windows.
4. Support optional book title and author metadata.
5. Recalculate participant totals and leaderboard data after entry mutations.
6. Record audit events for admin changes and user deletions where relevant.

### Deliverables

- Working entry forms and mutation handlers.
- Validation aligned with quest rules.
- Reliable post-submit refresh behavior.

### Validation

- Test each entry type locally.
- Add unit and integration tests for scoring recalculation.
- Add mobile viewport Playwright coverage for the logging flow.

## Phase 8: Leaderboard, dashboard, and participant history

### Goal

Deliver the primary competitor experience.

### Tasks

1. Build the competitor dashboard with current rank, time remaining, summary stats, and recent activity.
2. Build the leaderboard with both points and raw metrics.
3. Keep the leaderboard summary-focused and link each participant row to a participant detail page.
4. Build participant detail pages showing full reading history for the selected quest.
5. Build My History and Past Quests views.
6. Add efficient queries or database views for standings and history retrieval.

### Deliverables

- Core competitor experience.
- Readable standings and personal progress tracking.
- Historical quest browsing.

### Validation

- Verify standings update immediately after new entries.
- Add tests for ranking order and tie behavior.
- Add Playwright coverage for leaderboard and participant detail navigation.

## Phase 9: Reporting, moderation, and auditability

### Goal

Finish the admin control surface needed for launch.

### Tasks

1. Build reports and summaries for quest-wide participation.
2. Add admin editing for incorrect entries.
3. Persist audit log records for admin modifications, invitation actions, and challenge reviews.
4. Add export capability for quest results in a simple format such as CSV.

### Deliverables

- Admin reports.
- Moderation tools.
- Audit trail coverage for sensitive actions.

### Validation

- Test admin adjustments and audit visibility.
- Validate exports against seeded data.
- Add tests for audit log creation on protected mutations.

## Phase 10: Notifications and scheduled processes

### Goal

Implement reminder and lifecycle automation without overcomplicating MVP.

### Tasks

1. Build email templates for invitations, quest start reminders, and inactivity nudges.
2. Create a job runner abstraction that can execute locally and later via Azure Functions or scheduled triggers.
3. Implement quest lifecycle jobs, reminder selection logic, and idempotency protections.
4. Add operational logging for background jobs.

### Deliverables

- Notification templates and sending logic.
- Schedulable jobs with local execution support.
- Production-ready extension point for Azure Functions.

### Validation

- Run reminder jobs locally against seed data.
- Confirm duplicate sends are prevented.
- Add tests for job selection logic.

## Phase 11: Hardening, accessibility, and release readiness

### Goal

Prepare the application for real use.

### Tasks

1. Perform accessibility review against WCAG 2.2 AA goals.
2. Review empty states, loading states, and mobile tap targets.
3. Add error boundaries and user-friendly mutation failure handling.
4. Tighten security around tokens, rate limits if needed, and audit coverage.
5. Run performance checks on leaderboard and dashboard queries.
6. Finalize environment validation and production configuration handling.

### Deliverables

- Launch-ready MVP.
- Improved usability under failure or low-data conditions.
- Reduced security and performance risk.

### Validation

- Run full lint, test, and Playwright suites.
- Execute a manual release checklist in local and pre-production environments.
- Verify all critical flows using a seeded quest and multiple participants.

## Phase 12: Azure deployment and CI/CD

### Goal

Promote the local-first application into a maintainable hosted system.

### Tasks

1. Add GitHub Actions workflows for install, lint, test, build, and deployment.
2. Provision Azure resources for App Service, PostgreSQL, Blob Storage, Key Vault, Application Insights, Log Analytics, Entra External ID, and email integration.
3. Add environment-specific configuration and secret management.
4. Configure database migration execution in deployment.
5. Configure monitoring, structured logs, and alerts for basic operational issues.
6. Document rollback and recovery expectations.

### Deliverables

- Automated CI pipeline.
- Azure deployment path.
- Observable hosted environment.

### Validation

- Run CI successfully on a clean branch.
- Deploy to a non-production Azure environment.
- Verify authentication, database connectivity, email, and asset storage in the hosted environment.

## 6. Cross-cutting implementation details

## Suggested folder structure once the app is scaffolded

- `app/` for routes and layouts.
- `components/` for reusable UI.
- `features/` for domain-oriented modules such as quests, invitations, leaderboard, and entries.
- `lib/` for shared utilities, env parsing, auth helpers, and service adapters.
- `prisma/` for schema, migrations, and seed scripts.
- `emails/` for email templates.
- `tests/` or feature-local test files for unit and integration coverage.

## Service boundaries to define early

- `authService`
- `invitationService`
- `questService`
- `scoringService`
- `leaderboardService`
- `notificationService`
- `storageService`
- `auditService`

## Local development contract

- Local development must work with a checked-out repo, env file, installed dependencies, and Docker Compose.
- The app should be usable without any Azure resource dependency for routine UI and business-logic work.
- Production integrations should be swappable through env-driven adapters, not code forks.

## 7. Recommended local stack details

## Required local tools

- Node.js 22 LTS
- pnpm 11.x
- `uv` for Python 3.12 project, environment, and package management if a
  Python-based helper is needed
- Docker Engine or Docker Desktop with Compose
- Playwright browser dependencies

## Recommended local services

- PostgreSQL container
- Mailpit container
- Optional Azurite container if blob-like testing is needed before Azure integration

## Example local workflow

1. Start supporting services with Docker Compose.
2. Install dependencies.
3. Copy env template values into a local env file.
4. Run Prisma migration and seed commands.
5. Start the Next.js development server.
6. Run Vitest and Playwright against the local app.

## 8. Definition of done for MVP

The MVP is complete when all conditions below are true:

- An administrator can create and configure a quest, invite participants, manage challenges, and view reports.
- A competitor can accept an invitation, sign in, log progress, view standings, and inspect participant history pages.
- Local development requires no Azure dependency for routine implementation and testing.
- Production deployment to Azure is documented and exercised through CI/CD.
- Automated test coverage exists for scoring, invitations, authorization, leaderboard ordering, and key browser flows.
- Audit logging exists for admin-sensitive actions.

## 9. Suggested first execution slice

If the coding agent needs a concrete starting sequence, use this order:

1. Complete Phase 0 and Phase 1.
2. Add a seeded admin and sample competitor flow.
3. Implement local sign-in from Phase 3.
4. Build quest administration basics from Phase 5.
5. Build logging and leaderboard basics from Phases 7 and 8.
6. Add invitation flow, challenge management, and reports.
7. Finish notifications, hardening, and Azure deployment work.

This order creates a locally testable vertical slice early, then layers production integrations without blocking feature development.
