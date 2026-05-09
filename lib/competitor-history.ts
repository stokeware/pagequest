import type { ChallengeReviewState, ReadingEntryType } from '@prisma/client'
import { cache } from 'react'

import {
    getCompetitorHistoryCampaignRecords,
    getParticipantReadingEntries,
    type CompetitorHistoryCampaignRecord,
    type CompetitorHistoryCampaignStatus,
} from '@/lib/competitor-queries'
import { getReadingEntryMetadataSummary } from '@/lib/log-progress'
import {
    calculateEntryPoints,
    type CampaignScoringRules,
} from '@/lib/campaign-domain'

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

type HistoryCampaignCard = {
    href: string
    isSelected: boolean
    lastActivityLabel: string
    participantId: string
    campaignName: string
    campaignStatusLabel: string
    totalsLabel: string
}

type CompetitorHistoryInput = {
    participants: Array<
        CompetitorHistoryCampaignRecord & {
            readingEntries: CompetitorHistoryEntryRecord[]
        }
    >
    selectedParticipantId: string | null
}

export type CompetitorHistoryViewModel = {
    currentCampaignCard: HistoryCampaignCard | null
    hasCampaignHistory: boolean
    pastCampaignCards: HistoryCampaignCard[]
    selectedCampaignMetrics: HistoryMetric[]
    selectedCampaignName: string
    selectedCampaignParticipantId: string | null
    selectedCampaignStatusLabel: string
    selectedCampaignSummary: string
    timelineEntries: CompetitorHistoryItem[]
}

export const defaultCompetitorHistoryViewModel: CompetitorHistoryViewModel = {
    currentCampaignCard: null,
    hasCampaignHistory: false,
    pastCampaignCards: [],
    selectedCampaignMetrics: [],
    selectedCampaignName: 'Campaign assignment pending',
    selectedCampaignParticipantId: null,
    selectedCampaignStatusLabel: 'Awaiting invitation',
    selectedCampaignSummary:
        'No campaign history is linked to this account yet. Your reading timeline will appear here once you join a campaign.',
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

        const participants = await getCompetitorHistoryCampaignRecords(userId)

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
            getCampaignStatusPriority(left.campaign.status) -
            getCampaignStatusPriority(right.campaign.status)

        if (statusDifference !== 0) {
            return statusDifference
        }

        const endAtDifference =
            right.campaign.endAt.getTime() - left.campaign.endAt.getTime()

        if (endAtDifference !== 0) {
            return endAtDifference
        }

        return right.createdAt.getTime() - left.createdAt.getTime()
    })

    const currentParticipant =
        sortedParticipants.find(
            (participant) => participant.campaign.status === 'ACTIVE'
        ) ??
        sortedParticipants.find(
            (participant) => participant.campaign.status === 'SCHEDULED'
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
        timezone: selectedParticipant.campaign.timezone,
    })
    const pastCampaignCards = sortedParticipants
        .filter((participant) =>
            isPastCampaignStatus(participant.campaign.status)
        )
        .map((participant) =>
            createHistoryCampaignCard({
                isSelected: participant.id === selectedParticipant.id,
                participant,
            })
        )

    return {
        currentCampaignCard:
            currentParticipant &&
            currentParticipant.id !== selectedParticipant.id
                ? createHistoryCampaignCard({
                      isSelected: false,
                      participant: currentParticipant,
                  })
                : null,
        hasCampaignHistory: true,
        pastCampaignCards,
        selectedCampaignMetrics: [
            {
                detail: 'Entries recorded for this campaign.',
                label: 'Entries logged',
                value: formatCount(timelineEntries.length),
            },
            {
                detail: 'Total points earned in this campaign.',
                label: 'Points',
                value: formatPoints(selectedParticipant.totalPoints),
            },
            {
                detail: 'Combined reading, listening, and challenge totals.',
                label: 'Raw totals',
                value: getCampaignTotalsLabel(selectedParticipant),
            },
            {
                detail:
                    selectedParticipant.lastActivityAt == null
                        ? 'No activity is logged yet for this campaign.'
                        : 'Most recent activity captured for this campaign.',
                label: 'Last activity',
                value:
                    selectedParticipant.lastActivityAt == null
                        ? 'No activity yet'
                        : formatCalendarDate(
                              selectedParticipant.lastActivityAt,
                              selectedParticipant.campaign.timezone
                          ),
            },
        ],
        selectedCampaignName: selectedParticipant.campaign.name,
        selectedCampaignParticipantId: selectedParticipant.id,
        selectedCampaignStatusLabel: getCampaignStatusLabel(
            selectedParticipant.campaign.status
        ),
        selectedCampaignSummary:
            timelineEntries.length > 0
                ? `You have ${formatCount(timelineEntries.length)} ${pluralize('entry', timelineEntries.length)} recorded for ${selectedParticipant.campaign.name}.`
                : `You have not logged any reading for ${selectedParticipant.campaign.name} yet.`,
        timelineEntries,
    }
}

export function formatCompetitorHistoryEntries({
    entries,
    scoringRules,
    timezone,
}: {
    entries: CompetitorHistoryEntryRecord[]
    scoringRules: CampaignScoringRules
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
    scoringRules: CampaignScoringRules
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

function createHistoryCampaignCard({
    isSelected,
    participant,
}: {
    isSelected: boolean
    participant: CompetitorHistoryCampaignRecord
}): HistoryCampaignCard {
    return {
        href: `/history?campaign=${encodeURIComponent(participant.id)}`,
        isSelected,
        lastActivityLabel:
            participant.lastActivityAt == null
                ? 'No activity yet'
                : `Last activity ${formatCalendarDate(participant.lastActivityAt, participant.campaign.timezone)}`,
        participantId: participant.id,
        campaignName: participant.campaign.name,
        campaignStatusLabel: getCampaignStatusLabel(
            participant.campaign.status
        ),
        totalsLabel: getCampaignTotalsLabel(participant),
    }
}

function selectHistoryParticipant(
    participants: CompetitorHistoryCampaignRecord[]
) {
    const sortedParticipants = [...participants].sort((left, right) => {
        const statusDifference =
            getCampaignStatusPriority(left.campaign.status) -
            getCampaignStatusPriority(right.campaign.status)

        if (statusDifference !== 0) {
            return statusDifference
        }

        const endAtDifference =
            right.campaign.endAt.getTime() - left.campaign.endAt.getTime()

        if (endAtDifference !== 0) {
            return endAtDifference
        }

        return right.createdAt.getTime() - left.createdAt.getTime()
    })

    return (
        sortedParticipants.find(
            (participant) => participant.campaign.status === 'ACTIVE'
        ) ??
        sortedParticipants.find(
            (participant) => participant.campaign.status === 'SCHEDULED'
        ) ??
        sortedParticipants[0] ??
        null
    )
}

function getChallengePointsLabel(
    entry: CompetitorHistoryEntryRecord,
    scoringRules: CampaignScoringRules
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

function getCampaignStatusLabel(status: CompetitorHistoryCampaignStatus) {
    switch (status) {
        case 'ACTIVE':
            return 'Active campaign'
        case 'SCHEDULED':
            return 'Upcoming campaign'
        case 'COMPLETED':
            return 'Completed campaign'
        case 'ARCHIVED':
            return 'Archived campaign'
        default:
            return assertNever(status)
    }
}

function getCampaignStatusPriority(status: CompetitorHistoryCampaignStatus) {
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

function getCampaignTotalsLabel(participant: {
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

function isPastCampaignStatus(status: CompetitorHistoryCampaignStatus) {
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
