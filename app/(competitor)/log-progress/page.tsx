import type { CampaignStatus, ChallengeKind } from '@prisma/client'

import {
    personalGoalTemplateTitle,
    resolveChallengePageMinuteMultiplier,
    resolveChallengePointValue,
    sortChallengesForCompetitorView,
} from '@/lib/challenge-config'
import { synchronizeDerivedCampaignStatuses } from '@/lib/campaign-status'
import { prisma } from '@/lib/prisma'

import {
    LogProgressScreen,
    type LogProgressViewModel,
} from './log-progress-screen'
import {
    campaignWorkspaceAuditAction,
    emptyCampaignWorkspaceState,
    parseCampaignWorkspaceState,
    type CampaignWorkspaceState,
} from './workspace-state'
import { getAchievedChallengeIds } from './challenge-achievement'
import { getRoleAwareSession } from '@/lib/auth/session'

const loggableCampaignStatuses: CampaignStatus[] = [
    'ACTIVE',
    'SCHEDULED',
    'COMPLETED',
]

const defaultViewModel: LogProgressViewModel = {
    campaignDateRange: null,
    campaignParticipantId: null,
    campaignChallenges: [],
    campaignName: 'Campaign assignment pending',
    progressScoring: {
        pointsPerMinute: 0.75,
        pointsPerPage: 1,
    },
    workspaceState: emptyCampaignWorkspaceState,
}

async function getLogProgressViewModel(
    userId: string | null
): Promise<LogProgressViewModel> {
    if (!userId) {
        return defaultViewModel
    }

    await synchronizeDerivedCampaignStatuses()

    const participants = await prisma.campaignParticipant.findMany({
        orderBy: {
            createdAt: 'desc',
        },
        select: {
            id: true,
            auditLogs: {
                orderBy: {
                    createdAt: 'desc',
                },
                select: {
                    metadata: true,
                },
                take: 1,
                where: {
                    action: campaignWorkspaceAuditAction,
                },
            },
            challengeCompletions: {
                select: {
                    challengeId: true,
                },
                where: {
                    readingEntry: {
                        deletedAt: null,
                    },
                    reviewState: {
                        in: ['APPROVED', 'AUTO_APPROVED'],
                    },
                },
            },
            challengeSources: {
                select: {
                    bookTitle: true,
                    kind: true,
                },
            },
            campaign: {
                select: {
                    challenges: {
                        select: {
                            id: true,
                            isActive: true,
                            kind: true,
                            ownerParticipantId: true,
                            pageMinuteMultiplier: true,
                            pointValue: true,
                            sourceBookTitle: true,
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
                    name: true,
                    pointsPerAudiobookMinute: true,
                    pointsPerPage: true,
                    startAt: true,
                    status: true,
                    timezone: true,
                },
            },
        },
        take: 5,
        where: {
            campaign: {
                status: {
                    in: loggableCampaignStatuses,
                },
            },
            removedAt: null,
            userId,
        },
    })

    const participant =
        participants.find((entry) => entry.campaign.status === 'ACTIVE') ??
        participants
            .filter((entry) => entry.campaign.status === 'SCHEDULED')
            .sort(
                (left, right) =>
                    left.campaign.startAt.getTime() -
                    right.campaign.startAt.getTime()
            )[0] ??
        participants
            .filter((entry) => entry.campaign.status === 'COMPLETED')
            .sort(
                (left, right) =>
                    right.campaign.endAt.getTime() -
                    left.campaign.endAt.getTime()
            )[0] ??
        null

    if (!participant) {
        return defaultViewModel
    }

    const workspaceState = hydrateWorkspaceState({
        challengeSources: participant.challengeSources,
        challenges: participant.campaign.challenges,
        metadata: participant.auditLogs[0]?.metadata,
    })
    const achievedChallengeIds = getAchievedChallengeIds({
        approvedChallengeIds: participant.challengeCompletions.map(
            (completion) => completion.challengeId
        ),
        workspaceState,
    })

    return {
        campaignDateRange: formatCampaignDateRange(
            participant.campaign.startAt,
            participant.campaign.endAt,
            participant.campaign.timezone
        ),
        campaignChallenges: sortChallengesForCompetitorView(
            participant.campaign.challenges
                .filter((challenge) => challenge.isActive)
                .map((challenge) => ({
                    achieved: achievedChallengeIds.has(challenge.id),
                    id: challenge.id,
                    kind: challenge.kind,
                    ownedByCurrentParticipant:
                        challenge.ownerParticipantId === participant.id,
                    pageMinuteMultiplier: Number(
                        resolveChallengePageMinuteMultiplier(challenge)
                    ),
                    pointValue: Number(resolveChallengePointValue(challenge)),
                    sourceBookTitle: challenge.sourceBookTitle,
                    title:
                        challenge.kind === 'PERSONAL_GOAL_INSTANCE'
                            ? personalGoalTemplateTitle
                            : challenge.title,
                }))
        ),
        campaignParticipantId: participant.id,
        campaignName: participant.campaign.name,
        progressScoring: {
            pointsPerMinute: Number(
                participant.campaign.pointsPerAudiobookMinute.toString()
            ),
            pointsPerPage: Number(
                participant.campaign.pointsPerPage.toString()
            ),
        },
        workspaceState,
    }
}

export default async function LogProgressPage() {
    const viewer = await getRoleAwareSession('COMPETITOR')
    const viewModel = await getLogProgressViewModel(viewer.userId)

    return <LogProgressScreen {...viewModel} />
}

function hydrateWorkspaceState({
    challengeSources,
    challenges,
    metadata,
}: {
    challengeSources: Array<{
        bookTitle: string
        kind: 'PERSONAL_GOAL' | 'RECOMMENDATION'
    }>
    challenges: Array<{
        id: string
        kind: ChallengeKind
    }>
    metadata: unknown
}): CampaignWorkspaceState {
    const parsedWorkspaceState = parseCampaignWorkspaceState(metadata)
    const personalGoalTitle =
        challengeSources.find((source) => source.kind === 'PERSONAL_GOAL')
            ?.bookTitle ?? parsedWorkspaceState.personalGoalTitle
    const recommendationTitle =
        challengeSources.find((source) => source.kind === 'RECOMMENDATION')
            ?.bookTitle ?? parsedWorkspaceState.recommendationTitle
    const personalGoalChallengeId =
        challenges.find(
            (challenge) => challenge.kind === 'PERSONAL_GOAL_INSTANCE'
        )?.id ?? ''
    const personalGoalRow = parsedWorkspaceState.progressRows.find(
        (row) => row.rowType === 'PERSONAL_GOAL'
    ) ?? {
        bookName: personalGoalTitle,
        challengeId: personalGoalChallengeId,
        completed: false,
        id: 'progress-row-personal-goal',
        minutes: '',
        pages: '',
        rowType: 'PERSONAL_GOAL' as const,
    }

    return {
        personalGoalTitle,
        progressRows: [
            {
                ...personalGoalRow,
                bookName: personalGoalTitle,
                challengeId: personalGoalChallengeId,
                rowType: 'PERSONAL_GOAL',
            },
            ...parsedWorkspaceState.progressRows.filter(
                (row) => row.rowType !== 'PERSONAL_GOAL'
            ),
        ],
        recommendationTitle,
    }
}

function formatCampaignDateRange(startAt: Date, endAt: Date, timezone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        month: 'long',
        timeZone: timezone,
    })

    return `${formatter.format(startAt)} - ${formatter.format(endAt)}`
}
