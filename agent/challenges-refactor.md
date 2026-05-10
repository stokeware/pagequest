# Challenge Refactor Plan

Status: Draft for implementation
Date: 2026-05-10
Scope: Database schema, application logic, UI, migration, and validation

## 1. Objective

Rework challenge modeling so every challenge is owned by exactly one campaign, challenge scoring is defined on the challenge itself, competitor-created recommendation and personal-goal challenges are first-class records, and the admin and competitor UI match the rules below.

## 2. Design Requirements

- Every challenge belongs to one campaign and cannot be moved to another campaign.
- Challenge names must be unique within a campaign.
- Every challenge record must support both an absolute point value and a pages-read or minutes-listened multiplier. The unused value should be stored as `0`.
- Administrators explicitly manage normal campaign challenges.
- Each campaign automatically includes two competitor challenge categories: Recommendation and Personal Goal.
- Recommendation and Personal Goal categories are configured by admins in a separate Competitor Challenges table in the admin campaigns view.
- Recommendation and Personal Goal instances are generated from competitor book choices in the campaign challenges tab.
- Recommendation challenges are available to every competitor except the recommender.
- Each competitor has exactly one Personal Goal challenge for the campaign.
- A reading-progress row may have at most one selected challenge.
- A competitor may use each challenge at most once, but may reassign it after deselecting it from the current row.
- Deleting a reading-progress row releases the previously selected challenge.
- The recommendation challenge dropdown should only surface the recommendation that matches the current row's book title, not the full recommendation catalog.
- The challenges list at the bottom of the competitor view should sort Personal Goal first, then recommendation challenges alphabetically, then admin-created challenges alphabetically.

## 3. Current-State Gaps

The current implementation does not line up with the target model.

- Prisma still treats `Challenge` as a global catalog and links it to campaigns through `CampaignChallenge`.
- Challenge scoring still falls back to campaign-wide settings such as `pointsPerChallengeCompletion`.
- The admin campaign UI still exposes `epicReadPageMultiplier` instead of a generic Personal Goal competitor challenge row.
- The competitor challenge tab still stores `recommendationTitle` and `epicReadTitle` as loose workspace state rather than as explicit challenge-domain records.
- The competitor log-progress UI is built around special-case recommendation and epic-read inputs instead of campaign-owned challenge records with consistent scoring and availability rules.

## 4. Recommended Target Model

Use campaign-owned challenge records as the single source of truth and stop modeling challenges as a global catalog plus campaign join rows.

### 4.1 Challenge types

Add a `ChallengeKind` enum with these values:

- `ADMIN`
- `RECOMMENDATION_TEMPLATE`
- `PERSONAL_GOAL_TEMPLATE`
- `RECOMMENDATION_INSTANCE`
- `PERSONAL_GOAL_INSTANCE`

### 4.2 Primary challenge table

Replace the current `Challenge` plus `CampaignChallenge` split with one campaign-owned `Challenge` table.

Recommended fields:

- `id`
- `campaignId`
- `name`
- `kind`
- `pointValue` default `0`
- `pageMinuteMultiplier` default `0`
- `createdByUserId` nullable
- `ownerParticipantId` nullable
- `templateChallengeId` nullable self-reference for recommendation and personal-goal instances
- `sourceBookTitle` nullable
- `isActive` default `true`
- `createdAt`
- `updatedAt`

Recommended constraints:

- Unique `(campaignId, name)`
- Unique template rows per campaign for `RECOMMENDATION_TEMPLATE` and `PERSONAL_GOAL_TEMPLATE`
- Unique personal-goal instance per `(campaignId, ownerParticipantId)`
- Indexes on `(campaignId, kind, isActive)` and `(campaignId, ownerParticipantId, kind)`

### 4.3 Generated competitor challenge state

Persist competitor challenge inputs explicitly instead of burying them in opaque workspace metadata.

Recommended approach:

- Add a small `ParticipantChallengeSource` table keyed to `campaignParticipantId`
- Store `kind` as `RECOMMENDATION` or `PERSONAL_GOAL`
- Store `bookTitle`
- Store `generatedChallengeId`
- Store timestamps so edits can regenerate or rename the backing challenge cleanly

This keeps recommendation and personal-goal book choices auditable and avoids rebuilding business state from free-form workspace JSON.

### 4.4 Completion and assignment records

Keep `ReadingEntry` and `ChallengeCompletion`, but update them so they reference the new campaign-owned challenge row directly.

Recommended rules:

- `ChallengeCompletion.challengeId` becomes required and points only to campaign-owned challenges
- Remove `campaignChallengeId`
- Stop using campaign-wide per-challenge fallback scoring in review and scoring logic
- Enforce one-use-per-challenge-per-participant in the domain layer and, where practical, with a filtered unique index over active completions

## 5. Business Rules To Implement

### 5.1 Campaign ownership and creation

- Challenges can only be created inside a campaign context.
- Admin-created challenges are never shared between campaigns.
- Challenge names are validated against other challenges in the same campaign only.

### 5.2 Competitor challenge templates

- Each campaign automatically receives exactly one Recommendation template and one Personal Goal template.
- Admins edit the template score values in the new Competitor Challenges table.
- Editing a template changes the effective score for all linked generated challenges.

### 5.3 Recommendation instances

- When a competitor enters a recommendation book, create or update a `RECOMMENDATION_INSTANCE` challenge named like `<Display Name>'s Recommendation: <Book Title>`.
- The recommender cannot select their own recommendation challenge.
- Everyone else may select that recommendation challenge once.
- If the recommender changes the book title, rename or regenerate the challenge and release any obsolete availability state.
- If the recommender clears the book, archive or remove the generated recommendation challenge after confirming it is not referenced by historical completions.

### 5.4 Personal goal instances

- Each competitor gets exactly one `PERSONAL_GOAL_INSTANCE` challenge per campaign.
- That challenge is linked to the competitor's chosen personal-goal book.
- Its score is inherited from the Personal Goal template.
- The progress table auto-populates a Personal Goal row as the first row.
- The Personal Goal row cannot be deleted.
- The competitor may edit pages, minutes, and completed state on that row.

### 5.5 Progress-row challenge assignment

- A progress row can reference zero or one challenge.
- A challenge can be attached to only one active progress row for a competitor at a time.
- Reassignment is allowed only after the previous row clears the challenge.
- Deleting a row releases its selected challenge.
- Recommendation choices in the dropdown should only appear when the row's book title matches the recommendation challenge's `sourceBookTitle`.
- The Personal Goal row should already be assigned to the competitor's Personal Goal challenge and should not expose a delete path.

### 5.6 Scoring

- All challenge scoring should resolve from the selected challenge row.
- For generated recommendation and personal-goal instances, effective points and multiplier come from the linked template unless the implementation later needs snapshotting.
- If the score field is `0`, treat it as unused and show a blank cell in read-only tables.
- Remove `epicReadPageMultiplier` from the scoring path.
- Remove campaign-wide challenge score fallback from review and awarded-points logic.

## 6. UI Refactor Plan

### 6.1 Admin campaigns view

Replace the current special-case challenge scoring controls.

- Remove the Epic Read page multiplier input.
- Add a Competitor Challenges table with exactly two rows: Recommendation and Personal Goal.
- Each row should allow admins to set Points and Multiplier.
- Keep `0` values allowed but render blank in read-only displays.

### 6.2 Admin challenges view

- Limit the explicit challenges CRUD table to `ADMIN` challenges only.
- Create new admin challenge rows directly under the active campaign.
- Enforce campaign-local uniqueness in the form and server action.
- Do not allow moving a challenge between campaigns.

### 6.3 Competitor challenges tab

- Replace the current loose Recommendation and Epic Read inputs with Recommendation Books and Personal Goal controls backed by persisted challenge-source data.
- Saving this tab should create or update generated challenge rows, not just workspace text.
- The bottom challenge list should display:
    - Personal Goal first
    - Recommendation challenges next, alphabetized by challenge name
    - Admin-created challenges last, alphabetized by challenge name
- Update columns to show `Points` and `Multiplier` separately.
- Render blank cells instead of `0` in those columns.

### 6.4 Competitor log-progress view

- Auto-insert the Personal Goal row at the top of the progress table.
- Pre-fill that row with the personal-goal book title and selected Personal Goal challenge.
- Hide the delete button for that row.
- Restrict the challenge dropdown so only eligible challenges appear for the current row.
- Recommendation challenges should appear only when the current row's book title matches the recommendation book.
- Prevent selecting a challenge already used by another active row.
- When a row is deleted, release its challenge selection immediately in local UI state and persisted state.

## 7. Application Logic Work Plan

### Phase 1: Schema and migration foundation

1. Add the new enums and campaign-owned challenge structure in Prisma.
2. Add the participant challenge source table.
3. Update `ChallengeCompletion` relations to the new challenge model.
4. Remove obsolete fields and relations after data migration is ready.

### Phase 2: Data migration

1. Create one Recommendation template and one Personal Goal template for every campaign.
2. Migrate admin-managed campaign challenge assignments into direct campaign-owned challenge rows.
3. Map existing Epic Read multiplier values into the new Personal Goal template multiplier.
4. Decide how to seed Recommendation template scores for existing campaigns:
    - If there is an existing canonical recommendation challenge, migrate its score.
    - Otherwise seed `0` and require admin review.
5. Backfill existing challenge completions to reference the migrated campaign-owned challenge rows.
6. Preserve audit-log references where possible.

### Phase 3: Domain services

1. Replace challenge create, update, delete, and validation logic with campaign-owned rules.
2. Add services for creating and updating recommendation and personal-goal challenge instances from competitor inputs.
3. Centralize effective-score resolution for direct and generated challenges.
4. Update log-progress services to enforce one-row-per-challenge and one-challenge-per-row rules.
5. Update challenge review logic to resolve scores from the new model without campaign-wide fallback fields.

### Phase 4: Query and projection updates

1. Update admin workbench queries to load competitor challenge templates separately from admin-created challenges.
2. Update competitor queries to return:
    - the competitor's personal-goal challenge
    - eligible recommendation challenges excluding the competitor's own entries
    - sorted challenge-table data with points and multiplier columns
    - active progress-row challenge assignments
3. Remove query dependencies on `pointsPerChallengeCompletion`, `campaignChallengeId`, and `epicReadPageMultiplier`.

### Phase 5: UI delivery

1. Update the admin campaigns screen.
2. Update the admin challenges screen.
3. Update the competitor challenges tab.
4. Update the competitor log-progress table and dropdown rules.
5. Adjust reports, history, and leaderboard summaries anywhere they still assume campaign-wide challenge points or Epic Read terminology.

## 8. Validation Plan

Add or update tests in each affected layer.

### Prisma and domain tests

- Campaign-local challenge name uniqueness
- Automatic creation of Recommendation and Personal Goal templates
- Recommendation instance generation and renaming
- Personal Goal instance creation and one-per-competitor enforcement
- Effective-score resolution for direct challenges versus template-backed challenges
- Reassignment and release rules for progress-row challenge selection

### UI tests

- Admin campaigns screen shows Competitor Challenges table and no Epic Read multiplier field
- Admin challenges CRUD applies only to admin-created challenges
- Competitor challenges tab sorts rows in the required order
- Recommendation rows render blank points or multiplier cells when values are `0`
- Personal Goal row is first, pre-populated, and not deletable
- Challenge dropdown hides unrelated recommendation challenges and any already-selected challenge

### End-to-end tests

- Admin configures Recommendation and Personal Goal template scores
- Competitor creates a recommendation and another competitor can use it
- Recommender cannot use their own recommendation
- Competitor personal-goal row is auto-created and persists edits
- Deleting a row releases its selected challenge for reuse

## 9. Open Decisions To Resolve Early

- Should generated recommendation and personal-goal challenges inherit template scores dynamically, or should score values be snapshotted onto the instance at creation time? Dynamic inheritance is simpler and matches the current requirement that admin updates propagate.
- When an existing recommendation book is changed after someone else has already used the recommendation, should the old generated challenge be archived and preserved for history rather than renamed in place?
- Should recommendation matching normalize punctuation, case, subtitles, and extra whitespace, or should it require exact title matching? A normalized title key is likely necessary to avoid fragile dropdown behavior.
- Should clearing a personal-goal book be allowed after progress exists, or should the system require replacing the title instead of leaving the challenge without a book?

## 10. Recommended Implementation Order

1. Finalize the target Prisma model and migration rules.
2. Implement domain services for template-backed generated challenges.
3. Update competitor queries and log-progress logic.
4. Update admin campaign and challenge screens.
5. Update competitor challenge and progress UIs.
6. Backfill and expand tests, then run full repo validation.
