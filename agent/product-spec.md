# Page Quest Product Specification

Status: Draft for review
Date: 2026-05-05
Product owner: Administrator of the Page Quest family reading competition

## 1. Product Summary

Page Quest is a mobile-friendly and desktop-friendly web application for running recurring reading competitions among family and friends. The application allows an administrator to create time-bound quests, invite participants, define special challenges, and monitor competition progress. Competitors can log completed books, pages read, audiobook minutes listened, and challenge completions while following a live scoreboard throughout the quest.

The product should feel playful, celebratory, and easy to use while remaining structured enough to support recurring annual competitions.

## 2. Product Vision

Create the digital home for a recurring reading competition that feels like a family tournament rather than a generic habit tracker.

The application should:
- Make it easy for the administrator to launch and manage each new quest.
- Make progress logging fast enough that competitors will actually use it consistently.
- Make the scoreboard compelling and easy to understand.
- Work well on phones, tablets, and desktop browsers.
- Be built on modern, maintainable technology with Azure-friendly hosting and operations.

## 3. Primary Goals

## Administrator goals
- Create and configure quests with start dates, end dates, rules, and special challenges.
- Invite family and friends to participate.
- Manage participants, quest settings, and challenge definitions.
- See participation trends and scoreboard standings.

## Competitor goals
- Sign in securely.
- Join a quest from an invitation.
- Quickly record books completed, pages read, audiobook minutes, and challenge completions.
- See personal progress and how they rank against other competitors.

## Business and product goals
- Support recurring yearly competitions without rebuilding data each time.
- Minimize administrator overhead.
- Provide a strong foundation for future enhancements such as badges, streaks, reading groups, and notifications.

## 4. Non-Goals for MVP

The following are explicitly out of scope for the first release unless later approved:
- Native iOS or Android apps.
- Social feeds or public community features.
- Direct e-book or audiobook integrations with Kindle, Audible, Libby, or similar services.
- Complex anti-cheat systems beyond basic admin oversight and audit history.
- Real-time chat.

## 5. User Roles

## Administrator
- Creates and edits quests.
- Defines challenge catalog and scoring rules.
- Invites and manages participants.
- Can review or adjust submissions when needed.

## Competitor
- Accepts invitation and joins active quests.
- Logs reading activity and challenge completions.
- Views standings, history, and personal statistics.

## Optional future role
- Co-admin or scorekeeper with limited admin permissions.

## 6. Core Product Concepts

## Quest
A quest is a competition period with a name, date range, timezone, status, rules, and scoring configuration.

Suggested fields:
- Name
- Description or theme
- Start date and time
- End date and time
- Timezone
- Status: draft, scheduled, active, completed, archived
- Visibility: invite-only
- Scoring rules
- Associated challenge list

## Reading entry
A competitor records progress through structured entries.

Entry types:
- Book completion
- Pages read
- Audiobook minutes listened
- Challenge completion

Each entry should store:
- Competitor
- Quest
- Entry type
- Value
- Date completed or activity date
- Optional book title
- Optional author

## Challenge
A quest can include special challenges that award points or count toward special quest objectives.

Challenge examples:
- Read a biography
- Finish a book recommended by another participant
- Read for seven consecutive days
- Complete a book over 400 pages

Challenge fields:
- Title
- Description
- Category
- Point value or scoring rule
- Evidence requirement: none
- Availability: one-time or repeatable

## Scoreboard
The scoreboard ranks competitors based on configurable scoring rules while also displaying raw reading metrics.

## 7. Scoring Model

The application should support both raw metrics and normalized competition points.

Recommended MVP scoring approach:
- Track raw totals for books completed, pages read, audiobook minutes, and challenges completed.
- Convert raw metrics into competition points using quest-level scoring rules.
- Allow the administrator to configure default point values per quest.

Recommended configurable rules:
- Points per completed book
- Points per page read
- Points per audiobook minute
- Points per challenge completion
- Optional bonus multipliers for specific challenge categories

Recommended initial defaults for the first competition:
- 1 point per page read
- 0.75 points per audiobook minute listened

Administrative requirement:
- The administrator must be able to adjust the point values for pages, audiobook minutes, books, and challenges on a per-quest basis.

Why this approach:
- Families may want to change what counts most from year to year.
- Raw metrics remain visible even if scoring changes.
- The scoreboard remains simple for participants while giving the administrator flexibility.

## 8. Functional Requirements

## 8.1 Authentication and access
- Users must be able to sign in securely.
- Invited users must be able to accept an invitation and create or link an account.
- The system must support role-based access for administrators and competitors.
- Uninvited users must not be able to join a private quest without approval or a valid invitation.

## 8.2 Invitations
- Administrator can invite users by email.
- Invitation email includes quest name, dates, and secure join link.
- Invitation status is tracked: pending, accepted, expired, revoked.
- Administrator can resend or revoke invitations.

## 8.3 Quest management
- Administrator can create, edit, publish, and archive quests.
- Administrator can define quest dates, rules, scoring configuration, and challenge list.
- Administrator can duplicate a previous quest as a starting template for a new one.
- Quest automatically transitions from scheduled to active to completed based on configured dates.
- MVP supports one active quest at a time while preserving access to completed past quests.

## 8.4 Participant management
- Administrator can add, remove, and view quest participants.
- Administrator can see whether each participant has accepted the invitation and submitted activity.
- Participant profiles show display name, avatar, current quest stats, and past quest history.
- All accounts are individual accounts in MVP, with no special child account mode and no shared family account mode.

## 8.5 Progress logging
- Competitors can log completed books.
- Competitors can log pages read.
- Competitors can log audiobook minutes listened.
- Competitors can log completed challenges.
- Users can edit or delete their own recent entries within configurable limits.
- The system should validate that logged activity dates fall within the quest period unless an admin override is used.

## 8.6 Scoreboard and progress tracking
- Display overall leaderboard for each quest.
- Display rank, points, books, pages, minutes, challenges, and recent activity.
- Allow competitors to filter views such as overall standings, friends or family subset, and personal progress.
- Provide quest summary cards with time remaining, current rank, and progress toward challenges.
- The leaderboard should remain concise and should not embed each participant's full reading log directly in the scoreboard view.
- Each participant shown on the leaderboard should link to a participant detail page containing that competitor's full reading history for the active or selected completed quest.

## 8.7 History and reporting
- Competitors can view their own entry history.
- Competitors can view other participants' full reading history through participant detail pages.
- Administrator can view quest-wide summaries and export results.
- Completed quests remain browsable as past seasons.

## 8.8 Notifications
- Send invitation emails.
- Send quest start reminders.
- Send periodic reminder emails or nudges to inactive participants.
- Optional future digest: weekly leaderboard recap.

## 8.9 Administration and moderation
- Administrator can adjust incorrect entries.
- Administrator can approve challenge submissions that require manual review.
- All admin changes should be recorded in an audit log.

## 9. User Experience Requirements

## Design direction
The product should feel whimsical, warm, and competitive, inspired by storybooks, quests, and friendly family rivalry rather than corporate productivity software.

UX principles:
- Fast logging with minimal typing.
- Clear quest status and current standings at a glance.
- Encouraging progress visuals without visual clutter.
- Mobile-first layout with equally strong desktop experience.
- Friendly, readable typography and clear calls to action.

## Accessibility and usability
- Responsive design for phone, tablet, and desktop.
- WCAG 2.2 AA target for contrast, keyboard navigation, and screen reader support.
- Large tap targets and simple forms for mobile usage.
- Straightforward empty states and onboarding prompts.

## 10. Site Organization and Information Architecture

## Public pages
- Home
- How it works
- Sign in
- Accept invitation

## Authenticated competitor experience
- Dashboard
- Active quest detail
- Log progress
- My entries and history
- Challenges
- Leaderboard
- Participant detail and reading history
- Profile and account settings
- Past quests

## Authenticated administrator experience
- Admin dashboard
- Quests list
- Create or edit quest
- Participants and invitations
- Challenge management
- Scoring configuration
- Audit and reports

## Recommended navigation

Primary navigation for competitors:
- Dashboard
- Leaderboard
- Log Progress
- Challenges
- History

Primary navigation for administrators:
- Overview
- Quests
- Participants
- Challenges
- Reports
- Settings

## 11. Key User Flows

## 11.1 Administrator creates a new quest
1. Admin signs in.
2. Admin opens the admin dashboard and selects create quest.
3. Admin enters quest name, description, dates, timezone, and scoring rules.
4. Admin adds or selects special challenges.
5. Admin reviews preview and publishes the quest.
6. Admin sends invitations to participants.

## 11.2 Competitor joins a quest
1. Competitor receives invitation email.
2. Competitor opens secure invite link.
3. Competitor signs in or creates an account.
4. Competitor accepts the invitation.
5. Competitor lands on the quest dashboard with onboarding guidance.

## 11.3 Competitor logs reading progress
1. Competitor opens Log Progress from dashboard or mobile navigation.
2. Competitor selects entry type: book, pages, audiobook minutes, or challenge.
3. Competitor fills a short form.
4. System validates date and values.
5. Entry is saved and scoreboard is recalculated.
6. Competitor sees updated stats and rank.

## 11.4 Competitor views standings
1. Competitor opens leaderboard.
2. System shows current rank, top competitors, recent movement, and personal position.
3. Competitor can switch to raw stats or points view.
4. Competitor can open another participant's profile from the leaderboard to view that participant's full reading history without overloading the leaderboard itself.

## 11.5 Administrator manages challenges
1. Admin opens challenge management.
2. Admin creates or edits challenge definitions.
3. Admin optionally flags a challenge as requiring review.
4. Admin sees pending challenge completions and approves or rejects them.

## 12. MVP Screens

## Public and authentication
- Home page
- Sign in page
- Invitation acceptance page

## Competitor screens
- Personal dashboard
- Quest details
- Log progress form
- Leaderboard
- Participant detail and reading history
- My history
- Challenge list and challenge detail

## Administrator screens
- Admin overview
- Quest create and edit form
- Invitation management
- Participant management
- Challenge management
- Reports and audit view

## 13. Data Model Summary

Core entities:
- User
- Role
- Quest
- QuestParticipant
- Invitation
- Challenge
- ChallengeCompletion
- ReadingEntry
- BookReference
- AuditLog

Suggested relationships:
- One user can join many quests.
- One quest has many participants.
- One quest has many challenges.
- One participant has many reading entries within a quest.
- One invitation belongs to one quest and one email recipient.

## 14. Recommended Technology Stack

## Frontend
- Next.js 15 with App Router
- React 19
- TypeScript
- Tailwind CSS for styling
- shadcn/ui for accessible component primitives
- Framer Motion for targeted interface animation and celebratory leaderboard moments
- React Hook Form with Zod for form handling and validation

Rationale:
- Next.js provides a modern full-stack React foundation with strong support for responsive web apps, server rendering, caching, and routing.
- TypeScript improves maintainability and reduces defects.
- Tailwind CSS plus a component system supports a polished, custom visual identity without heavy front-end overhead.

## Backend
- Next.js server actions and route handlers for the initial backend-for-frontend layer
- Prisma ORM for database access and schema management
- Azure Functions for scheduled jobs and asynchronous processes such as reminders, digest emails, and leaderboard snapshots if needed

Rationale:
- The app scope fits well in a single modern TypeScript codebase.
- This keeps the architecture simpler than a separate frontend and backend during MVP while leaving room to split services later if growth demands it.

## Database
- Azure Database for PostgreSQL Flexible Server

Rationale:
- PostgreSQL is a strong fit for relational data such as users, quests, entries, invitations, and rankings.
- Prisma works especially well with PostgreSQL.
- Azure PostgreSQL is mature, scalable, and operationally aligned with the hosting preference.

## Authentication and identity
- Microsoft Entra External ID for customer and guest authentication
- OIDC integration through Auth.js

Rationale:
- Supports invite-based access with Azure-aligned identity infrastructure.
- Suitable for family and friend accounts without requiring each participant to have a Microsoft work or school identity.

## Email and notifications
- Azure Communication Services Email for invitations and reminders

## File and asset storage
- Azure Blob Storage for avatars, uploaded evidence, and optional future media assets

## Monitoring and operations
- Azure Application Insights
- Azure Log Analytics
- Azure Key Vault for secrets and configuration

## CI and deployment
- GitHub Actions for build, test, and deployment automation

## Testing and quality
- Vitest for unit and component tests
- Playwright for end-to-end flows across desktop and mobile viewports
- ESLint and TypeScript strict mode

## Local development and testing
- Primary day-to-day development should run locally on a developer machine before deploying to Azure environments.
- The application should support a local stack with the web app, PostgreSQL, and supporting developer services started through simple documented commands.
- Recommended local supporting services:
	- PostgreSQL via Docker Compose
	- Mailpit or similar SMTP capture tool for invitation and reminder email testing
	- Optional Azurite or a local filesystem adapter for blob-like asset storage during development
- Authentication should support a development-friendly path through Auth.js, using either a dedicated Microsoft Entra External ID test tenant or a clearly isolated development-only sign-in mode for local testing.
- Background jobs such as reminders and quest status transitions should have a local execution path, such as a manual script, scheduled dev task, or local Azure Functions runtime if adopted.
- Environment configuration should be managed through local env files for development and Azure-managed configuration for hosted environments.

Rationale:
- Local-first development keeps feedback loops short for UI, form, and scoring work.
- Production deployment remains Azure-aligned while development stays practical for a single maintainer or small team.
- Clear separation between local adapters and Azure-backed adapters reduces delivery friction without changing the product architecture.

## 15. Recommended Azure Deployment Architecture

## MVP deployment model
- Web application hosted on Azure App Service for Linux
- PostgreSQL hosted on Azure Database for PostgreSQL Flexible Server
- Static and uploaded files stored in Azure Blob Storage
- Authentication handled through Microsoft Entra External ID
- Emails sent through Azure Communication Services Email
- Monitoring through Application Insights and Log Analytics
- Secrets stored in Azure Key Vault

## Local-to-cloud architecture alignment
- Use the same Next.js, Prisma, and Auth.js application structure in local and hosted environments.
- Keep integration boundaries explicit for email, asset storage, and background jobs so local adapters can be swapped for Azure services through configuration.
- Keep environment variable names consistent between local env files, CI, and Azure App Service settings.
- Prefer Docker Compose for local dependency orchestration so the database and developer support services closely mirror deployed behavior.
- Treat local development as the default implementation path and Azure deployment as the promotion target once features pass local and CI validation.

Why this hosting model:
- Simple to operate for a single full-stack web application.
- Supports server-rendered Next.js features cleanly.
- Azure-native services reduce operational friction and fit the stated hosting preference.

## Future scale options
- Move the app to Azure Container Apps if container-first deployment becomes preferable.
- Add Azure Cache for Redis if leaderboard caching becomes necessary at higher traffic.
- Split background processing further if notification and reporting complexity grows.

## 16. Security and Privacy Requirements

- Role-based authorization for administrator and competitor actions.
- Invite links must be signed, expiring, and single-purpose.
- Sensitive secrets stored only in Azure Key Vault.
- HTTPS enforced across all environments.
- Audit log for admin changes and moderation actions.
- Basic privacy controls for participant names and avatars.
- Data retention policy for archived quests and deleted accounts should be defined before launch.

## 17. Performance Requirements

- Primary pages should feel responsive on typical mobile connections.
- Logging progress should complete in a small number of taps.
- Scoreboard updates should be visible immediately after a successful entry submission.
- Leaderboard queries should remain efficient for expected family-scale usage and should not require premature infrastructure complexity.

## 18. Suggested MVP Milestones

## Milestone 1: Foundation
- Project setup
- Authentication
- Base design system
- User roles and profile model

## Milestone 2: Quest administration
- Quest creation and editing
- Challenge management
- Invitations
- Participant management

## Milestone 3: Competitor experience
- Dashboard
- Progress logging
- History
- Leaderboard

## Milestone 4: Hardening and launch readiness
- Email notifications
- Audit logging
- Accessibility pass
- Mobile polish
- Testing and deployment pipeline

## 19. Risks and Mitigations

## Risk: scoring rules become confusing
Mitigation: show both raw stats and computed points, and provide a plain-language explanation of how points are calculated on each quest.

## Risk: competitors do not log consistently
Mitigation: make logging extremely fast, mobile-first, and reminder-friendly.

## Risk: challenge submissions may be subjective
Mitigation: define challenges clearly and keep challenge completion simple since proof is not required in MVP.

## Risk: authentication adds unnecessary complexity
Mitigation: use a managed identity provider and invite-driven flows rather than building custom auth from scratch.

## 20. Open Questions for Approval

Approved product decisions for MVP:
- Pages and audiobook minutes both count directly toward points, with separate configurable weights.
- The initial default weighting is 1 point per page and 0.75 points per audiobook minute, with admin control to change these values per quest.
- Challenge completions do not require proof in MVP.
- Participants can view each competitor's full reading history from participant detail pages linked from the leaderboard.
- The leaderboard itself should remain summary-focused and uncluttered.
- MVP supports one active quest at a time, with historical access to completed quests.
- All participant accounts are individual accounts with no shared-account model in the first release.

Deferred beyond MVP unless later approved:
- Team-based competition support.

## 21. Recommendation

Build Page Quest as a single full-stack TypeScript application using Next.js, PostgreSQL, Prisma, and Microsoft Entra External ID, deployed to Azure App Service with supporting Azure services for storage, email, secrets, and monitoring.

This is the most suitable modern architecture for the initial release because it keeps the application maintainable, mobile-friendly, visually flexible, and operationally straightforward while fitting naturally into an Azure hosting strategy, while also supporting configurable scoring, participant history pages, recurring single-season quest management, and a practical local development workflow.