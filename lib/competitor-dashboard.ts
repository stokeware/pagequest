import type { ChallengeReviewState } from '@prisma/client'
import { cache } from 'react'

import {
    getCompetitorCampaignContext,
    type CompetitorCampaignContext,
    type CompetitorCampaignParticipantRecord,
    type CompetitorCampaignStatus,
    type CompetitorRecentEntryRecord,
} from '@/lib/competitor-queries'
import { getReadingEntryMetadataSummary } from '@/lib/log-progress'

export { getCompetitorCampaignContext } from '@/lib/competitor-queries'
export type {
    CompetitorCampaignContext,
    CompetitorCampaignParticipantRecord,
    CompetitorCampaignStatus,
    CompetitorRecentEntryRecord,
    CompetitorStandingRecord,
} from '@/lib/competitor-queries'

type DashboardSnapshotCard = {
    description: string
    title: string
    value: string
}

type DashboardSummaryMetric = {
    detail: string
    label: string
    value: string
}

type DashboardRecentActivityItem = {
    description: string
    id: string
    title: string
}

type DashboardShellMetric = {
    detail: string
    label: string
    value: string
}

export type CompetitorDashboardViewModel = {
    hasQuest: boolean
    participantSummary: string
    campaignName: string
    campaignStatusLabel: string
    recentActivity: DashboardRecentActivityItem[]
    shellMetrics: DashboardShellMetric[]
    snapshotCards: DashboardSnapshotCard[]
    summaryMetrics: DashboardSummaryMetric[]
}

type StandingComparable = {
    createdAt: Date
    id: string
    totalAudiobookMinutes: number
    totalBooks: number
    totalPages: number
    totalPoints: { toString(): string }
}

const defaultParticipantSummary =
    'No active campaign participation is linked to this account yet. Your dashboard will fill in once an invitation connects you to a campaign.'

const emptyShellMetrics: DashboardShellMetric[] = [
    {
        detail: 'A campaign invite will unlock timing details here.',
        label: 'Active campaign',
        value: 'Pending',
    },
    {
        detail: 'Current rank appears after your first campaign is linked.',
        label: 'Current standing',
        value: 'Unranked',
    },
    {
        detail: 'Recent reading totals will appear after your first entry.',
        label: 'Recent activity',
        value: 'No entries yet',
    },
]

export const defaultCompetitorDashboardViewModel: CompetitorDashboardViewModel =
    {
        hasQuest: false,
        participantSummary: defaultParticipantSummary,
        campaignName: 'Campaign assignment pending',
        campaignStatusLabel: 'Awaiting invitation',
        recentActivity: [],
        shellMetrics: emptyShellMetrics,
        snapshotCards: [],
        summaryMetrics: [],
    }

export const getCompetitorDashboardViewModel = cache(
    async (userId: string | null): Promise<CompetitorDashboardViewModel> => {
        const context = await getCompetitorCampaignContext(userId)

        if (!context) {
            return defaultCompetitorDashboardViewModel
        }

        return buildCompetitorDashboardViewModel(context, new Date())
    }
)

export function buildCompetitorDashboardViewModel(
    selection: CompetitorCampaignContext | null,
    now: Date
): CompetitorDashboardViewModel {
    if (!selection) {
        return defaultCompetitorDashboardViewModel
    }

    const { participant, recentEntries, standings } = selection
    const rankedStandings = rankStandings(standings)
    const recentActivity = recentEntries.map((entry) =>
        toRecentActivityItem(entry, participant.campaign.timezone)
    )
    const participantStanding = rankedStandings.find(
        (entry) => entry.id === participant.id
    )
    const rankNumber = participantStanding?.rankNumber ?? null
    const leader = rankedStandings[0] ?? null
    const participantPoints = toDisplayNumber(participant.totalPoints)
    const leaderPoints = leader ? toDisplayNumber(leader.totalPoints) : 0
    const pointsBehindLeader = Math.max(leaderPoints - participantPoints, 0)
    const snapshotCards: DashboardSnapshotCard[] = [
        {
            description: getRankDescription({
                leaderPoints,
                participantPoints,
                pointsBehindLeader,
                rankNumber,
                readerCount: rankedStandings.length,
            }),
            title: 'Current rank',
            value: rankNumber ? `#${rankNumber}` : 'Unranked',
        },
        getTimeRemainingCard(participant, now),
        {
            description: getPointsDescription(participant),
            title: 'Total points',
            value: formatPoints(participant.totalPoints),
        },
        {
            description:
                recentActivity[0]?.title ??
                'Your next reading entry will show up here.',
            title: 'Recent activity',
            value:
                recentActivity.length > 0
                    ? `${recentActivity.length} recent ${pluralize('entry', recentActivity.length)}`
                    : 'No entries yet',
        },
    ]

    return {
        hasQuest: true,
        participantSummary: getParticipantSummary(participant),
        campaignName: participant.campaign.name,
        campaignStatusLabel: getCampaignStatusLabel(
            participant.campaign.status
        ),
        recentActivity,
        shellMetrics: [
            {
                detail: getShellCampaignDetail(participant, now),
                label: 'Active campaign',
                value: participant.campaign.name,
            },
            {
                detail: snapshotCards[0].description,
                label: 'Current standing',
                value: snapshotCards[0].value,
            },
            {
                detail:
                    recentActivity[0]?.description ??
                    'Add your first reading entry to build momentum.',
                label: 'Recent activity',
                value: recentActivity[0]?.title ?? 'No entries logged yet',
            },
        ],
        snapshotCards,
        summaryMetrics: [
            {
                detail: 'Combined reading, listening, and challenge scoring.',
                label: 'Points earned',
                value: formatPoints(participant.totalPoints),
            },
            {
                detail: 'Page totals logged toward this campaign.',
                label: 'Pages read',
                value: formatCount(participant.totalPages),
            },
            {
                detail: 'Completed books counted so far.',
                label: 'Books finished',
                value: formatCount(participant.totalBooks),
            },
            {
                detail: 'Audiobook minutes included in your score.',
                label: 'Audiobook minutes',
                value: formatCount(participant.totalAudiobookMinutes),
            },
            {
                detail: 'Campaign challenges recorded for this season.',
                label: 'Challenges completed',
                value: formatCount(participant.totalChallenges),
            },
        ],
    }
}

function getParticipantSummary(
    participant: CompetitorCampaignParticipantRecord
) {
    const lastActivity = participant.lastActivityAt
        ? `Last activity ${formatActivityDate(participant.lastActivityAt, participant.campaign.timezone)}.`
        : 'Your first entry will set the pace for this campaign.'

    switch (participant.campaign.status) {
        case 'ACTIVE':
            return `${participant.campaign.name} is live. ${lastActivity}`
        case 'SCHEDULED':
            return `${participant.campaign.name} has not opened yet. Use this dashboard to plan your first push.`
        case 'COMPLETED':
            return `${participant.campaign.name} has wrapped up. ${lastActivity}`
        default:
            return assertNever(participant.campaign.status)
    }
}

function getCampaignStatusLabel(status: CompetitorCampaignStatus) {
    switch (status) {
        case 'ACTIVE':
            return 'Active campaign'
        case 'SCHEDULED':
            return 'Scheduled campaign'
        case 'COMPLETED':
            return 'Completed campaign'
        default:
            return assertNever(status)
    }
}

function getTimeRemainingCard(
    participant: CompetitorCampaignParticipantRecord,
    now: Date
): DashboardSnapshotCard {
    if (participant.campaign.status === 'SCHEDULED') {
        return {
            description: `Campaign starts ${formatBoundaryDate(participant.campaign.startAt, participant.campaign.timezone)}.`,
            title: 'Time until start',
            value: getDurationLabel(participant.campaign.startAt, now),
        }
    }

    if (participant.campaign.status === 'COMPLETED') {
        return {
            description: `Campaign closed ${formatBoundaryDate(participant.campaign.endAt, participant.campaign.timezone)}.`,
            title: 'Campaign status',
            value: 'Completed',
        }
    }

    return {
        description: `Campaign closes ${formatBoundaryDate(participant.campaign.endAt, participant.campaign.timezone)}.`,
        title: 'Time remaining',
        value: getDurationLabel(participant.campaign.endAt, now),
    }
}

function getPointsDescription(
    participant: CompetitorCampaignParticipantRecord
) {
    const parts = [
        `${formatCount(participant.totalPages)} pages`,
        `${formatCount(participant.totalAudiobookMinutes)} audiobook minutes`,
    ]

    if (participant.totalBooks > 0) {
        parts.push(
            `${formatCount(participant.totalBooks)} ${pluralize('book', participant.totalBooks)}`
        )
    }

    if (participant.totalChallenges > 0) {
        parts.push(
            `${formatCount(participant.totalChallenges)} ${pluralize('challenge', participant.totalChallenges)}`
        )
    }

    return parts.join(' • ')
}

function getRankDescription({
    leaderPoints,
    participantPoints,
    pointsBehindLeader,
    rankNumber,
    readerCount,
}: {
    leaderPoints: number
    participantPoints: number
    pointsBehindLeader: number
    rankNumber: number | null
    readerCount: number
}) {
    if (!rankNumber || readerCount === 0) {
        return 'Leaderboard placement appears after this campaign has active participants.'
    }

    if (readerCount === 1) {
        return 'You are the only reader on this board so far.'
    }

    if (rankNumber === 1) {
        return `Leading ${readerCount} readers with ${formatPointsFromNumber(participantPoints)}.`
    }

    if (pointsBehindLeader === 0 && leaderPoints === participantPoints) {
        return `Tied on points with the campaign leader across ${readerCount} readers.`
    }

    return `${formatPointsFromNumber(pointsBehindLeader)} behind first place out of ${readerCount} readers.`
}

function getShellCampaignDetail(
    participant: CompetitorCampaignParticipantRecord,
    now: Date
) {
    switch (participant.campaign.status) {
        case 'ACTIVE':
            return `${getDurationLabel(participant.campaign.endAt, now)} remaining`
        case 'SCHEDULED':
            return `Starts in ${getDurationLabel(participant.campaign.startAt, now).toLowerCase()}`
        case 'COMPLETED':
            return `Ended ${formatBoundaryDate(participant.campaign.endAt, participant.campaign.timezone)}`
        default:
            return assertNever(participant.campaign.status)
    }
}

function toRecentActivityItem(
    entry: CompetitorRecentEntryRecord,
    timezone: string
): DashboardRecentActivityItem {
    const metadataSummary = getReadingEntryMetadataSummary({
        bookAuthor: entry.bookAuthor,
        bookTitle: entry.bookTitle,
    })
    const dateLabel = formatActivityDate(entry.activityDate, timezone)

    switch (entry.type) {
        case 'BOOK_COMPLETION':
            return {
                description: metadataSummary
                    ? `${metadataSummary}. Logged ${dateLabel}.`
                    : `Logged ${dateLabel}.`,
                id: entry.id,
                title: `Finished ${formatCount(entry.value)} ${pluralize('book', entry.value)}`,
            }
        case 'PAGES_READ':
            return {
                description: metadataSummary
                    ? `${metadataSummary}. Logged ${dateLabel}.`
                    : `Logged ${dateLabel}.`,
                id: entry.id,
                title: `Read ${formatCount(entry.value)} pages`,
            }
        case 'AUDIOBOOK_MINUTES':
            return {
                description: metadataSummary
                    ? `${metadataSummary}. Logged ${dateLabel}.`
                    : `Logged ${dateLabel}.`,
                id: entry.id,
                title: `Logged ${formatCount(entry.value)} audiobook minutes`,
            }
        case 'CHALLENGE_COMPLETION':
            return {
                description: `${getChallengeReviewLabel(entry.challengeCompletion?.reviewState)} Logged ${dateLabel}.`,
                id: entry.id,
                title: entry.challengeCompletion?.challenge.title
                    ? `Completed ${entry.challengeCompletion.challenge.title}`
                    : `Logged ${formatCount(entry.value)} ${pluralize('challenge completion', entry.value)}`,
            }
        default:
            return assertNever(entry.type)
    }
}

function getChallengeReviewLabel(
    reviewState: ChallengeReviewState | undefined
) {
    switch (reviewState) {
        case 'APPROVED':
            return 'Approved challenge.'
        case 'AUTO_APPROVED':
            return 'Auto-approved challenge.'
        case 'PENDING':
            return 'Awaiting review.'
        case 'REJECTED':
            return 'Challenge marked rejected.'
        default:
            return 'Challenge logged.'
    }
}

function getDurationLabel(target: Date, now: Date) {
    const diffMilliseconds = target.getTime() - now.getTime()

    if (diffMilliseconds <= 0) {
        return 'Less than 1 day'
    }

    const totalHours = Math.ceil(diffMilliseconds / (1000 * 60 * 60))

    if (totalHours < 24) {
        return `${formatCount(totalHours)} ${pluralize('hour', totalHours)}`
    }

    const totalDays = Math.ceil(totalHours / 24)

    return `${formatCount(totalDays)} ${pluralize('day', totalDays)}`
}

function formatActivityDate(value: Date, timezone: string) {
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeZone: timezone,
    }).format(value)
}

function formatBoundaryDate(value: Date, timezone: string) {
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: timezone,
    }).format(value)
}

function formatCount(value: number) {
    return new Intl.NumberFormat('en-US').format(value)
}

function formatPoints(value: { toString(): string }) {
    return formatPointsFromNumber(toDisplayNumber(value))
}

function formatPointsFromNumber(value: number) {
    return `${new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
    }).format(value)} points`
}

export function rankStandings<T extends StandingComparable>(standings: T[]) {
    return standings.map((standing, index) => ({
        ...standing,
        rankNumber:
            index > 0 && areStandingsTied(standings[index - 1], standing)
                ? standingsRankNumberAt(index - 1, standings)
                : index + 1,
    }))
}

function pluralize(label: string, value: number) {
    return value === 1 ? label : `${label}s`
}

function areStandingsTied(
    previousStanding: StandingComparable,
    nextStanding: StandingComparable
) {
    return (
        previousStanding.totalPoints.toString() ===
            nextStanding.totalPoints.toString() &&
        previousStanding.totalPages === nextStanding.totalPages &&
        previousStanding.totalAudiobookMinutes ===
            nextStanding.totalAudiobookMinutes &&
        previousStanding.totalBooks === nextStanding.totalBooks
    )
}

function standingsRankNumberAt(index: number, standings: StandingComparable[]) {
    const rankedStandings = standings
        .slice(0, index + 1)
        .map((standing, standingIndex) => ({
            ...standing,
            rankNumber:
                standingIndex > 0 &&
                areStandingsTied(
                    standings[standingIndex - 1],
                    standings[standingIndex]
                )
                    ? 0
                    : standingIndex + 1,
        }))

    for (
        let currentIndex = rankedStandings.length - 1;
        currentIndex >= 0;
        currentIndex -= 1
    ) {
        const rankNumber = rankedStandings[currentIndex]?.rankNumber ?? 0

        if (rankNumber > 0) {
            return rankNumber
        }
    }

    return index + 1
}

function toDisplayNumber(value: { toString(): string }) {
    return Number(value.toString())
}

function assertNever(value: never): never {
    throw new Error(`Unhandled value: ${String(value)}`)
}
