import { cache } from 'react'

import {
    buildCompletedBookActivityItems,
    buildDashboardSnapshotCards,
    type DashboardRecentActivityItem,
    type DashboardSnapshotCard,
    rankStandings,
    type CompetitorCampaignContext,
} from '@/lib/competitor-dashboard'
import {
    formatCount,
    pluralize,
    type CompetitorHistoryEntryRecord,
} from '@/lib/competitor-history-format'
import {
    getCompetitorCampaignContext,
    getParticipantReadingEntries,
} from '@/lib/competitor-queries'
import { type CampaignScoringRules } from '@/lib/campaign-domain'

type ParticipantDetailInput = {
    context: CompetitorCampaignContext
    historyEntries: CompetitorHistoryEntryRecord[]
    participantId: string
    scoringRules: CampaignScoringRules
}

export type CompetitorParticipantDetailViewModel = {
    hasParticipant: boolean
    isViewer: boolean
    participantId: string | null
    campaignName: string
    participantLabel: string
    participantSummary: string
    recentActivity: DashboardRecentActivityItem[]
    snapshotCards: DashboardSnapshotCard[]
}

export const defaultCompetitorParticipantDetailViewModel: CompetitorParticipantDetailViewModel =
    {
        hasParticipant: false,
        isViewer: false,
        participantId: null,
        campaignName: 'Campaign assignment pending',
        participantLabel: 'Reader not found',
        participantSummary:
            'This participant is not available on the current leaderboard.',
        recentActivity: [],
        snapshotCards: [],
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
    const isViewer = participant.id === context.participant?.id
    const leader = rankedStandings[0] ?? null
    const participantPoints = Number(participant.totalPoints.toString())
    const leaderPoints = leader ? Number(leader.totalPoints.toString()) : 0
    const recentActivity = buildCompletedBookActivityItems({
        entries: historyEntries,
        scoringRules,
        timezone: context.campaign.timezone,
    })
    const snapshotCards = buildDashboardSnapshotCards({
        pointsBehindLeader: Math.max(leaderPoints - participantPoints, 0),
        rankNumber: participant.rankNumber,
        totals: participant,
    })

    return {
        hasParticipant: true,
        isViewer,
        participantId: participant.id,
        campaignName: context.campaign.name,
        participantLabel,
        participantSummary:
            historyEntries.length > 0
                ? `${participantLabel} has ${formatCount(historyEntries.length)} ${pluralize('entry', historyEntries.length)} recorded for this campaign.`
                : `${participantLabel} has not logged any reading for this campaign yet.`,
        recentActivity,
        snapshotCards,
    }
}

function getReaderLabel(
    standing: CompetitorCampaignContext['standings'][number]
) {
    return standing.user.name || standing.user.email
}
