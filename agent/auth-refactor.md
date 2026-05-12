# Page Quest Authentication Refactor Plan

Status: Proposed
Date: 2026-05-11
Owner: Coding agent

## 1. Objective

Replace the current Auth0-based authentication flow with application-owned
account management while preserving the existing invitation model,
role-based access control, and protected-route behavior.

The target user experience is:

1. An admin sends an invitation from the existing Members flow.
2. The invitation link opens a simple signup form with the invited email
   prefilled and read-only.
3. The invitee enters name, password, and password confirmation.
4. The site creates the account, grants Competitor access, and records the
   invitation acceptance.
5. The site redirects the user to a simple login form.
6. Successful login redirects the user to the dashboard.
7. Login persists for 14 days of inactivity-aware use.
8. Explicit logout clears the session immediately.

## 2. Recommended Technical Approach

Use first-party email and password authentication backed by the existing
database, but keep Auth.js for session issuance and route protection.

This is the lowest-risk path because the app already centralizes auth state in:

- lib/auth.ts
- lib/auth/session.ts
- lib/auth/middleware.ts
- app/(public)/sign-in/page.tsx
- app/(public)/accept-invitation/page.tsx

### Decision

Keep:

- Auth.js session helpers and middleware integration.
- Existing role resolution based on User and RoleAssignment.
- Existing invitation token model and acceptance audit trail.

Replace:

- Auth0 provider integration.
- Local shared-passphrase demo credentials flow.
- Hosted signup and hosted login UI copy.

Add:

- Password hashing using Argon2id.
- App-owned signup action on the invitation acceptance page.
- App-owned credentials login against the User record.
- Rolling server-managed sessions stored in the database.

### Why this approach

- It removes the external identity dependency without rewriting every auth
  boundary in the app.
- It preserves current Next.js and Auth.js session ergonomics for server
  components, middleware, and client redirects.
- It gives reliable logout and inactivity expiry without needing OAuth refresh
  tokens.

### Session strategy

Switch from JWT sessions to database-backed sessions.

Recommended settings:

- session.strategy = 'database'
- session.maxAge = 14 _ 24 _ 60 \* 60
- session.updateAge = 24 _ 60 _ 60

This creates rolling sessions that stay alive for up to 14 days since the last
use of the site. That matches the requested behavior more closely than the
current JWT-only setup.

No refresh token mechanism is needed. Refresh tokens are useful when the app
must renew third-party access tokens. This app only needs to maintain its own
session, so an opaque database session cookie is the simpler and better fit.

## 3. Data Model Changes

Extend the current User model and add the session tables required for
server-managed authentication.

### User changes

Add fields to User:

- passwordHash String?
- passwordSetAt DateTime?
- authMethod AuthMethod @default(PASSWORD)
- lastPasswordChangeAt DateTime?

Optional but recommended later:

- failedSignInCount Int @default(0)
- lockedAt DateTime?

### New enum

Add:

- enum AuthMethod { PASSWORD }

### Session persistence

If Auth.js remains the session layer, add the Prisma models needed for its
database session adapter:

- Session
- VerificationToken
- Account

Account can remain mostly unused after Auth0 removal, but keeping the standard
adapter schema reduces framework friction and future-proofs account recovery or
email verification features.

### Invitation model

Keep the existing Invitation model and token hashing design.

The invitation record should remain the gate for account creation. The signup
action should only succeed when the invitation token is valid and the invited
email matches the account being created.

## 4. Target Flows

## 4.1 New user invitation signup

1. Admin sends invite from the existing Members view.
2. Invitee opens /accept-invitation?token=...
3. The page loads the invitation, validates token state, and renders a single
   form card with:
    - email read-only
    - name
    - password
    - confirm password
4. Server action validates:
    - token format and existence
    - invitation state is pending and not expired or revoked
    - email is not already bound to a password account
    - password strength and password confirmation
5. Server action creates:
    - User
    - RoleAssignment for COMPETITOR
    - CampaignParticipant when the invite is campaign-scoped
    - Invitation acceptance audit updates
6. The action redirects to /sign-in with the invited email prefilled and a
   success notice.
7. The user signs in and is redirected to /dashboard.

Important: do not auto-sign-in immediately after signup. The requested flow is
explicitly signup first, then login.

## 4.2 Existing user invitation acceptance

Existing users still need a clean path for later campaign invites.

Recommended behavior:

1. If the invited email already belongs to an existing password account, the
   invitation page should not show the signup form.
2. Instead, it should show a compact message that the account already exists
   and a button to continue to login.
3. After login, the app should finalize invitation acceptance when the session
   email matches the invitation email.

This preserves recurring-campaign behavior without forcing duplicate accounts.

## 4.3 Login

Replace the current hosted or demo sign-in screen with a simple in-app form:

- email
- password
- submit button

Behavior:

- Validate credentials against the local User record.
- On success, create a database session.
- Redirect to callbackUrl when present, else to the user landing path.
- Prefill email when arriving from successful invitation signup.

## 4.4 Logout

Expose a simple server action or button that calls Auth.js signOut and clears
the current session.

Expected result:

- Session is removed from the database.
- Session cookie is cleared.
- Protected pages redirect to /sign-in on the next visit.

## 5. UI Changes

The public auth pages should stop acting like landing pages and instead become
compact entry points consistent with the rest of the application.

### Sign-in page

Replace the current descriptive Auth0 or local-demo copy with:

- a single FormCard
- concise title and helper text
- email and password inputs
- error state inline inside the card

### Accept invitation page

Replace the current hosted-auth messaging with:

- simple invitation status handling
- signup form for new users
- login redirect path for existing users
- compact success and failure notices

### Design direction

- Match spacing, card layout, input styling, and button treatment already used
  in authenticated forms.
- Keep campaign context lightweight. Show the campaign name only if it helps
  orient the user.
- Remove long explanatory paragraphs about hosted identity or secure-link
  handoffs.

## 6. Application Changes by Area

### Auth core

Update:

- lib/auth.ts
- lib/auth/config.ts
- lib/auth/session.ts
- lib/auth/middleware.ts
- lib/auth/hosted-sign-in.ts
- lib/auth/access.ts

Main changes:

- Remove Auth0 provider configuration.
- Remove shared-passphrase local mode.
- Add credentials authorize logic using password verification.
- Switch to database sessions.
- Keep current role enrichment logic for session and middleware checks.

### Invitation acceptance

Update:

- app/(public)/accept-invitation/page.tsx
- app/(public)/accept-invitation/actions.ts
- lib/invitation-acceptance.ts
- lib/invitation-service.ts

Main changes:

- Split account creation from existing signed-in acceptance.
- Add signup action for token-based account creation.
- Preserve current invitation status validation and audit behavior.
- Preserve rate limiting on acceptance and add rate limiting on signup.

### Sign-in UI

Update:

- app/(public)/sign-in/page.tsx
- components/public/sign-in-form.tsx

Main changes:

- Convert from provider-switching UI to a single app-owned login form.
- Keep callbackUrl behavior.
- Add email prefill and success notice support after signup.

### Schema and persistence

Update:

- prisma/schema.prisma
- prisma/migrations/\*
- prisma/seed.mjs

Main changes:

- Add password and session persistence fields.
- Seed password-based local users instead of shared-passphrase demo auth.
- Ensure existing seeded admin and competitor accounts can log in normally.

### Environment and docs

Update:

- lib/env.ts
- docs/local-environment.md
- docs/local-workflow.md
- README.md
- scripts/validate-env.mts

Main changes:

- Remove Auth0 requirements.
- Add app auth secret and any password policy settings.
- Document local seeded credentials and the invite signup flow.

## 7. Suggested Implementation Sequence

## Phase 1: Schema and cryptography

1. Add password-related User fields and Auth.js session models.
2. Add Argon2id hashing helpers and password validation helpers.
3. Add Prisma migration.
4. Update seed data to create password-based users.

Validation:

- Prisma migration applies cleanly.
- Seeded users include password hashes.
- Unit tests cover password hash and verify helpers.

## Phase 2: Auth core rewrite

1. Remove Auth0 provider and local shared-passphrase config.
2. Add credentials authorize logic against passwordHash.
3. Move Auth.js to database sessions with 14-day rolling expiry.
4. Keep existing role enrichment and landing-path behavior.

Validation:

- Unit tests cover successful login, wrong password, missing passwordHash,
  and role enrichment.
- Middleware still redirects unauthenticated and wrong-role users correctly.

## Phase 3: Invitation signup flow

1. Add a server action to create an invited account from a valid token.
2. Update accept-invitation page to show the signup form for new users.
3. Redirect successful signup to sign-in with email prefilled.
4. Preserve existing acceptance flow for already-authenticated users.

Validation:

- Tests cover expired, revoked, malformed, and already-used tokens.
- Tests cover password mismatch and duplicate-email handling.
- Tests confirm successful signup writes User, RoleAssignment, and
  Invitation acceptance data.

## Phase 4: Public auth UI cleanup

1. Simplify the sign-in page.
2. Simplify the accept-invitation page.
3. Remove hosted-auth copy and Auth0-specific language.

Validation:

- Component tests cover the simplified forms.
- Accessibility checks pass for focus order, labels, and error messaging.

## Phase 5: Logout, docs, and cleanup

1. Confirm logout clears database sessions.
2. Remove unused hosted-sign-in helpers.
3. Remove Auth0 env usage and docs.
4. Update local setup docs.

Validation:

- Manual sign-in and logout flow succeeds.
- No remaining Auth0 references in app code or docs.

## 8. Test Plan

Update or replace these existing test areas:

- tests/auth-provider.test.ts
- tests/auth-config.test.ts
- tests/auth-session.test.ts
- tests/auth-middleware.test.ts
- tests/accept-invitation-actions.test.ts
- e2e/auth-flow.spec.ts

Add coverage for:

- password hashing and verification
- login success and failure
- 14-day rolling session behavior
- logout invalidation
- invitation signup for new users
- existing-user invitation acceptance
- redirect-to-callback behavior after login
- competitor access assignment after signup

Run before completion:

- scripts/check

## 9. Migration and Rollout Notes

Existing Auth0-backed users need a path into password-based login.

Recommended rollout:

1. Ship the new password-based auth flow.
2. For users without passwordHash, send a one-time password setup link.
3. Reuse the invitation-style token pattern for secure password enrollment.
4. Remove Auth0 only after active users have a first-party password path.

If a staged rollout is not needed and the user base is small, an acceptable
manual approach is:

1. Generate password-setup invitations for all current users.
2. Require password creation before the Auth0 integration is removed.

## 10. Risks and Recommendations

### Password reset

This plan focuses on signup, login, and logout because that is the requested
scope. In practice, password reset should be the next auth task after the core
refactor. The invitation-token design can be reused for reset tokens.

### Brute-force protection

Login and signup actions should be rate-limited. The repository already has a
rate-limit helper used in invitation acceptance and should be reused.

### Email verification

Because account creation is gated by an invitation email and a signed token,
separate email verification is optional for the first cut. It can be added
later if broader self-service signup is introduced.

### Session revocation

Database sessions give cleaner logout and revocation semantics than JWT-only
sessions. This is one of the main reasons to switch session strategy during the
refactor.

## 11. Summary

The recommended refactor is to keep Auth.js as the session and middleware
layer, replace Auth0 with first-party email and password credentials, move to
database-backed rolling sessions, and rebuild the public signup and login pages
as compact in-app forms.

That approach is aligned with the current code structure, matches the desired
14-day login persistence behavior, and avoids unnecessary complexity such as
OAuth refresh tokens.
