import Link from 'next/link'

import type { ChallengeAvailability } from '@prisma/client'

import {
    Button,
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
    EmptyState,
    StatCard,
    TableCard,
} from '@/components/ui'
import {
    ChallengeForm,
    ChallengePolicyPanel,
    getChallengeFormDefaults,
} from './challenge-catalog-fields'
import { ChallengeReviewQueuePanel } from './challenge-review-queue-panel'
import {
    getChallengeReviewStateLabel,
    resolveChallengeCompletionDefaultPoints,
} from '@/lib/challenge-review'
import {
    getChallengeAvailabilityLabel,
    getChallengeReviewLabel,
} from '@/lib/challenge-admin'
import { prisma } from '@/lib/prisma'

import {
    createChallengeAction,
    deleteChallengeAction,
    reviewChallengeCompletionAction,
    updateChallengeAction,
} from './actions'

type ChallengesPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const noticeContent = {
    created: {
        description:
            'The challenge is now part of the reusable catalog and can be assigned to campaigns in the next phase.',
        title: 'Challenge created.',
        tone: 'success',
    },
    deleted: {
        description:
            'The challenge was removed from the catalog because it had no campaign assignments or historical completions.',
        title: 'Challenge deleted.',
        tone: 'success',
    },
    error: {
        description:
            'The challenge change could not be completed. Review the detail below and try again.',
        title: 'Challenge update blocked.',
        tone: 'error',
    },
    'review-approved': {
        description:
            'The submission is now approved, reviewer metadata is stored, and its awarded points are fixed for campaign scoring.',
        title: 'Challenge submission approved.',
        tone: 'success',
    },
    'review-rejected': {
        description:
            'The submission is now rejected, reviewer metadata is stored, and its awarded points were zeroed out.',
        title: 'Challenge submission rejected.',
        tone: 'success',
    },
    updated: {
        description:
            'The catalog entry was saved with the new rules, review behavior, and evidence guidance.',
        title: 'Challenge updated.',
        tone: 'success',
    },
} as const

const errorDetailMessages: Record<string, string> = {
    'challenge-in-use':
        'Challenges with campaign assignments or historical completions stay in the catalog so reporting and references remain intact.',
    'challenge-completion-not-found':
        'That challenge completion record is no longer available.',
    'challenge-not-found': 'That challenge record is no longer available.',
    'challenge-review-resolved':
        'That submission has already been reviewed, so it is no longer available in the pending queue.',
    'invalid-awarded-points':
        'Awarded points must be a valid number that is zero or greater, or left blank to use the default challenge scoring.',
    'invalid-availability':
        'Choose whether the challenge can be completed once or repeated.',
    'invalid-point-value':
        'Point rule must be a valid number that is zero or greater, or left blank to use campaign defaults.',
    'invalid-review-decision':
        'Choose whether the submission should be approved or rejected.',
    'missing-challenge-completion':
        'Choose a valid challenge completion before submitting a review decision.',
    'missing-challenge': 'Choose a valid challenge before running that action.',
    'missing-title': 'Enter a challenge title before saving.',
    'unexpected-error':
        'An unexpected error interrupted the challenge action. Check the server logs if this keeps happening.',
}

function getFirstSearchParamValue(
    value: string | string[] | undefined
): string | null {
    if (Array.isArray(value)) {
        return value[0] ?? null
    }

    return value ?? null
}

function formatPoints(value: { toString(): string } | null) {
    if (!value) {
        return 'Campaign default'
    }

    const numericValue = Number(value.toString())

    return Number.isInteger(numericValue)
        ? numericValue.toString()
        : numericValue.toFixed(2).replace(/\.00$/, '').replace(/0$/, '')
}

function getAvailabilityPillClass(availability: ChallengeAvailability) {
    const baseClassName =
        'inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]'

    if (availability === 'REPEATABLE') {
        return `${baseClassName} bg-[rgba(64,105,124,0.12)] text-[color:var(--blue-slate)]`
    }

    return `${baseClassName} bg-muted text-foreground`
}

function getReviewPillClass(requiresReview: boolean) {
    const baseClassName =
        'inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]'

    if (requiresReview) {
        return `${baseClassName} bg-[rgba(218,165,24,0.18)] text-[color:var(--dusty-olive)]`
    }

    return `${baseClassName} bg-[rgba(135,131,85,0.16)] text-[color:var(--dusty-olive)]`
}

function getNotice(
    outcome: string | null,
    detail: string | null
): {
    description: string
    title: string
    tone: 'error' | 'success'
} | null {
    if (!outcome || !(outcome in noticeContent)) {
        return null
    }

    const content = noticeContent[outcome as keyof typeof noticeContent]

    if (outcome !== 'error') {
        return content
    }

    return {
        ...content,
        description: detail
            ? (errorDetailMessages[detail] ?? content.description)
            : content.description,
    }
}

export default async function AdminChallengesPage({
    searchParams,
}: ChallengesPageProps) {
    const resolvedSearchParams = searchParams ? await searchParams : {}
    const outcome = getFirstSearchParamValue(resolvedSearchParams.outcome)
    const detail = getFirstSearchParamValue(resolvedSearchParams.detail)
    const selectedChallengeId = getFirstSearchParamValue(
        resolvedSearchParams.selectedChallengeId
    )
    const selectedCompletionId = getFirstSearchParamValue(
        resolvedSearchParams.selectedCompletionId
    )
    const notice = getNotice(outcome, detail)

    const [challenges, pendingReviews, resolvedReviews] = await Promise.all([
        prisma.challenge.findMany({
            include: {
                _count: {
                    select: {
                        challengeCompletions: true,
                        campaignChallenges: true,
                    },
                },
            },
            orderBy: [
                {
                    createdAt: 'desc',
                },
            ],
        }),
        prisma.challengeCompletion.findMany({
            include: {
                challenge: {
                    select: {
                        pointValue: true,
                        title: true,
                    },
                },
                campaignChallenge: {
                    select: {
                        pointValueOverride: true,
                    },
                },
                campaignParticipant: {
                    include: {
                        campaign: {
                            select: {
                                pointsPerChallengeCompletion: true,
                                name: true,
                            },
                        },
                        user: {
                            select: {
                                email: true,
                                name: true,
                            },
                        },
                    },
                },
                readingEntry: {
                    select: {
                        activityDate: true,
                        notes: true,
                    },
                },
            },
            orderBy: [
                {
                    createdAt: 'asc',
                },
            ],
            where: {
                reviewState: 'PENDING',
            },
        }),
        prisma.challengeCompletion.findMany({
            include: {
                challenge: {
                    select: {
                        title: true,
                    },
                },
                campaignParticipant: {
                    include: {
                        campaign: {
                            select: {
                                name: true,
                                pointsPerChallengeCompletion: true,
                            },
                        },
                        user: {
                            select: {
                                email: true,
                                name: true,
                            },
                        },
                    },
                },
                reviewedBy: {
                    select: {
                        email: true,
                        name: true,
                    },
                },
            },
            orderBy: [
                {
                    reviewedAt: 'desc',
                },
                {
                    createdAt: 'desc',
                },
            ],
            take: 6,
            where: {
                reviewState: {
                    in: ['APPROVED', 'AUTO_APPROVED', 'REJECTED'],
                },
            },
        }),
    ])

    const selectedChallenge =
        challenges.find((challenge) => challenge.id === selectedChallengeId) ??
        challenges[0] ??
        null

    const totalCount = challenges.length
    const repeatableCount = challenges.filter(
        (challenge) => challenge.availability === 'REPEATABLE'
    ).length
    const reviewCount = challenges.filter(
        (challenge) => challenge.requiresReview
    ).length
    const assignedCount = challenges.filter(
        (challenge) => challenge._count.campaignChallenges > 0
    ).length
    const pendingReviewCount = pendingReviews.length
    const pendingReviewCampaignCount = new Set(
        pendingReviews.map((review) => review.campaignParticipant.campaign.name)
    ).size

    const reviewQueueItems = pendingReviews.map((review) => {
        const params = new URLSearchParams()
        params.set('selectedCompletionId', review.id)

        if (selectedChallengeId) {
            params.set('selectedChallengeId', selectedChallengeId)
        }

        return {
            awardedPoints: review.awardedPoints,
            challengeTitle: review.challenge.title,
            createdAtLabel: new Intl.DateTimeFormat('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
            }).format(review.createdAt),
            defaultAwardedPoints: resolveChallengeCompletionDefaultPoints({
                challengePointValue: review.challenge.pointValue,
                campaignChallengePointValueOverride:
                    review.campaignChallenge?.pointValueOverride ?? null,
                campaignPointsPerChallengeCompletion:
                    review.campaignParticipant.campaign
                        .pointsPerChallengeCompletion,
            }),
            evidenceText: review.evidenceText,
            href: `/admin/challenges?${params.toString()}`,
            id: review.id,
            participantLabel:
                review.campaignParticipant.user.name ||
                review.campaignParticipant.user.email,
            campaignLabel: review.campaignParticipant.campaign.name,
            reviewNotes: review.reviewNotes,
            readingEntryNotes: review.readingEntry.notes,
            submittedActivityLabel: new Intl.DateTimeFormat('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
            }).format(review.readingEntry.activityDate),
        }
    })

    const resolvedReviewItems = resolvedReviews.map((review) => ({
        awardedPoints:
            review.awardedPoints ??
            review.campaignParticipant.campaign.pointsPerChallengeCompletion,
        challengeTitle: review.challenge.title,
        participantLabel:
            review.campaignParticipant.user.name ||
            review.campaignParticipant.user.email,
        campaignLabel: review.campaignParticipant.campaign.name,
        reviewStateLabel: getChallengeReviewStateLabel(review.reviewState),
        reviewedAtLabel: new Intl.DateTimeFormat('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(review.reviewedAt ?? review.createdAt),
        reviewerLabel:
            review.reviewedBy?.name ||
            review.reviewedBy?.email ||
            'Automatic system decision',
    }))

    const rows = challenges.map((challenge) => {
        const canDelete =
            challenge._count.challengeCompletions === 0 &&
            challenge._count.campaignChallenges === 0

        return {
            cells: [
                <div key='challenge' className='stack-sm'>
                    <strong>{challenge.title}</strong>
                    <p className='type-muted text-xs'>
                        {challenge.description ||
                            'No challenge description yet.'}
                    </p>
                </div>,
                <div key='details' className='stack-sm'>
                    <p className='type-muted text-xs'>
                        Category: {challenge.category || 'Uncategorized'}
                    </p>
                    <p className='type-muted text-xs'>
                        Evidence: {challenge.evidencePrompt || 'No prompt set'}
                    </p>
                </div>,
                <div key='rules' className='stack-sm'>
                    <div className='flex flex-wrap gap-2'>
                        <span
                            className={getAvailabilityPillClass(
                                challenge.availability
                            )}
                        >
                            {getChallengeAvailabilityLabel(
                                challenge.availability
                            )}
                        </span>
                        <span
                            className={getReviewPillClass(
                                challenge.requiresReview
                            )}
                        >
                            {getChallengeReviewLabel(challenge.requiresReview)}
                        </span>
                    </div>
                    <p className='type-muted text-xs'>
                        Point rule: {formatPoints(challenge.pointValue)}
                    </p>
                </div>,
                <div key='usage' className='stack-sm'>
                    <p className='type-muted text-xs'>
                        {challenge._count.campaignChallenges} campaign
                        assignments
                    </p>
                    <p className='type-muted text-xs'>
                        {challenge._count.challengeCompletions} completions
                        logged
                    </p>
                </div>,
                <div key='actions' className='flex flex-wrap gap-2'>
                    <Button
                        size='sm'
                        variant='outline'
                        render={
                            <Link
                                href={`/admin/challenges?selectedChallengeId=${challenge.id}`}
                            />
                        }
                    >
                        Edit
                    </Button>

                    <form action={deleteChallengeAction}>
                        <input
                            type='hidden'
                            name='challengeId'
                            value={challenge.id}
                        />
                        <Button
                            nativeButton
                            type='submit'
                            size='sm'
                            variant='destructive'
                            disabled={!canDelete}
                        >
                            Delete
                        </Button>
                    </form>

                    {!canDelete ? (
                        <p className='type-muted text-xs'>
                            Remove campaign assignments and keep history intact
                            before deleting.
                        </p>
                    ) : null}
                </div>,
            ],
            key: challenge.id,
        }
    })

    return (
        <div className='grid gap-6'>
            {notice ? (
                <Card
                    className={
                        notice.tone === 'success'
                            ? 'surface-tint'
                            : 'surface-warm'
                    }
                >
                    <CardHeader>
                        <CardTitle>{notice.title}</CardTitle>
                        <CardDescription>{notice.description}</CardDescription>
                    </CardHeader>
                </Card>
            ) : null}

            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                <StatCard
                    eyebrow='Catalog size'
                    title='Tracked challenges'
                    value={totalCount}
                    description='Every reusable challenge definition lives here before campaign assignment.'
                />
                <StatCard
                    eyebrow='Flexible repeats'
                    title='Repeatable'
                    value={repeatableCount}
                    description='These challenges can be credited more than once for the same participant.'
                />
                <StatCard
                    eyebrow='Moderation load'
                    title='Needs review'
                    value={reviewCount}
                    description='These catalog entries will queue for admin approval once completions are wired.'
                />
                <StatCard
                    eyebrow='Campaign usage'
                    title='Assigned'
                    value={assignedCount}
                    description='Assigned entries are already attached to at least one campaign configuration.'
                />
            </div>

            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                <StatCard
                    eyebrow='Review queue'
                    title='Pending submissions'
                    value={pendingReviewCount}
                    description='Manual-review challenge completions waiting for an admin decision.'
                />
                <StatCard
                    eyebrow='Campaign spread'
                    title='Queued campaigns'
                    value={pendingReviewCampaignCount}
                    description='Number of campaigns currently represented in the pending review queue.'
                />
            </div>

            <ChallengeReviewQueuePanel
                action={reviewChallengeCompletionAction}
                pendingReviews={reviewQueueItems}
                resolvedReviews={resolvedReviewItems}
                selectedChallengeId={selectedChallengeId}
                selectedReviewId={selectedCompletionId}
            />

            <div className='grid gap-6 xl:grid-cols-2'>
                <div className='grid gap-6'>
                    <ChallengePolicyPanel
                        defaults={getChallengeFormDefaults()}
                    />
                    <ChallengeForm
                        action={createChallengeAction}
                        defaultValues={getChallengeFormDefaults()}
                        note='Create stores a reusable catalog entry immediately. Campaign-specific assignment and overrides land in the next phase step.'
                        submitLabel='Create challenge'
                        title='Create a challenge'
                    />
                </div>

                {selectedChallenge ? (
                    <div className='grid gap-6'>
                        <ChallengePolicyPanel
                            defaults={getChallengeFormDefaults(
                                selectedChallenge
                            )}
                        />
                        <ChallengeForm
                            action={updateChallengeAction}
                            challengeId={selectedChallenge.id}
                            defaultValues={getChallengeFormDefaults(
                                selectedChallenge
                            )}
                            note='Editing keeps the same catalog record so future campaign assignments and review behavior stay consistent.'
                            submitLabel='Save challenge'
                            title={`Edit ${selectedChallenge.title}`}
                        />
                    </div>
                ) : (
                    <EmptyState
                        eyebrow='Challenge catalog'
                        title='Create the first reusable challenge.'
                        description='Once a catalog entry exists, you can edit it here and attach it to campaigns in the next challenge-management task.'
                    />
                )}
            </div>

            {rows.length > 0 ? (
                <TableCard
                    title='Challenge catalog'
                    description='The catalog stays reusable across campaigns, with delete reserved for definitions that are still unused.'
                    columns={[
                        'Challenge',
                        'Category and evidence',
                        'Rules',
                        'Usage',
                        'Actions',
                    ]}
                    rows={rows}
                    ariaLabel='Challenge catalog table'
                />
            ) : (
                <EmptyState
                    eyebrow='Challenge catalog'
                    title='No challenges are tracked yet.'
                    description='Use the form to define the first reusable challenge so later campaign-assignment work has a real catalog to target.'
                />
            )}
        </div>
    )
}
