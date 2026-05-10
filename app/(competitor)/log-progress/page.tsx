import type { CampaignStatus } from '@prisma/client'

import { getRoleAwareSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

import {
    LogProgressScreen,
    type LogProgressViewModel,
} from './log-progress-screen'
import {
    campaignWorkspaceAuditAction,
    emptyCampaignWorkspaceState,
    parseCampaignWorkspaceState,
} from './workspace-state'

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
                    campaignChallengeId: true,
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
            campaign: {
                select: {
                    endAt: true,
                    name: true,
                    pointsPerAudiobookMinute: true,
                    pointsPerChallengeCompletion: true,
                    pointsPerPage: true,
                    startAt: true,
                    timezone: true,
                    campaignChallenges: {
                        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                        select: {
                            challenge: {
                                select: {
                                    pointValue: true,
                                    title: true,
                                },
                            },
                            challengeId: true,
                            id: true,
                            isActive: true,
                            pointValueOverride: true,
                        },
                        where: {
                            isActive: true,
                        },
                    },
                    status: true,
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

    const achievedChallengeIds = new Set(
        participant.challengeCompletions.flatMap((completion) =>
            completion.campaignChallengeId
                ? [completion.campaignChallengeId]
                : []
        )
    )

    return {
        campaignDateRange: formatCampaignDateRange(
            participant.campaign.startAt,
            participant.campaign.endAt,
            participant.campaign.timezone
        ),
        campaignChallenges: participant.campaign.campaignChallenges.map(
            ({ challenge, id, pointValueOverride }) => ({
                achieved: achievedChallengeIds.has(id),
                id,
                pointValue: Number(
                    (
                        pointValueOverride ??
                        challenge.pointValue ??
                        participant.campaign.pointsPerChallengeCompletion
                    ).toString()
                ),
                pointsLabel: `${(
                    pointValueOverride ??
                    challenge.pointValue ??
                    participant.campaign.pointsPerChallengeCompletion
                ).toString()} points`,
                title: challenge.title,
            })
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
        workspaceState: parseCampaignWorkspaceState(
            participant.auditLogs[0]?.metadata
        ),
    }
}

export default async function LogProgressPage() {
    const viewer = await getRoleAwareSession('COMPETITOR')
    const viewModel = await getLogProgressViewModel(viewer.userId)

    return <LogProgressScreen {...viewModel} />
}

function formatCampaignDateRange(startAt: Date, endAt: Date, timezone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        month: 'long',
        timeZone: timezone,
    })

    return `${formatter.format(startAt)} - ${formatter.format(endAt)}`
}
