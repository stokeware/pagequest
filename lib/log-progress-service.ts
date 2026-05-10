import { type Prisma } from '@prisma/client'
import type {
    ChallengeKind,
    ChallengeReviewState,
    ReadingEntryType,
} from '@prisma/client'

import {
    assertChallengeCompletionAllowed,
    ChallengeReviewError,
    prepareAutoApprovedChallengeCompletionValues,
    resolveChallengeCompletionDefaultPoints,
} from '@/lib/challenge-review'
import { resolveChallengePointValue } from '@/lib/challenge-config'
import {
    normalizeReadingEntryMetadata,
    type LogProgressFormValues,
    type LogProgressCampaignPolicy,
    validateLogProgressFormValues,
} from '@/lib/log-progress'
import {
    calculateParticipantScoreTotals,
    type ParticipantScoreTotals,
    type CampaignScoringRules,
    type ScoringEntry,
} from '@/lib/campaign-domain'

type ParticipantSnapshot = {
    id: string
    removedAt: Date | null
    userId: string
    campaign: {
        entryDeleteWindowMinutes: number | null
        entryEditWindowMinutes: number | null
        challenges: Array<{
            id: string
            pageMinuteMultiplier: { toString(): string }
            pointValue: { toString(): string }
            templateChallenge: {
                pageMinuteMultiplier: { toString(): string }
                pointValue: { toString(): string }
            } | null
            title: string
            kind: ChallengeKind
        }>
        endAt: Date
        id: string
        pointsPerAudiobookMinute: { toString(): string }
        pointsPerBook: { toString(): string }
        pointsPerPage: { toString(): string }
        startAt: Date
        timezone: string
    }
}

type PersistedReadingEntry = {
    activityDate: Date
    challengeCompletion: {
        awardedPoints: { toString(): string } | null
        reviewState: ChallengeReviewState
    } | null
    type: ReadingEntryType
    value: number
}

type EditableReadingEntrySnapshot = {
    activityDate: Date
    bookAuthor: string | null
    bookTitle: string | null
    createdAt: Date
    deletedAt: Date | null
    id: string
    notes: string | null
    campaignParticipant: ParticipantSnapshot
    type: ReadingEntryType
    value: number
}

type LogProgressTransaction = {
    auditLog: {
        create: (args: {
            data: {
                action: string
                actorUserId: string
                challengeCompletionId?: string
                challengeId?: string
                entityId: string
                entityType: string
                metadata: Prisma.InputJsonValue
                campaignId: string
                campaignParticipantId: string
                readingEntryId?: string
            }
        }) => Promise<unknown>
    }
    challengeCompletion: {
        create: (args: {
            data: {
                awardedPoints?:
                    | Prisma.Decimal
                    | Prisma.DecimalJsLike
                    | number
                    | string
                    | null
                challengeId: string
                evidenceText: string | null
                campaignParticipantId: string
                readingEntryId: string
                reviewNotes?: string | null
                reviewState: ChallengeReviewState
                reviewedAt?: Date | null
                reviewedByUserId?: string | null
            }
            select?: {
                id: true
            }
        }) => Promise<{
            id: string
        }>
        findMany: (args: {
            select: {
                reviewState: true
            }
            where: {
                challengeId: string
                campaignParticipantId: string
                readingEntry: {
                    deletedAt: null
                }
            }
        }) => Promise<
            Array<{
                reviewState: ChallengeReviewState
            }>
        >
    }
    campaignParticipant: {
        findUnique: (args: {
            select: {
                id: true
                removedAt: true
                userId: true
                campaign: {
                    select: {
                        entryDeleteWindowMinutes: true
                        entryEditWindowMinutes: true
                        endAt: true
                        id: true
                        pointsPerAudiobookMinute: true
                        pointsPerBook: true
                        pointsPerPage: true
                        challenges: {
                            select: {
                                id: true
                                kind: true
                                pageMinuteMultiplier: true
                                pointValue: true
                                templateChallenge: {
                                    select: {
                                        pageMinuteMultiplier: true
                                        pointValue: true
                                    }
                                }
                                title: true
                            }
                            where: {
                                isActive: true
                                kind: {
                                    in: [
                                        'ADMIN',
                                        'PERSONAL_GOAL_INSTANCE',
                                        'RECOMMENDATION_INSTANCE',
                                    ]
                                }
                            }
                        }
                        startAt: true
                        timezone: true
                    }
                }
            }
            where: {
                id: string
            }
        }) => Promise<ParticipantSnapshot | null>
        update: (args: {
            data: {
                lastActivityAt: Date | null
                totalAudiobookMinutes: number
                totalBooks: number
                totalChallenges: number
                totalPages: number
                totalPoints:
                    | Prisma.Decimal
                    | Prisma.DecimalJsLike
                    | Prisma.DecimalFieldUpdateOperationsInput
                    | number
                    | string
            }
            where: {
                id: string
            }
        }) => Promise<unknown>
    }
    readingEntry: {
        create: (args: {
            data: {
                activityDate: Date
                bookAuthor: string | null
                bookTitle: string | null
                createdByUserId: string
                notes: string | null
                campaignParticipantId: string
                type: ReadingEntryType
                updatedByUserId: string
                value: number
            }
            select: {
                id: true
            }
        }) => Promise<{
            id: string
        }>
        findUnique: (args: {
            select: {
                activityDate: true
                bookAuthor: true
                bookTitle: true
                createdAt: true
                deletedAt: true
                id: true
                notes: true
                campaignParticipant: {
                    select: {
                        id: true
                        removedAt: true
                        userId: true
                        campaign: {
                            select: {
                                entryDeleteWindowMinutes: true
                                entryEditWindowMinutes: true
                                endAt: true
                                id: true
                                challenges: {
                                    select: {
                                        id: true
                                        kind: true
                                        pageMinuteMultiplier: true
                                        pointValue: true
                                        templateChallenge: {
                                            select: {
                                                pageMinuteMultiplier: true
                                                pointValue: true
                                            }
                                        }
                                        title: true
                                    }
                                    where: {
                                        isActive: true
                                        kind: {
                                            in: [
                                                'ADMIN',
                                                'PERSONAL_GOAL_INSTANCE',
                                                'RECOMMENDATION_INSTANCE',
                                            ]
                                        }
                                    }
                                }
                                pointsPerAudiobookMinute: true
                                pointsPerBook: true
                                pointsPerPage: true
                                startAt: true
                                timezone: true
                            }
                        }
                    }
                }
                type: true
                value: true
            }
            where: {
                id: string
            }
        }) => Promise<EditableReadingEntrySnapshot | null>
        findMany: (args: {
            orderBy: {
                activityDate: 'asc'
            }
            select: {
                activityDate: true
                challengeCompletion: {
                    select: {
                        awardedPoints: true
                        reviewState: true
                    }
                }
                type: true
                value: true
            }
            where: {
                deletedAt: null
                campaignParticipantId: string
            }
        }) => Promise<PersistedReadingEntry[]>
        update: (args: {
            data: {
                activityDate: Date
                bookAuthor: string | null
                bookTitle: string | null
                notes: string | null
                type: Exclude<ReadingEntryType, 'CHALLENGE_COMPLETION'>
                updatedByUserId: string
                value: number
            }
            where: {
                id: string
            }
        }) => Promise<unknown>
    }
}

export class LogProgressMutationError extends Error {
    code: string

    constructor(code: string, message: string) {
        super(message)
        this.code = code
        this.name = 'LogProgressMutationError'
    }
}

export type RecordLogProgressInput = {
    actorUserId: string
    formValues: LogProgressFormValues
    now: Date
    campaignParticipantId: string
}

export type RecordLogProgressResult = {
    challengeCompletionId: string | null
    campaignId: string
    campaignParticipantId: string
    readingEntryId: string
    totals: ParticipantScoreTotals
}

export type AdminUpdateReadingEntryInput = {
    actorUserId: string
    formValues: LogProgressFormValues
    now: Date
    readingEntryId: string
}

export type AdminUpdateReadingEntryResult = {
    campaignId: string
    campaignParticipantId: string
    readingEntryId: string
    totals: ParticipantScoreTotals
}

export async function recordLogProgressEntry(
    transaction: LogProgressTransaction,
    input: RecordLogProgressInput
): Promise<RecordLogProgressResult> {
    const participant = await transaction.campaignParticipant.findUnique({
        select: {
            id: true,
            removedAt: true,
            userId: true,
            campaign: {
                select: {
                    entryDeleteWindowMinutes: true,
                    entryEditWindowMinutes: true,
                    challenges: {
                        select: {
                            id: true,
                            kind: true,
                            pageMinuteMultiplier: true,
                            pointValue: true,
                            templateChallenge: {
                                select: {
                                    pageMinuteMultiplier: true,
                                    pointValue: true,
                                },
                            },
                            title: true,
                        },
                        where: {
                            isActive: true,
                            kind: {
                                in: [
                                    'ADMIN',
                                    'PERSONAL_GOAL_INSTANCE',
                                    'RECOMMENDATION_INSTANCE',
                                ],
                            },
                        },
                    },
                    endAt: true,
                    id: true,
                    pointsPerAudiobookMinute: true,
                    pointsPerBook: true,
                    pointsPerPage: true,
                    startAt: true,
                    timezone: true,
                },
            },
        },
        where: {
            id: input.campaignParticipantId,
        },
    })

    if (!participant) {
        throw new LogProgressMutationError(
            'participant-not-found',
            'The selected campaign participant record is no longer available.'
        )
    }

    if (participant.userId !== input.actorUserId) {
        throw new LogProgressMutationError(
            'participant-access-denied',
            'You can only log progress for your own campaign profile.'
        )
    }

    if (participant.removedAt) {
        throw new LogProgressMutationError(
            'participant-removed',
            'This campaign profile is no longer active.'
        )
    }

    const validationResult = validateLogProgressFormValues(input.formValues, {
        availableChallengeIds: participant.campaign.challenges.map(
            (challenge) => challenge.id
        ),
        campaignPolicy: toCampaignPolicy(participant.campaign),
    })

    if (!validationResult.success) {
        const firstIssue = validationResult.error.issues[0]

        throw new LogProgressMutationError(
            'invalid-entry',
            firstIssue?.message ?? 'The progress entry is invalid.'
        )
    }

    const metadata = normalizeReadingEntryMetadata(input.formValues)
    const notes = normalizeOptionalString(input.formValues.notes)
    const activityDate = toStoredActivityDate(input.formValues.activityDate)
    const entryValue =
        input.formValues.type === 'CHALLENGE_COMPLETION'
            ? 1
            : Number.parseInt(input.formValues.value, 10)

    const readingEntry = await transaction.readingEntry.create({
        data: {
            activityDate,
            bookAuthor:
                input.formValues.type === 'CHALLENGE_COMPLETION'
                    ? null
                    : metadata.bookAuthor,
            bookTitle:
                input.formValues.type === 'CHALLENGE_COMPLETION'
                    ? null
                    : metadata.bookTitle,
            createdByUserId: input.actorUserId,
            notes,
            campaignParticipantId: participant.id,
            type: input.formValues.type,
            updatedByUserId: input.actorUserId,
            value: entryValue,
        },
        select: {
            id: true,
        },
    })

    await transaction.auditLog.create({
        data: {
            action: 'reading-entry.created',
            actorUserId: input.actorUserId,
            entityId: readingEntry.id,
            entityType: 'ReadingEntry',
            metadata: {
                activityDate: input.formValues.activityDate,
                bookAuthor: metadata.bookAuthor,
                bookTitle: metadata.bookTitle,
                hasNotes: notes != null,
                type: input.formValues.type,
                value: entryValue,
            },
            campaignId: participant.campaign.id,
            campaignParticipantId: participant.id,
            readingEntryId: readingEntry.id,
        },
    })

    let challengeCompletionId: string | null = null

    if (input.formValues.type === 'CHALLENGE_COMPLETION') {
        const selectedChallenge = participant.campaign.challenges.find(
            (challenge) => challenge.id === input.formValues.challengeId
        )

        if (!selectedChallenge) {
            throw new LogProgressMutationError(
                'campaign-challenge-not-found',
                'Choose an active campaign challenge for this completion.'
            )
        }

        const existingCompletions =
            await transaction.challengeCompletion.findMany({
                select: {
                    reviewState: true,
                },
                where: {
                    challengeId: selectedChallenge.id,
                    campaignParticipantId: participant.id,
                    readingEntry: {
                        deletedAt: null,
                    },
                },
            })

        assertChallengeCompletionAllowed({
            existingReviewStates: existingCompletions.map(
                (completion) => completion.reviewState
            ),
        })

        const autoApprovedValues = prepareAutoApprovedChallengeCompletionValues(
            {
                awardedPoints: resolveChallengeCompletionDefaultPoints({
                    challengePointValue:
                        resolveChallengePointValue(selectedChallenge),
                }),
                now: input.now,
            }
        )

        const challengeCompletion =
            await transaction.challengeCompletion.create({
                data: {
                    ...autoApprovedValues,
                    challengeId: selectedChallenge.id,
                    evidenceText: notes,
                    campaignParticipantId: participant.id,
                    readingEntryId: readingEntry.id,
                },
                select: {
                    id: true,
                },
            })

        challengeCompletionId = challengeCompletion.id

        await transaction.auditLog.create({
            data: {
                action: 'challenge-completion.submitted',
                actorUserId: input.actorUserId,
                challengeCompletionId,
                challengeId: selectedChallenge.id,
                entityId: challengeCompletion.id,
                entityType: 'ChallengeCompletion',
                metadata: {
                    awardedPoints: autoApprovedValues.awardedPoints.toString(),
                    challengeTitle: selectedChallenge.title,
                    reviewState: autoApprovedValues.reviewState,
                    value: 1,
                },
                campaignId: participant.campaign.id,
                campaignParticipantId: participant.id,
                readingEntryId: readingEntry.id,
            },
        })
    }

    const totals = await recalculateParticipantTotals(transaction, participant)

    return {
        challengeCompletionId,
        campaignId: participant.campaign.id,
        campaignParticipantId: participant.id,
        readingEntryId: readingEntry.id,
        totals,
    }
}

export async function updateReadingEntryAsAdmin(
    transaction: LogProgressTransaction,
    input: AdminUpdateReadingEntryInput
): Promise<AdminUpdateReadingEntryResult> {
    const readingEntry = await transaction.readingEntry.findUnique({
        select: {
            activityDate: true,
            bookAuthor: true,
            bookTitle: true,
            createdAt: true,
            deletedAt: true,
            id: true,
            notes: true,
            campaignParticipant: {
                select: {
                    id: true,
                    removedAt: true,
                    userId: true,
                    campaign: {
                        select: {
                            entryDeleteWindowMinutes: true,
                            entryEditWindowMinutes: true,
                            endAt: true,
                            id: true,
                            pointsPerAudiobookMinute: true,
                            pointsPerBook: true,
                            pointsPerPage: true,
                            challenges: {
                                select: {
                                    id: true,
                                    kind: true,
                                    pageMinuteMultiplier: true,
                                    pointValue: true,
                                    templateChallenge: {
                                        select: {
                                            pageMinuteMultiplier: true,
                                            pointValue: true,
                                        },
                                    },
                                    title: true,
                                },
                                where: {
                                    isActive: true,
                                    kind: {
                                        in: [
                                            'ADMIN',
                                            'PERSONAL_GOAL_INSTANCE',
                                            'RECOMMENDATION_INSTANCE',
                                        ],
                                    },
                                },
                            },
                            startAt: true,
                            timezone: true,
                        },
                    },
                },
            },
            type: true,
            value: true,
        },
        where: {
            id: input.readingEntryId,
        },
    })

    if (!readingEntry || readingEntry.deletedAt) {
        throw new LogProgressMutationError(
            'reading-entry-not-found',
            'The selected reading entry is no longer available for moderation.'
        )
    }

    if (readingEntry.campaignParticipant.removedAt) {
        throw new LogProgressMutationError(
            'participant-removed',
            'This campaign profile is no longer active.'
        )
    }

    if (
        readingEntry.type === 'CHALLENGE_COMPLETION' ||
        input.formValues.type === 'CHALLENGE_COMPLETION'
    ) {
        throw new LogProgressMutationError(
            'challenge-entry-admin-edit-unsupported',
            'Challenge completion entries should be corrected from the challenge review tools.'
        )
    }

    const participant = readingEntry.campaignParticipant
    const validationResult = validateLogProgressFormValues(input.formValues, {
        availableChallengeIds: participant.campaign.challenges.map(
            (challenge) => challenge.id
        ),
        campaignPolicy: toCampaignPolicy(participant.campaign),
    })

    if (!validationResult.success) {
        const firstIssue = validationResult.error.issues[0]

        throw new LogProgressMutationError(
            'invalid-entry',
            firstIssue?.message ?? 'The progress entry is invalid.'
        )
    }

    const metadata = normalizeReadingEntryMetadata(input.formValues)
    const notes = normalizeOptionalString(input.formValues.notes)
    const activityDate = toStoredActivityDate(input.formValues.activityDate)
    const entryValue = Number.parseInt(input.formValues.value, 10)

    await transaction.readingEntry.update({
        data: {
            activityDate,
            bookAuthor: metadata.bookAuthor,
            bookTitle: metadata.bookTitle,
            notes,
            type: input.formValues.type,
            updatedByUserId: input.actorUserId,
            value: entryValue,
        },
        where: {
            id: readingEntry.id,
        },
    })

    await transaction.auditLog.create({
        data: {
            action: 'reading-entry.admin-updated',
            actorUserId: input.actorUserId,
            entityId: readingEntry.id,
            entityType: 'ReadingEntry',
            metadata: {
                previousEntry: {
                    activityDate: readingEntry.activityDate.toISOString(),
                    bookAuthor: readingEntry.bookAuthor,
                    bookTitle: readingEntry.bookTitle,
                    hasNotes: readingEntry.notes != null,
                    type: readingEntry.type,
                    value: readingEntry.value,
                },
                updatedEntry: {
                    activityDate: input.formValues.activityDate,
                    bookAuthor: metadata.bookAuthor,
                    bookTitle: metadata.bookTitle,
                    hasNotes: notes != null,
                    type: input.formValues.type,
                    value: entryValue,
                },
            },
            campaignId: participant.campaign.id,
            campaignParticipantId: participant.id,
            readingEntryId: readingEntry.id,
        },
    })

    const totals = await recalculateParticipantTotals(transaction, participant)

    return {
        campaignId: participant.campaign.id,
        campaignParticipantId: participant.id,
        readingEntryId: readingEntry.id,
        totals,
    }
}

export function resolveLogProgressMutationErrorCode(error: unknown) {
    if (error instanceof ChallengeReviewError) {
        return error.code
    }

    if (error instanceof LogProgressMutationError) {
        return error.code
    }

    return 'unexpected-error'
}

async function recalculateParticipantTotals(
    transaction: LogProgressTransaction,
    participant: ParticipantSnapshot
) {
    const persistedEntries = await transaction.readingEntry.findMany({
        orderBy: {
            activityDate: 'asc',
        },
        select: {
            activityDate: true,
            challengeCompletion: {
                select: {
                    awardedPoints: true,
                    reviewState: true,
                },
            },
            type: true,
            value: true,
        },
        where: {
            deletedAt: null,
            campaignParticipantId: participant.id,
        },
    })

    const totals = calculateParticipantScoreTotals(
        toScoringEntries(persistedEntries),
        toCampaignScoringRules(participant.campaign)
    )

    await transaction.campaignParticipant.update({
        data: {
            lastActivityAt: totals.lastActivityAt,
            totalAudiobookMinutes: totals.totalAudiobookMinutes,
            totalBooks: totals.totalBooks,
            totalChallenges: totals.totalChallenges,
            totalPages: totals.totalPages,
            totalPoints: totals.totalPoints,
        },
        where: {
            id: participant.id,
        },
    })

    return totals
}

function toCampaignPolicy(
    campaign: ParticipantSnapshot['campaign']
): LogProgressCampaignPolicy {
    return {
        entryDeleteWindowMinutes: campaign.entryDeleteWindowMinutes,
        entryEditWindowMinutes: campaign.entryEditWindowMinutes,
        campaignEndAt: campaign.endAt.toISOString(),
        campaignStartAt: campaign.startAt.toISOString(),
        timezone: campaign.timezone,
    }
}

function toCampaignScoringRules(
    campaign: ParticipantSnapshot['campaign']
): CampaignScoringRules {
    return {
        pointsPerAudiobookMinute: campaign.pointsPerAudiobookMinute.toString(),
        pointsPerBook: campaign.pointsPerBook.toString(),
        pointsPerChallengeCompletion: '0',
        pointsPerPage: campaign.pointsPerPage.toString(),
    }
}

function toScoringEntries(entries: PersistedReadingEntry[]): ScoringEntry[] {
    return entries.flatMap<ScoringEntry>((entry) => {
        if (entry.type !== 'CHALLENGE_COMPLETION') {
            return [
                {
                    activityDate: entry.activityDate,
                    type: entry.type,
                    value: entry.value,
                },
            ]
        }

        const reviewState = entry.challengeCompletion?.reviewState

        if (reviewState !== 'APPROVED' && reviewState !== 'AUTO_APPROVED') {
            return []
        }

        return [
            {
                activityDate: entry.activityDate,
                awardedPoints:
                    entry.challengeCompletion?.awardedPoints?.toString() ??
                    null,
                type: entry.type,
                value: entry.value,
            },
        ]
    })
}

function normalizeOptionalString(value: string) {
    const trimmedValue = value.trim()

    return trimmedValue.length > 0 ? trimmedValue : null
}

function toStoredActivityDate(value: string) {
    const storedDate = new Date(`${value}T12:00:00.000Z`)

    if (Number.isNaN(storedDate.getTime())) {
        throw new LogProgressMutationError(
            'invalid-activity-date',
            'Use a valid activity date for this entry.'
        )
    }

    return storedDate
}
