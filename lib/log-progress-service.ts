import type {
    ChallengeAvailability,
    ChallengeReviewState,
    ReadingEntryType,
} from '@prisma/client'

import {
    assertChallengeCompletionAllowed,
    ChallengeReviewError,
    prepareAutoApprovedChallengeCompletionValues,
    resolveChallengeCompletionDefaultPoints,
} from '@/lib/challenge-review'
import {
    normalizeReadingEntryMetadata,
    type LogProgressFormValues,
    type LogProgressQuestPolicy,
    validateLogProgressFormValues,
} from '@/lib/log-progress'
import {
    calculateParticipantScoreTotals,
    type ParticipantScoreTotals,
    type QuestScoringRules,
    type ScoringEntry,
} from '@/lib/quest-domain'

type ParticipantSnapshot = {
    id: string
    removedAt: Date | null
    userId: string
    quest: {
        entryDeleteWindowMinutes: number | null
        entryEditWindowMinutes: number | null
        endAt: Date
        id: string
        pointsPerAudiobookMinute: { toString(): string }
        pointsPerBook: { toString(): string }
        pointsPerChallengeCompletion: { toString(): string }
        pointsPerPage: { toString(): string }
        questChallenges: Array<{
            challenge: {
                availability: ChallengeAvailability
                pointValue: { toString(): string } | null
                requiresReview: boolean
                title: string
            }
            challengeId: string
            id: string
            pointValueOverride: { toString(): string } | null
        }>
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
                metadata: Record<string, unknown>
                questId: string
                questParticipantId: string
                readingEntryId?: string
            }
        }) => Promise<unknown>
    }
    challengeCompletion: {
        create: (args: {
            data: {
                awardedPoints?: { toString(): string } | number | string
                challengeId: string
                evidenceText: string | null
                questChallengeId: string
                questParticipantId: string
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
                questParticipantId: string
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
    questParticipant: {
        findUnique: (args: {
            select: {
                id: true
                removedAt: true
                userId: true
                quest: {
                    select: {
                        entryDeleteWindowMinutes: true
                        entryEditWindowMinutes: true
                        endAt: true
                        id: true
                        pointsPerAudiobookMinute: true
                        pointsPerBook: true
                        pointsPerChallengeCompletion: true
                        pointsPerPage: true
                        questChallenges: {
                            where: {
                                isActive: true
                            }
                            select: {
                                challenge: {
                                    select: {
                                        availability: true
                                        pointValue: true
                                        requiresReview: true
                                        title: true
                                    }
                                }
                                challengeId: true
                                id: true
                                pointValueOverride: true
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
                totalPoints: { toString(): string } | number | string
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
                questParticipantId: string
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
                questParticipantId: string
            }
        }) => Promise<PersistedReadingEntry[]>
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
    questParticipantId: string
}

export type RecordLogProgressResult = {
    challengeCompletionId: string | null
    questId: string
    questParticipantId: string
    readingEntryId: string
    totals: ParticipantScoreTotals
}

export async function recordLogProgressEntry(
    transaction: LogProgressTransaction,
    input: RecordLogProgressInput
): Promise<RecordLogProgressResult> {
    const participant = await transaction.questParticipant.findUnique({
        select: {
            id: true,
            removedAt: true,
            userId: true,
            quest: {
                select: {
                    entryDeleteWindowMinutes: true,
                    entryEditWindowMinutes: true,
                    endAt: true,
                    id: true,
                    pointsPerAudiobookMinute: true,
                    pointsPerBook: true,
                    pointsPerChallengeCompletion: true,
                    pointsPerPage: true,
                    questChallenges: {
                        select: {
                            challenge: {
                                select: {
                                    availability: true,
                                    pointValue: true,
                                    requiresReview: true,
                                    title: true,
                                },
                            },
                            challengeId: true,
                            id: true,
                            pointValueOverride: true,
                        },
                        where: {
                            isActive: true,
                        },
                    },
                    startAt: true,
                    timezone: true,
                },
            },
        },
        where: {
            id: input.questParticipantId,
        },
    })

    if (!participant) {
        throw new LogProgressMutationError(
            'participant-not-found',
            'The selected quest participant record is no longer available.'
        )
    }

    if (participant.userId !== input.actorUserId) {
        throw new LogProgressMutationError(
            'participant-access-denied',
            'You can only log progress for your own quest profile.'
        )
    }

    if (participant.removedAt) {
        throw new LogProgressMutationError(
            'participant-removed',
            'This quest profile is no longer active.'
        )
    }

    const validationResult = validateLogProgressFormValues(input.formValues, {
        availableChallengeIds: participant.quest.questChallenges.map(
            (challenge) => challenge.id
        ),
        questPolicy: toQuestPolicy(participant.quest),
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
            questParticipantId: participant.id,
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
            questId: participant.quest.id,
            questParticipantId: participant.id,
            readingEntryId: readingEntry.id,
        },
    })

    let challengeCompletionId: string | null = null

    if (input.formValues.type === 'CHALLENGE_COMPLETION') {
        const selectedQuestChallenge = participant.quest.questChallenges.find(
            (challenge) => challenge.id === input.formValues.challengeId
        )

        if (!selectedQuestChallenge) {
            throw new LogProgressMutationError(
                'quest-challenge-not-found',
                'Choose an active quest challenge for this completion.'
            )
        }

        const existingCompletions =
            await transaction.challengeCompletion.findMany({
                select: {
                    reviewState: true,
                },
                where: {
                    challengeId: selectedQuestChallenge.challengeId,
                    questParticipantId: participant.id,
                    readingEntry: {
                        deletedAt: null,
                    },
                },
            })

        assertChallengeCompletionAllowed({
            availability: selectedQuestChallenge.challenge.availability,
            existingReviewStates: existingCompletions.map(
                (completion) => completion.reviewState
            ),
        })

        if (selectedQuestChallenge.challenge.requiresReview) {
            const challengeCompletion =
                await transaction.challengeCompletion.create({
                    data: {
                        challengeId: selectedQuestChallenge.challengeId,
                        evidenceText: notes,
                        questChallengeId: selectedQuestChallenge.id,
                        questParticipantId: participant.id,
                        readingEntryId: readingEntry.id,
                        reviewState: 'PENDING',
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
                    challengeId: selectedQuestChallenge.challengeId,
                    entityId: challengeCompletion.id,
                    entityType: 'ChallengeCompletion',
                    metadata: {
                        challengeTitle: selectedQuestChallenge.challenge.title,
                        reviewState: 'PENDING',
                        value: 1,
                    },
                    questId: participant.quest.id,
                    questParticipantId: participant.id,
                    readingEntryId: readingEntry.id,
                },
            })
        } else {
            const autoApprovedValues =
                prepareAutoApprovedChallengeCompletionValues({
                    awardedPoints: resolveChallengeCompletionDefaultPoints({
                        challengePointValue:
                            selectedQuestChallenge.challenge.pointValue?.toString() ??
                            null,
                        questChallengePointValueOverride:
                            selectedQuestChallenge.pointValueOverride?.toString() ??
                            null,
                        questPointsPerChallengeCompletion:
                            participant.quest.pointsPerChallengeCompletion.toString(),
                    }),
                    now: input.now,
                })

            const challengeCompletion =
                await transaction.challengeCompletion.create({
                    data: {
                        ...autoApprovedValues,
                        challengeId: selectedQuestChallenge.challengeId,
                        evidenceText: notes,
                        questChallengeId: selectedQuestChallenge.id,
                        questParticipantId: participant.id,
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
                    challengeId: selectedQuestChallenge.challengeId,
                    entityId: challengeCompletion.id,
                    entityType: 'ChallengeCompletion',
                    metadata: {
                        awardedPoints:
                            autoApprovedValues.awardedPoints.toString(),
                        challengeTitle: selectedQuestChallenge.challenge.title,
                        reviewState: autoApprovedValues.reviewState,
                        value: 1,
                    },
                    questId: participant.quest.id,
                    questParticipantId: participant.id,
                    readingEntryId: readingEntry.id,
                },
            })
        }
    }

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
            questParticipantId: participant.id,
        },
    })

    const totals = calculateParticipantScoreTotals(
        toScoringEntries(persistedEntries),
        toQuestScoringRules(participant.quest)
    )

    await transaction.questParticipant.update({
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

    return {
        challengeCompletionId,
        questId: participant.quest.id,
        questParticipantId: participant.id,
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

function toQuestPolicy(
    quest: ParticipantSnapshot['quest']
): LogProgressQuestPolicy {
    return {
        entryDeleteWindowMinutes: quest.entryDeleteWindowMinutes,
        entryEditWindowMinutes: quest.entryEditWindowMinutes,
        questEndAt: quest.endAt.toISOString(),
        questStartAt: quest.startAt.toISOString(),
        timezone: quest.timezone,
    }
}

function toQuestScoringRules(
    quest: ParticipantSnapshot['quest']
): QuestScoringRules {
    return {
        pointsPerAudiobookMinute: quest.pointsPerAudiobookMinute.toString(),
        pointsPerBook: quest.pointsPerBook.toString(),
        pointsPerChallengeCompletion:
            quest.pointsPerChallengeCompletion.toString(),
        pointsPerPage: quest.pointsPerPage.toString(),
    }
}

function toScoringEntries(entries: PersistedReadingEntry[]): ScoringEntry[] {
    return entries.flatMap((entry) => {
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
