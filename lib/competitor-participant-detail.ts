import { cache } from 'react'

import {
    rankStandings,
    type CompetitorCampaignContext,
    type CompetitorCampaignStatus,
} from '@/lib/competitor-dashboard'
import {
    formatCalendarDate,
    formatCompetitorHistoryEntries,
    formatCount,
    formatPoints,
    pluralize,
    type CompetitorHistoryItem,
    type CompetitorHistoryEntryRecord,
} from '@/lib/competitor-history'
import {
    getCompetitorCampaignContext,
    getParticipantReadingEntries,
} from '@/lib/competitor-queries'
import { type CampaignScoringRules } from '@/lib/campaign-domain'

type ParticipantDetailMetric = {
    detail: string
    label: string
    value: string
}

type ParticipantDetailInput = {
    context: CompetitorCampaignContext
    historyEntries: CompetitorHistoryEntryRecord[]
    participantId: string
    scoringRules: CampaignScoringRules
}

export type CompetitorParticipantDetailViewModel = {
    hasParticipant: boolean
    historyEntries: CompetitorHistoryItem[]
    isViewer: boolean
    participantLabel: string
    participantSummary: string
    participantId: string | null
    rankLabel: string
    campaignName: string
    campaignStatusLabel: string
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
        campaignName: 'Campaign assignment pending',
        campaignStatusLabel: 'Awaiting invitation',
        summaryMetrics: [],
    }

export const getCompetitorParticipantDetailViewModel = cache(
    async (
        userId: string | null,
        participantId: string
    ): Promise<CompetitorParticipantDetailViewModel> => {
        const context = await getCompetitorCampaignContext(userId)

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
        timezone: context.participant.campaign.timezone,
    })

    return {
        hasParticipant: true,
        historyEntries: historyItems,
        isViewer,
        participantId: participant.id,
        participantLabel,
        participantSummary:
            historyItems.length > 0
                ? `${participantLabel} has ${formatCount(historyItems.length)} ${pluralize('entry', historyItems.length)} recorded for this campaign.`
                : `${participantLabel} has not logged any reading for this campaign yet.`,
        rankLabel: `#${participant.rankNumber}`,
        campaignName: context.participant.campaign.name,
        campaignStatusLabel: getCampaignStatusLabel(
            context.participant.campaign.status
        ),
        summaryMetrics: [
            {
                detail: 'Current placement on this campaign leaderboard.',
                label: 'Rank',
                value: `#${participant.rankNumber}`,
            },
            {
                detail: 'Total scored points for this campaign.',
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
                    ? 'Most recent activity captured for this campaign.'
                    : 'No activity has been logged for this participant yet.',
                label: 'Last activity',
                value: participant.lastActivityAt
                    ? formatCalendarDate(
                          participant.lastActivityAt,
                          context.participant.campaign.timezone
                      )
                    : 'No activity yet',
            },
        ],
    }
}

function getCampaignStatusLabel(status: CompetitorCampaignStatus) {
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

function getReaderLabel(
    standing: CompetitorCampaignContext['standings'][number]
) {
    return standing.user.name || standing.user.email
}

function assertNever(value: never): never {
    throw new Error(`Unhandled value: ${String(value)}`)
}
