import type { ChallengeReviewState, ReadingEntryType } from '@prisma/client'
import { cache } from 'react'

import {
    getCompetitorHistoryQuestRecords,
    getParticipantReadingEntries,
    type CompetitorHistoryQuestRecord,
    type CompetitorHistoryQuestStatus,
} from '@/lib/competitor-queries'
import { getReadingEntryMetadataSummary } from '@/lib/log-progress'
import {
    calculateEntryPoints,
    type QuestScoringRules,
} from '@/lib/quest-domain'

export type CompetitorHistoryEntryRecord = {
    activityDate: Date
    bookAuthor: string | null
    bookTitle: string | null
    challengeCompletion: {
        awardedPoints: { toString(): string } | null
        challenge: {
            title: string
        }
        evidenceText: string | null
        reviewState: ChallengeReviewState
    } | null
    id: string
    notes: string | null
    type: ReadingEntryType
    value: number
}

export type CompetitorHistoryItem = {
    description: string
    id: string
    note: string | null
    pointsLabel: string
    statusLabel: string | null
    title: string
}

type HistoryMetric = {
    detail: string
    label: string
    value: string
}

type HistoryQuestCard = {
    href: string
    isSelected: boolean
    lastActivityLabel: string
    participantId: string
    questName: string
    questStatusLabel: string
    totalsLabel: string
}

type CompetitorHistoryInput = {
    participants: Array<
        CompetitorHistoryQuestRecord & {
            readingEntries: CompetitorHistoryEntryRecord[]
        }
    >
    selectedParticipantId: string | null
}

export type CompetitorHistoryViewModel = {
    currentQuestCard: HistoryQuestCard | null
    hasQuestHistory: boolean
    pastQuestCards: HistoryQuestCard[]
    selectedQuestMetrics: HistoryMetric[]
    selectedQuestName: string
    selectedQuestParticipantId: string | null
    selectedQuestStatusLabel: string
    selectedQuestSummary: string
    timelineEntries: CompetitorHistoryItem[]
}

export const defaultCompetitorHistoryViewModel: CompetitorHistoryViewModel = {
    currentQuestCard: null,
    hasQuestHistory: false,
    pastQuestCards: [],
    selectedQuestMetrics: [],
    selectedQuestName: 'Quest assignment pending',
    selectedQuestParticipantId: null,
    selectedQuestStatusLabel: 'Awaiting invitation',
    selectedQuestSummary:
        'No quest history is linked to this account yet. Your reading timeline will appear here once you join a quest.',
    timelineEntries: [],
}

export const getCompetitorHistoryViewModel = cache(
    async (
        userId: string | null,
        selectedParticipantId: string | null
    ): Promise<CompetitorHistoryViewModel> => {
        if (!userId) {
            return defaultCompetitorHistoryViewModel
        }

        const participants = await getCompetitorHistoryQuestRecords(userId)

        if (participants.length === 0) {
            return defaultCompetitorHistoryViewModel
        }

        const selectedParticipant =
            participants.find(
                (participant) => participant.id === selectedParticipantId
            ) ?? selectHistoryParticipant(participants)

        const selectedEntries = selectedParticipant
            ? await getParticipantReadingEntries(selectedParticipant.id)
            : []

        return buildCompetitorHistoryViewModel({
            participants: participants.map((participant) => ({
                ...participant,
                readingEntries:
                    participant.id === selectedParticipant?.id
                        ? selectedEntries
                        : [],
            })),
            selectedParticipantId,
        })
    }
)

export function buildCompetitorHistoryViewModel(
    input: CompetitorHistoryInput | null
): CompetitorHistoryViewModel {
    if (!input || input.participants.length === 0) {
        return defaultCompetitorHistoryViewModel
    }

    const sortedParticipants = [...input.participants].sort((left, right) => {
        const statusDifference =
            getQuestStatusPriority(left.quest.status) -
            getQuestStatusPriority(right.quest.status)

        if (statusDifference !== 0) {
            return statusDifference
        }

        const endAtDifference =
            right.quest.endAt.getTime() - left.quest.endAt.getTime()

        if (endAtDifference !== 0) {
            return endAtDifference
        }

        return right.createdAt.getTime() - left.createdAt.getTime()
    })

    const currentParticipant =
        sortedParticipants.find(
            (participant) => participant.quest.status === 'ACTIVE'
        ) ??
        sortedParticipants.find(
            (participant) => participant.quest.status === 'SCHEDULED'
        ) ??
        null

    const selectedParticipant =
        sortedParticipants.find(
            (participant) => participant.id === input.selectedParticipantId
        ) ??
        currentParticipant ??
        sortedParticipants[0] ??
        null

    if (!selectedParticipant) {
        return defaultCompetitorHistoryViewModel
    }

    const timelineEntries = formatCompetitorHistoryEntries({
        entries: selectedParticipant.readingEntries,
        scoringRules: selectedParticipant.scoringRules,
        timezone: selectedParticipant.quest.timezone,
    })
    const pastQuestCards = sortedParticipants
        .filter((participant) => isPastQuestStatus(participant.quest.status))
        .map((participant) =>
            createHistoryQuestCard({
                isSelected: participant.id === selectedParticipant.id,
                participant,
            })
        )

    return {
        currentQuestCard:
            currentParticipant &&
            currentParticipant.id !== selectedParticipant.id
                ? createHistoryQuestCard({
                      isSelected: false,
                      participant: currentParticipant,
                  })
                : null,
        hasQuestHistory: true,
        pastQuestCards,
        selectedQuestMetrics: [
            {
                detail: 'Entries recorded for this quest.',
                label: 'Entries logged',
                value: formatCount(timelineEntries.length),
            },
            {
                detail: 'Total points earned in this quest.',
                label: 'Points',
                value: formatPoints(selectedParticipant.totalPoints),
            },
            {
                detail: 'Combined reading, listening, and challenge totals.',
                label: 'Raw totals',
                value: getQuestTotalsLabel(selectedParticipant),
            },
            {
                detail:
                    selectedParticipant.lastActivityAt == null
                        ? 'No activity is logged yet for this quest.'
                        : 'Most recent activity captured for this quest.',
                label: 'Last activity',
                value:
                    selectedParticipant.lastActivityAt == null
                        ? 'No activity yet'
                        : formatCalendarDate(
                              selectedParticipant.lastActivityAt,
                              selectedParticipant.quest.timezone
                          ),
            },
        ],
        selectedQuestName: selectedParticipant.quest.name,
        selectedQuestParticipantId: selectedParticipant.id,
        selectedQuestStatusLabel: getQuestStatusLabel(
            selectedParticipant.quest.status
        ),
        selectedQuestSummary:
            timelineEntries.length > 0
                ? `You have ${formatCount(timelineEntries.length)} ${pluralize('entry', timelineEntries.length)} recorded for ${selectedParticipant.quest.name}.`
                : `You have not logged any reading for ${selectedParticipant.quest.name} yet.`,
        timelineEntries,
    }
}

export function formatCompetitorHistoryEntries({
    entries,
    scoringRules,
    timezone,
}: {
    entries: CompetitorHistoryEntryRecord[]
    scoringRules: QuestScoringRules
    timezone: string
}) {
    return entries.map((entry) =>
        formatCompetitorHistoryEntry({
            entry,
            scoringRules,
            timezone,
        })
    )
}

function formatCompetitorHistoryEntry({
    entry,
    scoringRules,
    timezone,
}: {
    entry: CompetitorHistoryEntryRecord
    scoringRules: QuestScoringRules
    timezone: string
}): CompetitorHistoryItem {
    const metadataSummary = getReadingEntryMetadataSummary({
        bookAuthor: entry.bookAuthor,
        bookTitle: entry.bookTitle,
    })
    const activityDateLabel = formatCalendarDate(entry.activityDate, timezone)

    switch (entry.type) {
        case 'BOOK_COMPLETION':
            return {
                description: buildHistoryDescription({
                    activityDateLabel,
                    metadataSummary,
                }),
                id: entry.id,
                note: entry.notes,
                pointsLabel: formatPoints(
                    calculateEntryPoints(
                        {
                            activityDate: entry.activityDate,
                            type: entry.type,
                            value: entry.value,
                        },
                        scoringRules
                    )
                ),
                statusLabel: null,
                title: `Book completion · ${formatCount(entry.value)} ${pluralize('book', entry.value)}`,
            }
        case 'PAGES_READ':
            return {
                description: buildHistoryDescription({
                    activityDateLabel,
                    metadataSummary,
                }),
                id: entry.id,
                note: entry.notes,
                pointsLabel: formatPoints(
                    calculateEntryPoints(
                        {
                            activityDate: entry.activityDate,
                            type: entry.type,
                            value: entry.value,
                        },
                        scoringRules
                    )
                ),
                statusLabel: null,
                title: `Pages read · ${formatCount(entry.value)} pages`,
            }
        case 'AUDIOBOOK_MINUTES':
            return {
                description: buildHistoryDescription({
                    activityDateLabel,
                    metadataSummary,
                }),
                id: entry.id,
                note: entry.notes,
                pointsLabel: formatPoints(
                    calculateEntryPoints(
                        {
                            activityDate: entry.activityDate,
                            type: entry.type,
                            value: entry.value,
                        },
                        scoringRules
                    )
                ),
                statusLabel: null,
                title: `Audiobook minutes · ${formatCount(entry.value)} minutes`,
            }
        case 'CHALLENGE_COMPLETION':
            return {
                description: buildHistoryDescription({
                    activityDateLabel,
                    metadataSummary:
                        entry.challengeCompletion?.challenge.title ??
                        metadataSummary,
                }),
                id: entry.id,
                note: entry.challengeCompletion?.evidenceText ?? entry.notes,
                pointsLabel: getChallengePointsLabel(entry, scoringRules),
                statusLabel: getChallengeStatusLabel(
                    entry.challengeCompletion?.reviewState
                ),
                title: entry.challengeCompletion?.challenge.title
                    ? `Challenge completion · ${entry.challengeCompletion.challenge.title}`
                    : 'Challenge completion',
            }
        default:
            return assertNever(entry.type)
    }
}

function buildHistoryDescription({
    activityDateLabel,
    metadataSummary,
}: {
    activityDateLabel: string
    metadataSummary: string | null
}) {
    return metadataSummary
        ? `${metadataSummary}. Logged ${activityDateLabel}.`
        : `Logged ${activityDateLabel}.`
}

function createHistoryQuestCard({
    isSelected,
    participant,
}: {
    isSelected: boolean
    participant: CompetitorHistoryQuestRecord
}): HistoryQuestCard {
    return {
        href: `/history?quest=${encodeURIComponent(participant.id)}`,
        isSelected,
        lastActivityLabel:
            participant.lastActivityAt == null
                ? 'No activity yet'
                : `Last activity ${formatCalendarDate(participant.lastActivityAt, participant.quest.timezone)}`,
        participantId: participant.id,
        questName: participant.quest.name,
        questStatusLabel: getQuestStatusLabel(participant.quest.status),
        totalsLabel: getQuestTotalsLabel(participant),
    }
}

function selectHistoryParticipant(
    participants: CompetitorHistoryQuestRecord[]
) {
    const sortedParticipants = [...participants].sort((left, right) => {
        const statusDifference =
            getQuestStatusPriority(left.quest.status) -
            getQuestStatusPriority(right.quest.status)

        if (statusDifference !== 0) {
            return statusDifference
        }

        const endAtDifference =
            right.quest.endAt.getTime() - left.quest.endAt.getTime()

        if (endAtDifference !== 0) {
            return endAtDifference
        }

        return right.createdAt.getTime() - left.createdAt.getTime()
    })

    return (
        sortedParticipants.find(
            (participant) => participant.quest.status === 'ACTIVE'
        ) ??
        sortedParticipants.find(
            (participant) => participant.quest.status === 'SCHEDULED'
        ) ??
        sortedParticipants[0] ??
        null
    )
}

function getChallengePointsLabel(
    entry: CompetitorHistoryEntryRecord,
    scoringRules: QuestScoringRules
) {
    const reviewState = entry.challengeCompletion?.reviewState

    if (reviewState === 'PENDING') {
        return 'Pending review'
    }

    if (reviewState === 'REJECTED') {
        return 'Rejected'
    }

    return formatPoints(
        calculateEntryPoints(
            {
                activityDate: entry.activityDate,
                awardedPoints:
                    entry.challengeCompletion?.awardedPoints?.toString() ??
                    null,
                type: entry.type,
                value: entry.value,
            },
            scoringRules
        )
    )
}

function getChallengeStatusLabel(
    reviewState: ChallengeReviewState | undefined
) {
    switch (reviewState) {
        case 'APPROVED':
            return 'Approved'
        case 'AUTO_APPROVED':
            return 'Auto-approved'
        case 'PENDING':
            return 'Pending review'
        case 'REJECTED':
            return 'Rejected'
        default:
            return null
    }
}

function getQuestStatusLabel(status: CompetitorHistoryQuestStatus) {
    switch (status) {
        case 'ACTIVE':
            return 'Active quest'
        case 'SCHEDULED':
            return 'Upcoming quest'
        case 'COMPLETED':
            return 'Completed quest'
        case 'ARCHIVED':
            return 'Archived quest'
        default:
            return assertNever(status)
    }
}

function getQuestStatusPriority(status: CompetitorHistoryQuestStatus) {
    switch (status) {
        case 'ACTIVE':
            return 0
        case 'SCHEDULED':
            return 1
        case 'COMPLETED':
            return 2
        case 'ARCHIVED':
            return 3
        default:
            return assertNever(status)
    }
}

function getQuestTotalsLabel(participant: {
    totalAudiobookMinutes: number
    totalBooks: number
    totalChallenges: number
    totalPages: number
}) {
    return [
        `${formatCount(participant.totalPages)} pages`,
        `${formatCount(participant.totalAudiobookMinutes)} minutes`,
        `${formatCount(participant.totalBooks)} ${pluralize('book', participant.totalBooks)}`,
        `${formatCount(participant.totalChallenges)} ${pluralize('challenge', participant.totalChallenges)}`,
    ].join(' • ')
}

function isPastQuestStatus(status: CompetitorHistoryQuestStatus) {
    return status === 'COMPLETED' || status === 'ARCHIVED'
}

export function formatCalendarDate(value: Date, timezone: string) {
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeZone: timezone,
    }).format(value)
}

export function formatCount(value: number) {
    return new Intl.NumberFormat('en-US').format(value)
}

export function formatPoints(value: { toString(): string }) {
    return `${new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
    }).format(Number(value.toString()))} points`
}

export function pluralize(label: string, value: number) {
    return value === 1 ? label : `${label}s`
}

function assertNever(value: never): never {
    throw new Error(`Unhandled value: ${String(value)}`)
}
