import { cache } from 'react'

import {
    getCompetitorCampaignContext,
    rankStandings,
    type CompetitorCampaignContext,
    type CompetitorCampaignStatus,
} from '@/lib/competitor-dashboard'

type LeaderboardHighlight = {
    detail: string
    label: string
    value: string
}

type LeaderboardRow = {
    activityLabel: string
    isViewer: boolean
    metricsLabel: string
    participantId: string
    participantHref: string
    pointsLabel: string
    rankLabel: string
    readerLabel: string
}

export type CompetitorLeaderboardViewModel = {
    hasQuest: boolean
    highlights: LeaderboardHighlight[]
    campaignDescription: string
    campaignDateRange: string | null
    campaignName: string
    campaignStatusLabel: string
    rows: LeaderboardRow[]
}

const defaultCampaignDescription =
    'No active campaign participation is linked to this account yet. The leaderboard will appear here once an invitation connects you to a campaign.'

export const defaultCompetitorLeaderboardViewModel: CompetitorLeaderboardViewModel =
    {
        hasQuest: false,
        highlights: [],
        campaignDescription: defaultCampaignDescription,
        campaignDateRange: null,
        campaignName: 'Campaign assignment pending',
        campaignStatusLabel: 'Awaiting invitation',
        rows: [],
    }

export const getCompetitorLeaderboardViewModel = cache(
    async (userId: string | null): Promise<CompetitorLeaderboardViewModel> => {
        const context = await getCompetitorCampaignContext(userId)

        return buildCompetitorLeaderboardViewModel(context, new Date())
    }
)

export function buildCompetitorLeaderboardViewModel(
    context: CompetitorCampaignContext | null,
    now: Date
): CompetitorLeaderboardViewModel {
    if (!context) {
        return defaultCompetitorLeaderboardViewModel
    }

    const rankedStandings = rankStandings(context.standings)
    const participantStanding = context.participant
        ? rankedStandings.find(
              (standing) => standing.id === context.participant?.id
          )
        : null
    const leader = rankedStandings[0] ?? null

    return {
        hasQuest: true,
        highlights: [
            {
                detail: context.participant
                    ? 'Tie-aware placement based on points and raw progress totals.'
                    : 'Join this campaign to claim a ranked spot on the leaderboard.',
                label: 'Your rank',
                value: participantStanding
                    ? `#${participantStanding.rankNumber}`
                    : 'Unranked',
            },
            {
                detail: leader
                    ? getReaderLabel(leader)
                    : 'No campaign leader yet.',
                label: 'Leading score',
                value: leader ? formatPoints(leader.totalPoints) : '0 points',
            },
            {
                detail: getCampaignWindowLabel(context.campaign.status, now),
                label: 'Readers on board',
                value: formatCount(rankedStandings.length),
            },
        ],
        campaignDescription: getCampaignDescription(
            context,
            rankedStandings.length
        ),
        campaignDateRange: formatCampaignDateRange(
            context.campaign.startAt,
            context.campaign.endAt,
            context.campaign.timezone
        ),
        campaignName: context.campaign.name,
        campaignStatusLabel: getCampaignStatusLabel(context.campaign.status),
        rows: rankedStandings.map((standing) => ({
            activityLabel: getActivityLabel(
                standing.lastActivityAt,
                context.campaign.timezone
            ),
            isViewer: context.participant?.id === standing.id,
            metricsLabel: [
                `${formatCount(standing.totalPages)} pages`,
                `${formatCount(standing.totalAudiobookMinutes)} minutes`,
                `${formatCount(standing.totalBooks)} ${pluralize('book', standing.totalBooks)}`,
                `${formatCount(standing.totalChallenges)} ${pluralize('challenge', standing.totalChallenges)}`,
            ].join(' • '),
            participantId: standing.id,
            participantHref: `/leaderboard/${standing.id}`,
            pointsLabel: formatPoints(standing.totalPoints),
            rankLabel: `#${standing.rankNumber}`,
            readerLabel:
                standing.id === context.participant?.id
                    ? `${getReaderLabel(standing)} (You)`
                    : getReaderLabel(standing),
        })),
    }
}

function getCampaignDescription(
    context: CompetitorCampaignContext,
    readerCount: number
) {
    return `${context.campaign.name} is ordered by points first, then pages, audiobook minutes, books, and join order when totals stay tied. ${formatCount(readerCount)} readers are currently on the board.`
}

function getCampaignStatusLabel(status: CompetitorCampaignStatus) {
    switch (status) {
        case 'ACTIVE':
            return 'Active leaderboard'
        case 'SCHEDULED':
            return 'Scheduled leaderboard'
        case 'COMPLETED':
            return 'Final standings'
        default:
            return assertNever(status)
    }
}

function getCampaignWindowLabel(status: CompetitorCampaignStatus, now: Date) {
    switch (status) {
        case 'ACTIVE':
            return `Snapshot updated ${formatCalendarDate(now, 'UTC')}.`
        case 'SCHEDULED':
            return 'The campaign has not opened yet.'
        case 'COMPLETED':
            return 'These standings are final for this campaign.'
        default:
            return assertNever(status)
    }
}

function getActivityLabel(value: Date | null, timezone: string) {
    if (!value) {
        return 'No logged activity yet.'
    }

    return `Last activity ${formatCalendarDate(value, timezone)}.`
}

function getReaderLabel(
    standing: CompetitorCampaignContext['standings'][number]
) {
    return standing.user.name || standing.user.email
}

function formatCalendarDate(value: Date, timezone: string) {
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeZone: timezone,
    }).format(value)
}

function formatCampaignDateRange(startAt: Date, endAt: Date, timezone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        month: 'long',
        timeZone: timezone,
    })

    return `${formatter.format(startAt)} - ${formatter.format(endAt)}`
}

function formatCount(value: number) {
    return new Intl.NumberFormat('en-US').format(value)
}

function formatPoints(value: { toString(): string }) {
    return `${new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
    }).format(Number(value.toString()))} points`
}

function pluralize(label: string, value: number) {
    return value === 1 ? label : `${label}s`
}

function assertNever(value: never): never {
    throw new Error(`Unhandled value: ${String(value)}`)
}
