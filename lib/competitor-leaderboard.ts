import { cache } from 'react'

import {
    getCompetitorQuestContext,
    rankStandings,
    type CompetitorQuestContext,
    type CompetitorQuestStatus,
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
    questDescription: string
    questName: string
    questStatusLabel: string
    rows: LeaderboardRow[]
}

const defaultQuestDescription =
    'No active quest participation is linked to this account yet. The leaderboard will appear here once an invitation connects you to a quest.'

export const defaultCompetitorLeaderboardViewModel: CompetitorLeaderboardViewModel =
    {
        hasQuest: false,
        highlights: [],
        questDescription: defaultQuestDescription,
        questName: 'Quest assignment pending',
        questStatusLabel: 'Awaiting invitation',
        rows: [],
    }

export const getCompetitorLeaderboardViewModel = cache(
    async (userId: string | null): Promise<CompetitorLeaderboardViewModel> => {
        const context = await getCompetitorQuestContext(userId)

        return buildCompetitorLeaderboardViewModel(context, new Date())
    }
)

export function buildCompetitorLeaderboardViewModel(
    context: CompetitorQuestContext | null,
    now: Date
): CompetitorLeaderboardViewModel {
    if (!context) {
        return defaultCompetitorLeaderboardViewModel
    }

    const rankedStandings = rankStandings(context.standings)
    const participantStanding = rankedStandings.find(
        (standing) => standing.id === context.participant.id
    )
    const leader = rankedStandings[0] ?? null

    return {
        hasQuest: true,
        highlights: [
            {
                detail: 'Tie-aware placement based on points and raw progress totals.',
                label: 'Your rank',
                value: participantStanding
                    ? `#${participantStanding.rankNumber}`
                    : 'Unranked',
            },
            {
                detail: leader
                    ? getReaderLabel(leader)
                    : 'No quest leader yet.',
                label: 'Leading score',
                value: leader ? formatPoints(leader.totalPoints) : '0 points',
            },
            {
                detail: getQuestWindowLabel(
                    context.participant.quest.status,
                    now
                ),
                label: 'Readers on board',
                value: formatCount(rankedStandings.length),
            },
        ],
        questDescription: getQuestDescription(context, rankedStandings.length),
        questName: context.participant.quest.name,
        questStatusLabel: getQuestStatusLabel(context.participant.quest.status),
        rows: rankedStandings.map((standing) => ({
            activityLabel: getActivityLabel(
                standing.lastActivityAt,
                context.participant.quest.timezone
            ),
            isViewer: standing.id === context.participant.id,
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
                standing.id === context.participant.id
                    ? `${getReaderLabel(standing)} (You)`
                    : getReaderLabel(standing),
        })),
    }
}

function getQuestDescription(
    context: CompetitorQuestContext,
    readerCount: number
) {
    return `${context.participant.quest.name} is ordered by points first, then pages, audiobook minutes, books, and join order when totals stay tied. ${formatCount(readerCount)} readers are currently on the board.`
}

function getQuestStatusLabel(status: CompetitorQuestStatus) {
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

function getQuestWindowLabel(status: CompetitorQuestStatus, now: Date) {
    switch (status) {
        case 'ACTIVE':
            return `Snapshot updated ${formatCalendarDate(now, 'UTC')}.`
        case 'SCHEDULED':
            return 'The quest has not opened yet.'
        case 'COMPLETED':
            return 'These standings are final for this quest.'
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

function getReaderLabel(standing: CompetitorQuestContext['standings'][number]) {
    return standing.user.name || standing.user.email
}

function formatCalendarDate(value: Date, timezone: string) {
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeZone: timezone,
    }).format(value)
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
