# Page Quest Code Review

Date: 2026-10-16 Branch: `dev` @ `7e0800c` (Add an administrator end campaign action) Reviewer: Claude (Opus 5.5)

## Scope and Method

The whole tracked codebase was reviewed (about 40k lines, not counting the lockfile), split into five areas:

1. Authentication, authorization and security
2. Administrator features
3. Competitor features and shared UI
4. Data layer, jobs, email, build and deploy
5. Tests, coding standards and cross-cutting quality

Baseline: `scripts/check` passes cleanly. That covers env validation, format, lint, typecheck, and 56 test files with 261 tests.

Every High finding, and most Medium ones, was confirmed by reading the code path end to end. Several were also reproduced:

- Open redirect: checked with Node URL parsing.
- Prisma `_count.campaignChallenges` crash: query run against the local DB.
- Campaign cascade delete: run in a rolled-back transaction.
- `.env` loader breakage: run with sample values.
- CSS cascade: checked against the compiled stylesheet.

Items marked _(lower confidence)_ are plausible but were not reproduced.

---

## Executive Summary

The codebase is generally clean, consistently formatted and well-guarded at the authorization layer:

- Every server action and the export route re-checks the caller's role.
- IDs from hidden fields are scoped on the server.
- Tokens are hashed.
- Argon2id is used for passwords.

The most important problems come from one **architectural split**. The competitor UI no longer writes `ReadingEntry` rows. `/log-progress` redirects
to `/campaign-board`, and the only competitor write is `saveCampaignWorkspaceAction`. That action stores the whole board as a JSON snapshot in
`AuditLog.metadata`. The competitor leaderboard recomputes totals from that snapshot. Everything else still reads `ReadingEntry`,
`ChallengeCompletion` and `CampaignParticipant.total*`, which are no longer written:

- admin CSV export
- inactivity nudges
- the challenge review queue
- the "challenge in use" guard

So there are two sources of truth, and the server-side copy is stale. Many findings below follow from this. Fixing it should be the first priority.

Other headline issues:

- **Remove member** does not take away access.
- **Campaign dates are stored as noon UTC.** Competitors in US time zones are locked out of the last ~17 hours of a campaign.
- **Reminder and nudge jobs are never scheduled in production.**
- **The seed script wipes whatever database `DATABASE_URL` points to**, with no guard.
- **The workspace save trusts client input** for scores.

### Top 10 priorities

| #   | Issue                                                       | Severity | Section                                                       |
| --- | ----------------------------------------------------------- | -------- | ------------------------------------------------------------- |
| 1   | Pick one scoring source of truth; persist totals on save    | High     | [H1](#h1-two-sources-of-truth-for-scoring)                    |
| 2   | Validate and sanitize the workspace payload on the server   | High     | [H2](#h2-workspace-save-trusts-the-client)                    |
| 3   | Make "Remove member" actually revoke access                 | High     | [H3](#h3-remove-member-does-not-revoke-access)                |
| 4   | Store campaign boundaries in the campaign's time zone       | High     | [H4](#h4-campaign-dates-stored-as-noon-utc)                   |
| 5   | Guard the seed script (and `db-migrate`) against remote DBs | High     | [H5](#h5-seed-script-wipes-any-target-database)               |
| 6   | Schedule reminder jobs (cron route + `vercel.json`)         | High     | [H6](#h6-reminder-jobs-never-run-in-production)               |
| 7   | Fix the open redirect after sign-in                         | Medium   | [M1](#m1-open-redirect-after-sign-in)                         |
| 8   | Fix unlayered global CSS overriding Tailwind utilities      | Medium   | [M10](#m10-unlayered-global-css-overrides-tailwind-utilities) |
| 9   | Delete dead code, incl. the crashing `/admin/challenges`    | Medium   | [Dead code](#dead-code)                                       |
| 10  | Test workspace save, standings, authz denial; e2e in CI     | Medium   | [Testing](#testing)                                           |

---

## High Severity

### H1. Two sources of truth for scoring

**Where:**

- `lib/competitor-queries.ts:733-790`: `resolveParticipantProgressMetrics` derives totals from the latest workspace audit row.
- `app/(competitor)/log-progress/actions.ts:105-223`: the save never updates `CampaignParticipant`.
- `lib/admin-reports.ts:257-279, 492-508, 815`: the CSV export reads the stored totals.
- `lib/jobs/reminders.ts:247-248`: nudges read `lastActivityAt`.

**Impact:**

- The admin CSV export shows 0 points for everyone, ranked by `createdAt`. It disagrees with the leaderboard.
- Inactivity nudges go to people who are actively saving, because `lastActivityAt` is never updated.
- Admin moderation of `ReadingEntry` rows has no effect on what competitors see.
- Workspace challenge completions never reach the review queue.
- The challenge-delete guard (`campaigns/actions.ts:1287-1318`) counts `ChallengeCompletion` rows, which are always 0. An admin can delete a challenge
  readers have checked off and silently change scores.
- Standings are sorted in the DB, then re-sorted in JS. The comparator is duplicated in `competitor-queries.ts:853` and `admin-reports.ts:815`.

**Recommendation:**

1. Decide whether the workspace is _the_ model.
2. If it is, compute the totals inside the save transaction and write them, plus `lastActivityAt`, to `CampaignParticipant`.
3. Make every reader use those columns.
4. Extract one shared `compareStandings` and one totals calculator.
5. Retire the `ReadingEntry`/`submitLogProgressAction` path, or reconnect it deliberately.
6. Long term, the workspace deserves its own table, not `AuditLog.metadata`.

### H2. Workspace save trusts the client

**Where:** `lib/campaign-workspace.ts:56-129, 205-213, 294-302`; `app/(competitor)/log-progress/actions.ts:178-199`.

The client-side cleanup (`sanitizeProgressRows`, `log-progress-screen.tsx:1028-1085`) never runs on the server. A competitor who calls the action
directly can:

- Send `pages: "1e9"` or decimals. `toNonNegativeNumber` accepts any finite number with no upper bound.
- Repeat the same `challengeId` on many rows. Each row adds the challenge points or multiplier, while `totalChallenges` counts it once.
- Reference another participant's personal goal, or template challenges. `getVisibleCompetitorCampaign` doesn't filter by kind or owner.
- Send several `PERSONAL_GOAL` rows, set any `completedAt`, and send unlimited rows and string lengths. The whole payload is appended to `AuditLog` on
  every save.

This is a family app, so the threat is limited. But it is a competition, and one crafted request puts anyone at the top of every leaderboard.

**Recommendation:**

- Move the sanitize and personal-goal helpers into `lib/` and run them server-side against `filterChallengesForCompetitorView(..., participant.id)`.
- Validate with zod: bounded non-negative integers, a maximum row count, and string length limits.
- Count each challenge once.

### H3. "Remove member" does not revoke access

**Where:** `app/(admin)/admin/invitations/actions.ts:653-750`; `lib/invitation-access.ts:78-87`; `lib/auth/access.ts:20`.

`campaignIds` comes from `invitation.campaignId`. Every invitation is created with no campaign (`L343-354`), and resending sets it to `null` (`L501`).
So `campaignIds` is always `[]`, and the `campaignParticipant.updateMany` never runs. Only the invitation rows are deleted.

The member keeps:

- their user row and password
- their live DB sessions
- every `CampaignParticipant` row

`resolveGrantedRoles` gives COMPETITOR to any authenticated user. The removed member keeps logging and stays on leaderboards. They also disappear from
the admin Members list, which is built from ACCEPTED invitations, so the admin can't see them or remove them again.

**Recommendation:** inside the transaction:

- Set `removedAt` on all of the user's active participant rows (no campaign filter).
- Delete the user's sessions.
- Remove their COMPETITOR role.

Gate COMPETITOR access on an actual role or an active membership rather than "is authenticated". Add a regression test with `campaignId: null`
invitations.

### H4. Campaign dates stored as noon UTC

**Where:**

- `lib/campaign-admin.ts:527-528`
- `app/(competitor)/log-progress/actions.ts:167-176`
- `lib/campaign-domain.ts:124-132`
- `app/(competitor)/campaign-board/page.tsx:227`

The admin form's `type='date'` values are stored as `YYYY-MM-DDT12:00:00Z`, and `campaign.timezone` is ignored. A campaign ending Oct 31 in
`America/Chicago` ends at **07:00 CDT on Oct 31**. At that moment the status sync flips it to COMPLETED, and the `now > endAt` check (added in
7e0800c) rejects saves for the rest of the final day, exactly when the last-day rush happens. Campaigns also open at 07:00 on day one. The seed data
(`prisma/seed.mjs:92-93`) uses proper local-midnight boundaries, which shows the intended behaviour.

A related bug: `endCampaignAction` sets `endAt = now`. The settings form round-trips only the date, so saving any edit afterwards rewrites `endAt` to
noon UTC that day. If that is still in the future, the campaign goes back to ACTIVE (`campaigns/actions.ts:402-414`, `campaign-admin.ts:182-187`).

**Recommendation:**

- Convert to `00:00:00.000` (start) and `23:59:59.999` (end) in the campaign time zone, or store an exclusive end.
- Format the dates back in that same time zone.
- Make the dates read-only for COMPLETED campaigns, or keep the stored `endAt` when the submitted date hasn't changed.
- Add tests at the day boundaries.
- Validate `timezone` against `Intl.supportedValuesOf('timeZone')`. It currently comes from a hidden input, and a bad value makes
  `Intl.DateTimeFormat` throw everywhere.

### H5. Seed script wipes any target database

**Where:** `prisma/seed.mjs:278-293` (`resetDatabase`).

The script runs `deleteMany()` on every table and never checks the host. `docs/vercel-deployment.md:563-565` tells operators to
`export DATABASE_URL=<neon>` in their shell, and the wrapper scripts let explicit exports win. Running `pnpm db:seed` or `scripts/local-startup` later
in the same shell wipes production. `docs/local-workflow.md:41-45` also says to run `local-startup` every day, which wipes local data daily.

**Recommendation:**

- Refuse non-loopback hosts unless `PAGEQUEST_ALLOW_REMOTE_SEED=1` is set. `isHostedDatabaseTarget` in `lib/admin-account-cli.ts` already exists and
  can be reused.
- Add the same guard to `scripts/db-migrate`.
- Change the daily-startup doc to `services-up` plus `dev`.

### H6. Reminder jobs never run in production

**Where:** `lib/jobs/runner.ts`, `lib/jobs/reminders.ts`.

There is no `vercel.json`, no cron configuration and no `app/api/cron/*` route. `runServerlessFunction` and `runScheduled` are called only from tests.
The only entry point is `scripts/run-job`, a local `tsx` process. Campaign-start reminders and inactivity nudges are dead in production. Campaign
status still updates, but only because pages write it during render (see [L-infra](#infrastructure-and-data)).

**Recommendation:**

- Add `app/api/cron/reminders/route.ts`, guarded by `Authorization: Bearer ${CRON_SECRET}`.
- Add a `crons` entry to `vercel.json`.
- Validate `CRON_SECRET` in `lib/env.ts`.
- Document the schedule.

Before you enable it, fix [M13](#m13-notification-delivery-robustness) and [M14](#m14-inactivity-nudges-fire-on-day-one).

---

## Medium Severity

### M1. Open redirect after sign-in

**Where:** `lib/auth/access.ts:27-43, 70-78`, used by `app/(public)/sign-in/actions.ts:44`.

`normalizeAppPath` resolves against a dummy base and returns `pathname + search + hash`. Dot segments can produce a path that starts with `//`.
Verified results:

- `'/.//evil.com'` gives `//evil.com`.
- `'http://x//evil.com'` gives `//evil.com`.

Next's client treats `//evil.com` as external and navigates to it. Scenario: a phishing link `/sign-in?callbackUrl=/.//evil.com/login`. The victim
signs in for real, then lands on a fake "session expired" page.

There is also a crash: a non-URL value such as `callbackUrl=dashboard` makes `new URL()` throw _after_ the session cookie is set. The user sees an
error page even though they are signed in.

**Fix:** wrap the parse in try/catch, and reject any result that does not start with a single `/` (or check `new URL(p, APP_URL).origin`). Add tests
for both inputs.

### M2. Rate limiting is missing or ineffective

**Where:** `lib/security/rate-limit.ts`; `app/(public)/sign-in/actions.ts`; `app/(public)/reset-password/actions.ts`.

- **Sign-in has no limit.** The minimum password length is 6, and each attempt costs about 19 MiB plus an argon2 run, so this allows both online
  guessing and cheap DoS.
- **Password-reset requests have no limit.** Anyone can flood a user with reset emails. Each request deletes the previous token, so the victim's real
  links keep dying, and it burns email quota.
- **The existing limits protect almost nothing.** The invitation limits are keyed by invitation ID after a valid token has been found. The admin
  limits throttle trusted admins.
- **The store is a per-process `Map`.** On Vercel that is per instance, reset on cold start, and never pruned.

**Fix:** use a shared store (a Postgres table or Vercel KV/Upstash), keyed by normalized email plus platform-provided IP. Apply it to sign-in and
reset requests.

### M3. Overlapping campaigns can both become ACTIVE

**Where:** `app/(admin)/admin/campaigns/actions.ts:201-231`, `lib/campaign-admin.ts:414-435`.

`assertSingleActiveQuest` runs only when the _next_ status is ACTIVE, and it checks only the current instant. A campaign SCHEDULED to overlap an
active one is promoted by the status sync, and two campaigns are then ACTIVE.

The competitor view picks the visible campaign globally (`lib/competitor-queries.ts:428-503`), not from the viewer's own participations. So members of
the second campaign can't reach it. Non-members, including removed members, can see the leaderboard of an invite-only campaign, with emails shown
where a user has no name.

**Fix:** reject date-range overlap with any published, non-archived campaign inside the write transaction. Select the campaign from the viewer's own
`CampaignParticipant` rows (`selectPrimaryCompetitorParticipant` already exists but is unused), and restrict the board to members.

### M4. One click hard-deletes a live campaign

**Where:** `app/(admin)/admin/campaigns/actions.ts:316-372`, `page.tsx:918-933`.

`deleteCampaignAction` has no status check and sits next to "End Campaign". It cascades to all participants, entries, completions and challenges,
which was confirmed in a rolled-back transaction. Pending invitations survive with `campaignId = NULL`.

The delete also only works because of FK creation order. `ChallengeCompletion.challenge` is `onDelete: Restrict`, and a temp-table repro with the FKs
created in the reverse order fails.

**Fix:**

- Allow delete only for DRAFT campaigns or campaigns with no participants. Otherwise use the existing ARCHIVED status.
- Revoke pending invitations on delete.
- Change the `Restrict` to `NoAction` or `Cascade`.

### M5. Generated challenge titles collide

**Where:** `lib/challenge-config.ts:25-33, 304-345`; `schema.prisma:263` (`@@unique([campaignId, title])`).

Recommendation instances are titled `"<label>'s Recommendation: <book|TBD>"`. Two readers with the same name, or the same email local part (sam@gmail
/ sam@yahoo), collide with a P2002 unique-constraint error. The second reader can **never save their board**.

There is a related problem: if an ADMIN challenge already uses a template title, `ensureCampaignChallengeTemplates` upserts onto it and changes its
`kind`.

**Fix:** identify instances by `(ownerParticipantId, kind)`, which is already unique, and use a partial unique index on title for ADMIN challenges
only. Alternatively, add the participant ID to the title, as Personal Goal already does.

### M6. Progress can be saved before a campaign starts

**Where:** `app/(competitor)/log-progress/actions.ts:167-176`, `campaign-board/page.tsx:227`.

The action checks only the end. The client sets `isReadOnly` only for COMPLETED campaigns. A SCHEDULED campaign shows an editable board and accepts
saves.

**Fix:** require ACTIVE status and `now >= startAt` on both the server and the client.

### M7. `/admin/challenges` crashes on load

**Where:** `app/(admin)/admin/challenges/page.tsx:162-167, 276, 343, 358`; `challenges/actions.ts:105-121, 283`.

Both files select `_count.campaignChallenges`, a relation dropped by migration `20260510143000`. Running the query raises
`PrismaClientValidationError`. Typecheck misses it because nested `_count.select` keys aren't strictly checked, and the unit tests mock Prisma.
Nothing links to the route.

**Fix:** delete the route and its components (see [Dead code](#dead-code)). Separately, `reviewChallengeCompletionAction` never recomputes totals
after an approval.

### M8. Workspace saves can lose user edits

**Where:** `app/(competitor)/log-progress/log-progress-screen.tsx:204-248, 1005-1009`; `actions.ts:108, 181`.

- **Typing during a save is lost.** Inputs stay enabled while the save is pending, and on success `setProgressRows(nextRows)` overwrites anything
  typed in the meantime.
- **A failed save throws away all edits.** `saveCampaignWorkspaceAction` has no try/catch. An expired session or a Prisma error (for example M5) goes
  to `(competitor)/error.tsx`, and all unsaved edits are lost.
- **Untitled rows vanish.** Rows without a book name are silently dropped by `buildWorkspaceState`. Entering "50 pages" without a title leaves Save
  disabled.

**Fix:**

- Return `{ outcome: 'error' }` from the action.
- Add a client-side try/catch.
- Disable or merge edits while a save is pending.
- Keep rows that have any value, or show a validation message.

### M9. Existing members are not added to new campaigns

**Where:** `lib/invitation-access.ts:158-163`.

Participant rows are created only when an invitation is accepted, or as a side effect of rendering `/accept-invitation` (`getInvitationAccessProfile`
→ `ensureMemberCampaignParticipants`). No campaign create or publish path adds participants. Returning members see "Awaiting invitation" for a new
campaign unless they happen to visit `/accept-invitation`.

**Fix:** enroll active members when a campaign is published or activated. Stop writing data during GET renders.

### M10. Unlayered global CSS overrides Tailwind utilities

**Where:** `app/globals.css:178-192`.

The `a`, `h1`–`h4` and `p` rules sit outside any `@layer`. Tailwind v4 utilities live in `@layer utilities`, and unlayered CSS always wins. Confirmed
in the compiled CSS. Effects:

- Save error text (`text-destructive`) renders in body colour, not red.
- Dozens of `text-muted-foreground` paragraphs are not muted.
- Link colours on the home page are overridden.
- Heading `leading-*` loses to `line-height: .98`, which cramps wrapped campaign names on mobile.

**Fix:** move these rules into `@layer base`.

### M11. `.env` loader `eval`s raw lines

**Where:** `scripts/_shared.sh:20-46`.

Both cases were reproduced:

- An unquoted `DATABASE_URL=...?sslmode=require&channel_binding=require` backgrounds the export, so the variable ends up unset. Prisma then silently
  falls back to `127.0.0.1:5433` (`lib/prisma.ts:36-38`).
- An unquoted `EMAIL_FROM=Page Quest <noreply@x>`, exactly as the docs show it, is a bash syntax error that aborts every script.

A `$` in a password also expands.

Two related problems:

- `.env` is loaded before `.env.local` without overrides, so `.env` wins. That is the opposite of the docs and of Next.js.
- `.gitignore`'s `.env*` also ignores `.env.example`, so it was never committed and `scripts/bootstrap` fails on a fresh clone.

**Fix:**

- Parse `KEY=VALUE` literally with no `eval`, or use `node --env-file`.
- Load `.env.local` first.
- Add `!.env.example` to `.gitignore` and commit the file.

### M12. Errors are swallowed and inconsistently surfaced

**Where:** `campaigns/actions.ts:233-243`, `challenges/actions.ts:124`, `reset-password/actions.ts:45-58`, `reset-password/confirm/actions.ts:86-96`.

- **Unknown errors are hidden.** Campaign and challenge actions map them to `unexpected-error`, and the UI says "check the server logs", but nothing
  is logged.
- **Reset actions leak internals and accounts.** They put the raw `error.message` in the URL (for example `connect ECONNREFUSED`, or
  `Missing required email environment variable`). Because this only happens for real accounts, it also reveals whether an account exists.
- **Reset pages show any text from the URL.** They display `?error=` verbatim, which allows spoofed messages on the real domain.
- **A successful admin edit is reported as an error.** In `updateAdminReadingEntryAction` (`reports/actions.ts:110-131`) the success redirect is
  caught by its own `catch`, so every successful edit redirects with `outcome=error`. The action is currently unreachable.

**Fix:**

- Log unknown errors with `console.error`.
- Map P2002 to a specific code.
- Use fixed error codes mapped to fixed messages, as `accept-invitation` already does.
- Replace the four hand-rolled `isRedirectSignal` copies with `unstable_rethrow` from `next/navigation`.

### M13. Notification delivery robustness

**Where:** `lib/jobs/notification-deliveries.ts:117-173`, `lib/jobs/reminders.ts:370-444`.

- **Stuck deliveries.** A row claimed as `SENDING` stays there forever if the process dies, because nothing reclaims stale rows.
- **Duplicate emails.** If `sendMail` succeeds but `completeNotificationDelivery` throws, the row is marked FAILED and the email is sent again on the
  next run.
- **Unlimited retries.** FAILED rows are retried on every run with no cap.
- **SMTP hangs outlive the function.** The SMTP client uses nodemailer's default timeouts (2 min connect, 10 min socket), which exceed Vercel's
  function limit (`lib/email/service.ts:40-50`).

**Fix:**

- Reclaim `SENDING` rows older than about 15 minutes.
- Put only the send call in the `try`.
- Add an `attempts` column with a cap.
- Set SMTP timeouts of about 10s.

### M14. Inactivity nudges fire on day one

**Where:** `lib/jobs/reminders.ts:157-201, 247-248`.

The anchor is `lastActivityAt ?? joinedAt ?? campaign.createdAt`, and `startAt` is ignored. Someone who joined 11 days before the start gets "it has
been 11 days since your last update" alongside the start reminder.

**Fix:** use `max(anchor, campaign.startAt)`.

### M15. Documentation is badly out of date

**Where:** `docs/*.md`.

- **Auth docs describe a system that no longer exists.** The deployment docs require Auth0, `PAGEQUEST_AUTH_MODE`, `AUTH0_*` and
  `LOCAL_AUTH_PASSPHRASE`. None of these exist in the code: auth is password-only. `vercel-deployment.md` has 68 Auth0 mentions, and
  `platform-summary.md` says production auth is Auth0.
- **Wrong claim about create-admin.** `vercel-deployment.md:584-589` says create-admin doesn't store the password. It stores an argon2 hash.
- **Wrong workflow names.** The docs reference `ci.yml`; the real files are `ci-dev.yml` and `ci-main.yml`.
- **Broken links.** `platform-summary.md` has relative `./docs/...` links that don't resolve from inside `docs/`.
- **Stale local-workflow details.** `local-workflow.md` still calls the seed a placeholder and lists Python/`uv` as prerequisites.
- **Missing topics.** No doc covers cron, `CRON_SECRET`, or running migrations on each release.

**Fix:** rewrite the Vercel and local-environment docs around the contract in `lib/env.ts`. Delete or merge `azure-deployment.md` and
`platform-summary.md`.

### M16. CI and deploy pipeline gaps

**Where:** `.github/workflows/ci-*.yml`, `tsconfig.typecheck.json`.

- **No schema/migration drift check.** Editing `schema.prisma` without a migration passes CI.
- **Migrations are manual.** They are not applied on deploy, so a deploy that ships a new column before someone runs `db:migrate:deploy` will fail.
- **No e2e job, and several specs are stale** (see [Testing](#testing)).
- **Tests and scripts are never type-checked.** `next build` type-checks app code, but `tests/` and `scripts/` are excluded everywhere.
  `tsc -p tsconfig.json` reports 33 errors across 10 test files.
- **Every PR runs CI twice.** Both workflows trigger on every `pull_request`.
- **Actions are pinned to major tags, not SHAs.**

**Fix:**

- Add a `prisma migrate diff --exit-code` job.
- Type-check tests in CI with a separate tsconfig.
- Run `prisma migrate deploy` (via `DIRECT_URL`) for production builds.
- Merge the two workflows into one.

---

## Low Severity

### Security

- **CSV formula injection** (`lib/admin-reports.ts:1203-1209`). Reader names are user-supplied. A name like `=HYPERLINK(...)` runs when an admin opens
  the export in a spreadsheet, and `\r` doesn't trigger quoting. Prefix values starting with `= + - @ \t \r` with `'`, and quote values containing
  `\r`.
- **Account enumeration by timing.**
    - Sign-in returns immediately for unknown emails but runs argon2 for known ones (`lib/auth.ts:131-135`). Verify against a dummy hash instead.
    - Reset requests wait on SMTP only for real accounts.
- **Reset token double-use race** (`lib/password-reset.ts:187-233`). Two concurrent submits can both succeed. Consume the token with a conditional
  `deleteMany` and check `count === 1`.
- **No security headers** (`next.config.ts`). There is no `frame-ancestors`/`X-Frame-Options`, so the admin pages and their destructive buttons can be
  framed. There is no CSP.
- **Password trimming is inconsistent.** Every web form trims passwords, but the admin CLI (`lib/admin-account-cli.ts:128-141`) doesn't, so an admin
  password with surrounding spaces can never be used. Stop trimming passwords everywhere.
- **Raw invitation tokens in admin redirect URLs** (`?invitationLink=`). They end up in browser history and logs.
- **CLI password exposure.** `create-admin` accepts `--password` on the command line, which puts it in shell history and the process list.
- **Admin bootstrap secret** (`lib/admin-account-cli.ts:169-211`). It is compared against an env var supplied by the same operator, so it protects
  nothing. Drop it, or document it as a confirmation step.
- **Two cookie-name rules.** `proxy.ts` derives the session cookie name from `APP_URL`, while NextAuth derives it from `NEXTAUTH_URL`/`VERCEL_URL`, so
  the two can disagree. Derive both from one helper.

### Correctness and validation

- **Decimal parsing** (`campaign-admin.ts:552-573, 675-689`, duplicated in `challenge-admin` and `challenge-review`). It accepts `NaN`, `Infinity` and
  hex, and Postgres `numeric` stores NaN. Values ≥ 1e8 overflow and come back as `unexpected-error`. `getOptionalInteger("12abc")` returns 12. Use a
  shared zod schema; zod is already a dependency.
- **`formatPoints` uses `toFixed(2)`** on `Decimal(12,4)` values (`campaigns/page.tsx:158-168`). Any edit in that form silently rewrites a value of
  0.125 to 0.13, including the hidden `pointsPerChallengeCompletion`.
- **Float arithmetic in workspace points** (`campaign-workspace.ts:111-128`). Combined with tie detection by Decimal string, this gives inconsistent
  ranks for players who appear tied (0.30000000000000004 vs 0.3).
- **Wrong or missing error messages.** Campaign `missing-name` says "Enter a challenge name", and challenge `missing-title` has no message
  (`campaigns/page.tsx:101`).
- **Wrong plural.** `pluralize('entry', n)` gives "entrys" (`competitor-participant-detail.ts:138`).
- **Invitation expiry is not enforced.** `expiresAt` and EXPIRED are written but never checked (`_now` is unused).
- **Unchecked job payload.** The `run-job` `--payload` isn't validated: `inactivityCadenceDays: 0` produces Infinity/NaN keys. The script also never
  disconnects Prisma.
- **Thin audit metadata.** `campaign.updated` and `challenge.updated` record `{}`. Scores are computed live, so changing the scoring mid-campaign
  rewrites every past score with no trail. `campaign.ended` has no display label.
- **First edit publishes a draft** (`campaign-admin.ts:186`). This is intentional per the tests, but there is no publish control and the DRAFT concept
  is mostly vestigial.
- **Stale dirty state** _(lower confidence)_ (`dirty-submit-button.tsx:32-58`). The form snapshot is taken once per `formId`. After two consecutive
  saves to the same URL, Save and Discard stay enabled.

### Infrastructure and data

- **Writes during page render.** `synchronizeDerivedCampaignStatuses` writes on every admin and competitor page load (`competitor-queries.ts:208`,
  `campaign-board/page.tsx:54`, `admin/campaigns/page.tsx:216`, `admin/members/page.tsx:151`). Move it to the cron job, or derive status on read.
- **Missing indexes.**
    - `AuditLog` has none. It is queried for the latest workspace snapshot on every board render and grows with every save. Add
      `(campaignParticipantId, action, createdAt desc)` and `(campaignId, createdAt)`.
    - Also missing: `ChallengeCompletion(challengeId)`, `ChallengeCompletion(reviewState)`, `Invitation(campaignId)` and `Session(userId)`.
    - `CampaignParticipant` indexes at `schema:210-211` are redundant.
- **Unbounded queries.** `getRecentReadingEntries` and `getParticipantReadingEntries` have no `take`. `loadCampaigns` loads every challenge, including
  every per-participant instance, for every campaign. The report view loads every `ReadingEntry` just to count them; use `groupBy`.
- **No cleanup of expired rows.** Expired `Session` and `PasswordResetToken` rows are never purged. Add a cleanup job once cron exists.
- **`DATABASE_URL` falls back to localhost even in production** (`lib/prisma.ts`, `prisma.config.ts`, `seed.mjs`). Throw instead. `DIRECT_URL` is
  required by `validateEnvironment` but used only by the migrate and create-admin scripts. `readIntegerEnv("465abc")` returns 465.
- **Email dates have no time zone** (`lib/email/templates.ts:33-38`). They render in UTC without a label. Pass the campaign `timezone` and
  `timeZoneName: 'short'`.
- **`local-startup` doesn't wait for Postgres.** Use `docker compose up -d --wait`.
- **Unpinned image.** `mailpit:latest` is unpinned.
- _(lower confidence)_ node-pg ignores Neon's `channel_binding=require` URL param; it needs `enableChannelBinding`. A module-level `pg.Pool` on Fluid
  compute may leak idle connections without `idleTimeoutMillis`.

### Dependencies

- `motion` and `react-hook-form` have zero imports. Remove them.
- `@auth/core@0.34.3` is a direct dependency with zero imports, while `@auth/prisma-adapter` pulls in `@auth/core@0.41.2`. Remove the direct
  dependency.
- `shadcn` is a runtime dependency only for a CSS import, and it pulls in babel, ts-morph, msw and the MCP SDK. Move it to devDependencies.
- next-auth v4 is used only as a database-session reader (`providers: []`, with custom session creation), alongside an Auth.js-v5-era adapter. It
  works, but the version mix is fragile. Consider reading the session cookie directly and dropping next-auth.
- `pyproject.toml`, `uv.lock` and `.python-version` are leftovers; the repo has no Python. Remove them.

### Accessibility and UI

- **Leaderboard rows.** The row's `aria-label="Open details for X"` replaces the rank and points for screen readers (`leaderboard/page.tsx:65`).
- **Log-progress tabs.** No arrow-key support, and `aria-controls` points to a panel that isn't rendered (`log-progress-screen.tsx:676-702`).
- **Invalid ARIA.**
    - `role='row'` headers sit outside `role='table'` (`log-progress-screen.tsx:784-806`, `campaigns/page.tsx:543-556, 678-692`).
    - `role='list'` has no `listitem` children.
    - `aria-label` sits on a bare `<span>`.
- **Input labels.** The aria-labels expose internal IDs ("Book name progress-row-3") and override the visible labels.
- **Missing structure and alerts.** Save errors have no `role='alert'`. The dashboard has no `<h1>`.
- **Confirmation dialogs.**
    - `confirm-submit-button.tsx` has no focus move or trap, no Escape handling and no focus restore, and it is always styled `destructive`.
    - `components/ui/confirmation-dialog.tsx` is unused and broken. Delete it.
- **Members page.** Remove and Revoke have no confirmation and no member-specific accessible name. `formatDateTime` has no `timeZone`.
- **Motion.** There is no `prefers-reduced-motion` handling for the shimmer or the hover translate.
- **Global error page.** `global-error.tsx` doesn't import `globals.css`, so it renders unstyled.
- **Home page layout.** The page always scrolls, because a `min-h-screen` is nested inside a `min-h-screen` with padding.
- **Stale placeholder copy.** `how-it-works/page.tsx:52-62` ("Later phases will connect … Auth.js"), `public-shell.tsx` ("Phase 3", "MVP shell"), and
  the "local-first" metadata in `app/layout.tsx`.
- **Privacy.** Competitors with no name are shown to everyone by email (`competitor-participant-detail.ts:150`).

---

## Dead Code

Roughly 3,000 lines are unreachable. That code keeps alive tests and patterns that mislead future changes: several bugs above live only in dead paths.

- **Admin reports:**
    - `app/(admin)/admin/reports/page.tsx` just redirects.
    - Orphaned: `reports-screen.tsx` (552 lines), `reports/actions.ts`, `getAdminReportsViewModel` and most of `lib/admin-reports.ts` (1,225 lines).
    - Only the export route is live, and nothing links to it. Keep a small `lib/campaign-results-csv.ts`, and link the export from the campaigns page.
- **`/admin/challenges`** (page, actions, `challenge-catalog-fields.tsx`, `challenge-review-queue-panel.tsx`). It crashes
  ([M7](#m7-admin-challenges-crashes-on-load)) and duplicates the campaigns screen.
- **Unused server actions:** `publishCampaignAction`, `archiveCampaignAction`, `duplicateCampaignAction`, `updateCampaignChallengeAction`,
  `updateCompetitorChallengeAction` (~500 of the 1,358 lines in `campaigns/actions.ts`), and `submitLogProgressAction`.
    - The `submitLogProgressAction` path also has latent bugs: a mismatched error code (`'duplicate-one-time-challenge-completion'` vs
      `'duplicate-challenge-completion'`), no upper bound before int4/`Decimal(12,4)` overflow, and a find-then-create race with no unique constraint
      behind it.
- **Unused components:** `campaign-challenge-assignment-panel.tsx` (tests only; references the removed `pointValueOverride`), `DirtySubmitButton`,
  `ConfirmationDialog`, and `home-countdown.tsx` with `lib/home-page.ts`.
- **Unused helpers:**
    - `getCompetitorHistoryCampaignRecords`, `formatCompetitorHistoryEntries`, `canUseInvitationAcceptance`, `deriveAdminServerActionAccess`.
    - `formatChallengeTableValue`, `isTemplateChallengeKind`, `participantChallengeSourceKinds`.
    - `getCampaignDateWindowHint` and other `lib/log-progress.ts` copy helpers.
    - `shellMetrics`, `summaryMetrics`, `getShellCampaignDetail` and `getDurationLabel` in `competitor-dashboard.ts`.
- **Duplicates and leftovers:** a duplicated union member in `SaveCampaignWorkspaceResult` (`actions.ts:51-60`), and the `/history` matcher in
  `proxy.ts`, which has no route.
- **Unused CSS (~55 classes):**
    - the whole `progress-*` block (`globals.css:950-1145`)
    - `auth-metric-*`, `auth-table-*`, `hero-*`, `pill*`, `page-shell`, `public-*` and others
    - the `.dark` theme block, which is never applied
    - the Geist font, which is loaded but overridden by `--font-sans`

## Duplication and Structure

- **Three "require admin" patterns.**
    - `invitations/actions.ts:248` defines a local redirecting `requireAdminActionUser` that shadows the shared, throwing one in
      `lib/auth/session.ts:300`.
    - The export route builds its own check.
    - Consolidate to one guard.
- **Server-action helpers.** `getStringField` has 8 copies; `isRedirectSignal`, `buildRedirectUrl` and `finishAction` have 4 each;
  `getFirstSearchParamValue` has 7. Create `lib/server-actions.ts` and `lib/search-params.ts`.
- **Formatting helpers.** `formatPoints` has 8 copies; `formatCount`, `pluralize`, `assertNever` and `formatCalendarDate` have 3–6 each;
  `formatCampaignDateRange` and `formatBoundaryDate` have 2 each. Create `lib/format.ts`.
- **Admin form parsing.** `getOptionalString`, `getOptionalDecimal` and `toDecimal` are copied in three modules, and `getCampaignStatusLabel` and
  `normalizeConnectionString` are each copied too. Create a shared zod-based form parser.
- **Large modules to split:**
    - `app/(admin)/admin/campaigns/actions.ts` (1358 lines): campaign lifecycle / challenge actions / form parsing, after removing the dead
      actions.
    - `lib/admin-reports.ts` (1225): mostly dead; keep `campaign-results-csv.ts`.
    - `app/(competitor)/log-progress/log-progress-screen.tsx` (1159): `ProgressRowCard`, `ProgressRowTableRow`, `ChallengesTab` and a
      `useWorkspaceEditor` hook, with the pure helpers moved to `lib/` (needed for H2).
    - `app/(admin)/admin/campaigns/page.tsx` (944): `CampaignSettingsForm`, `CompetitorChallengesTable`, `CampaignChallengesTable`.
    - `lib/log-progress-service.ts` (898): depends on the H1 decision.
    - `lib/competitor-queries.ts` (878): campaign selection / `lib/standings.ts` / entry queries.
    - `app/(admin)/admin/invitations/actions.ts` (754): invitation actions / member actions.

- **`log-progress-screen.tsx` performance.** The card and table editors duplicate all the input JSX, and both render on every keystroke.
  `sanitizeProgressRows` is O(rows² × challenges) per render.
- **Unnecessary client components.** `Label` doesn't need `'use client'`. `AppShell` is a client component only for `usePathname`; extract a small
  client `NavLinks`.

---

## Testing

Coverage (vitest v8, including untested files) is **60.8% of lines and 49.8% of branches**:

- `lib/`: 74.5% lines
- app actions and routes: 51.4%
- app pages: 31.9%

Test hygiene is good:

- No assertion-less tests, unawaited `.rejects`, `.only`/`.skip` or snapshots.
- Time is mostly injected as `now`.

**Gaps, in priority order:**

1. **`saveCampaignWorkspaceAction`, the main competitor write path, is almost untested.** Only the COMPLETED early return is covered.
2. **No test checks that authorization is denied.** Every action test mocks the guard to succeed. Add a table-driven test over all exported admin
   actions: the guard throws, and nothing is mutated.
3. **Standings are untested.** `compareStandings`, `getCampaignStandings` and `resolveParticipantProgressMetrics` have no tests; the leaderboard tests
   feed in pre-sorted data.
4. **Several entry points are untested:**
    - `proxy.ts`, the CSV export route, `sign-in/actions.ts` and `reset-password/actions.ts`: 0–7%.
    - `removeMemberAction`, which would have caught H3.
    - `endCampaignAction` error branches (7e0800c covers only the success path).
5. **The e2e suite is stale and never run in CI:**
    - `home.spec.ts` asserts copy that no longer exists.
    - `log-progress.spec.ts` and `leaderboard-navigation.spec.ts` drive the removed "Save entry" form.
    - The specs leave data behind and hard-code `2026-05-08`.
    - Fix or delete them, then add a CI job with a Postgres service, `migrate deploy`, `db:seed` and `playwright test`.
6. **Tests are not type-checked** (33 errors, for example the duplicate `pointsPerPage` key at `tests/campaign-workspace.test.ts:63`).
7. **Over-mocking.** Tests assert exact Prisma `select`/`data` shapes (12 `select:` blocks inside `toHaveBeenCalledWith`), which break on harmless
   refactors. Prefer asserting outcomes, and add a small integration layer against real Postgres for invitation acceptance, the workspace save and
   ending a campaign.
8. **UI tests are static only.** All 11 use `renderToStaticMarkup` plus `toContain`. Add `@testing-library/react` for the log-progress editing and
   save flows.
9. **Repeated fixtures.**
    - The `NEXT_REDIRECT` mock is copied in 5 files.
    - The Decimal stub appears 37 times across 8 files.
    - The Prisma mocks are copied in 7 files.
    - Factor these into `tests/helpers/`.
10. **Coverage configuration.** `vitest.config.ts` has no `coverage.include` (so untested files are invisible) and no thresholds.

---

## Coding Standards (AGENTS.md)

| Rule                       | Status                                               |
| -------------------------- | ---------------------------------------------------- |
| No end-of-line semicolons  | ✅ 0 violations (checked by walking the syntax tree) |
| Single quotes              | ✅ 0 violations                                      |
| No trailing whitespace     | ✅ 0 violations                                      |
| 4-space indent, no tabs    | ✅ except 1 tab in `scripts/format:8`                |
| Lines ≤ 150 chars          | ❌ 59 lines in code (worst offenders below)          |
| One newline at end of file | ❌ 28 files (listed below)                           |

The 380 lines not indented by a multiple of 4 are Prettier's continuation alignment, which is acceptable. The long lines are mostly long
strings and `className` values. The files missing a final newline are all 24 `scripts/*` shell files, `prisma/schema.prisma`,
`.prettierignore`, `.python-version` and `pyproject.toml`.

Worst long lines:

- `challenge-review-queue-panel.tsx:218,231` (~360)
- `app/(public)/page.tsx:11` (387)
- `log-progress/actions.ts:93` (274)
- `lib/invitation-acceptance.ts:147` (262)
- `components/ui/button.tsx:25-30`

**How enforcement works today.** Prettier (`semi: false`, `singleQuote`, `jsxSingleQuote`, `tabWidth: 4`) enforces most rules for TS, CSS, JSON, YAML
and Markdown. Shell scripts, `schema.prisma` and dotfiles are not covered, and nothing enforces line length.

Recommendations:

- Add ESLint `max-len: ['error', { code: 150, ignoreUrls: true }]`.
- Add an `.editorconfig` (spaces, size 4, final newline, trim whitespace, max length 150).
- Add a small `git ls-files` check, or `shfmt -i 4 -d scripts/`, to `scripts/check`.
- Don't use `prisma format`: it re-indents to 2 spaces.

---

## Strengths

- **Authorization:** every server action and route handler independently checks the role on the server. Roles are reloaded from the DB per request, so
  revoking admin rights takes effect immediately.
- **Server-side scoping:** IDs from hidden fields are re-scoped on the server, and the participant detail page only shows people on the viewer's own
  board.
- **Credentials:** argon2id at the OWASP minimum parameters. Reset and invitation tokens are 192-bit, stored only as SHA-256, and expire. A password
  reset deletes all of the user's sessions in the same transaction.
- **Safe output:** all values in email HTML are escaped. Date formatting passes an explicit locale and time zone, so there are no hydration
  mismatches.
- **Data handling:** scoring uses `Prisma.Decimal`, and ranking handles ties. Multi-row writes and their audit logs share one transaction.
  Notification claims are atomic, using an upsert on a unique idempotency key.
- **Production config:** the environment contract is validated at build time, with checks on secret length, placeholder values and loopback URLs.
- **Code hygiene:** consistent formatting, no TODO/FIXME debris, no stray `console.log`, and a pure, well-tested status-derivation module.

---

## Suggested Roadmap

1. **Integrity fixes (H1–H4).** Choose the workspace as the scoring model, persist the totals, validate on the server, fix member removal, and fix the
   campaign time-zone boundaries. Add tests for each.
2. **Operational safety (H5, H6, M11, M13, M14).** Add the seed guard, the cron route, the env loader fix and the delivery robustness fixes.
3. **Security hardening (M1, M2, M12 and the security Low items).** Fix the redirect, add a shared rate limiter, use fixed error codes, harden the CSV
   escaping and add security headers.
4. **Cleanup.** Delete the dead code, consolidate the duplicated helpers and guards, and split the large modules.
5. **Quality gates.** Type-check tests, add the migration drift check, revive e2e in CI, add a coverage include and thresholds, enforce `max-len`, and
   add an `.editorconfig`.
6. **Docs.** Rewrite the deployment docs for password auth and Vercel cron.
