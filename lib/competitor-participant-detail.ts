import { cache } from 'react'

import {
    rankStandings,
    type CompetitorQuestContext,
    type CompetitorQuestStatus,
} from '@/lib/competitor-dashboard'
import {
    formatCalendarDate,
    formatCompetitorHistoryEntries,
    formatCount,
    formatPoints,
    pluralize,
    type CompetitorHistoryEntryRecord,
} from '@/lib/competitor-history'
import {
    getCompetitorQuestContext,
    getParticipantReadingEntries,
} from '@/lib/competitor-queries'
import { type QuestScoringRules } from '@/lib/quest-domain'

type ParticipantDetailMetric = {
    detail: string
    label: string
    value: string
}

type ParticipantDetailInput = {
    context: CompetitorQuestContext
    historyEntries: CompetitorHistoryEntryRecord[]
    participantId: string
    scoringRules: QuestScoringRules
}

export type CompetitorParticipantDetailViewModel = {
    hasParticipant: boolean
    historyEntries: ParticipantHistoryItem[]
    isViewer: boolean
    participantLabel: string
    participantSummary: string
    participantId: string | null
    rankLabel: string
    questName: string
    questStatusLabel: string
    summaryMetrics: ParticipantDetailMetric[]
}

export const defaultCompetitorParticipantDetailViewModel: CompetitorParticipantDetailViewModel =
    {
        hasParticipant: false,
        historyEntries: [],
        isViewer: false,
        participantId: null,
        participantLabel: 'Reader not found',
        participantSummary:
            'This participant is not available on the current leaderboard.',
        rankLabel: 'Unranked',
        questName: 'Quest assignment pending',
        questStatusLabel: 'Awaiting invitation',
        summaryMetrics: [],
    }

export const getCompetitorParticipantDetailViewModel = cache(
    async (
        userId: string | null,
        participantId: string
    ): Promise<CompetitorParticipantDetailViewModel> => {
        const context = await getCompetitorQuestContext(userId)

        if (!context) {
            return defaultCompetitorParticipantDetailViewModel
        }

        const participantOnBoard = context.standings.find(
            (standing) => standing.id === participantId
        )

        if (!participantOnBoard) {
            return defaultCompetitorParticipantDetailViewModel
        }

        const participantHistory =
            await getParticipantReadingEntries(participantId)

        return buildCompetitorParticipantDetailViewModel({
            context,
            historyEntries: participantHistory,
            participantId,
            scoringRules: context.scoringRules,
        })
    }
)

export function buildCompetitorParticipantDetailViewModel(
    input: ParticipantDetailInput | null
): CompetitorParticipantDetailViewModel {
    if (!input) {
        return defaultCompetitorParticipantDetailViewModel
    }

    const { context, historyEntries, participantId, scoringRules } = input
    const rankedStandings = rankStandings(context.standings)
    const participant = rankedStandings.find(
        (standing) => standing.id === participantId
    )

    if (!participant) {
        return defaultCompetitorParticipantDetailViewModel
    }

    const participantLabel = getReaderLabel(participant)
    const isViewer = participant.id === context.participant.id
    const historyItems = formatCompetitorHistoryEntries({
        entries: historyEntries,
        scoringRules,
        timezone: context.participant.quest.timezone,
    })

    return {
        hasParticipant: true,
        historyEntries: historyItems,
        isViewer,
        participantId: participant.id,
        participantLabel,
        participantSummary:
            historyItems.length > 0
                ? `${participantLabel} has ${formatCount(historyItems.length)} ${pluralize('entry', historyItems.length)} recorded for this quest.`
                : `${participantLabel} has not logged any reading for this quest yet.`,
        rankLabel: `#${participant.rankNumber}`,
        questName: context.participant.quest.name,
        questStatusLabel: getQuestStatusLabel(context.participant.quest.status),
        summaryMetrics: [
            {
                detail: 'Current placement on this quest leaderboard.',
                label: 'Rank',
                value: `#${participant.rankNumber}`,
            },
            {
                detail: 'Total scored points for this quest.',
                label: 'Points',
                value: formatPoints(participant.totalPoints),
            },
            {
                detail: 'Combined raw progress totals recorded so far.',
                label: 'Raw totals',
                value: [
                    `${formatCount(participant.totalPages)} pages`,
                    `${formatCount(participant.totalAudiobookMinutes)} minutes`,
                    `${formatCount(participant.totalBooks)} ${pluralize('book', participant.totalBooks)}`,
                    `${formatCount(participant.totalChallenges)} ${pluralize('challenge', participant.totalChallenges)}`,
                ].join(' • '),
            },
            {
                detail: participant.lastActivityAt
                    ? 'Most recent activity captured for this quest.'
                    : 'No activity has been logged for this participant yet.',
                label: 'Last activity',
                value: participant.lastActivityAt
                    ? formatCalendarDate(
                          participant.lastActivityAt,
                          context.participant.quest.timezone
                      )
                    : 'No activity yet',
            },
        ],
    }
}

function getQuestStatusLabel(status: CompetitorQuestStatus) {
    switch (status) {
        case 'ACTIVE':
            return 'Participant detail'
        case 'SCHEDULED':
            return 'Upcoming participant detail'
        case 'COMPLETED':
            return 'Final participant detail'
        default:
            return assertNever(status)
    }
}

function getReaderLabel(standing: CompetitorQuestContext['standings'][number]) {
    return standing.user.name || standing.user.email
}

function assertNever(value: never): never {
    throw new Error(`Unhandled value: ${String(value)}`)
}
