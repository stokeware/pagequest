import type { CampaignStatus } from '@prisma/client'

import { getRoleAwareSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

import {
    LogProgressScreen,
    type LogProgressViewModel,
} from './log-progress-screen'

const loggableCampaignStatuses: CampaignStatus[] = [
    'ACTIVE',
    'SCHEDULED',
    'COMPLETED',
]

const defaultViewModel: LogProgressViewModel = {
    challengeOptions: [],
    hasLiveQuest: false,
    participantSummary:
        'No active campaign participation is linked to this account yet. This screen is ready for reading entries once a campaign is available.',
    campaignParticipantId: null,
    campaignPolicy: null,
    campaignName: 'Campaign assignment pending',
    scoringSummary: {
        audiobookMinutes: '0.75 points per minute',
        bookCompletion: '1 point per book',
        challengeCompletion: '1 point per completion',
        pagesRead: '1 point per page',
    },
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
            campaign: {
                select: {
                    entryDeleteWindowMinutes: true,
                    entryEditWindowMinutes: true,
                    endAt: true,
                    name: true,
                    pointsPerAudiobookMinute: true,
                    pointsPerBook: true,
                    pointsPerChallengeCompletion: true,
                    pointsPerPage: true,
                    startAt: true,
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
        participants[0] ??
        null

    if (!participant) {
        return defaultViewModel
    }

    return {
        challengeOptions: participant.campaign.campaignChallenges.map(
            ({ challenge, id, pointValueOverride }) => ({
                id,
                pointsLabel: `${(
                    pointValueOverride ??
                    challenge.pointValue ??
                    participant.campaign.pointsPerChallengeCompletion
                ).toString()} points`,
                title: challenge.title,
            })
        ),
        hasLiveQuest: participant.campaign.status === 'ACTIVE',
        participantSummary:
            participant.campaign.status === 'ACTIVE'
                ? 'Your current campaign is live, so this form is ready for book, page, audio, and challenge entries.'
                : 'Your most recent campaign context is loaded here while active campaign logging is still pending for this account.',
        campaignParticipantId: participant.id,
        campaignPolicy: {
            entryDeleteWindowMinutes:
                participant.campaign.entryDeleteWindowMinutes,
            entryEditWindowMinutes: participant.campaign.entryEditWindowMinutes,
            campaignEndAt: participant.campaign.endAt.toISOString(),
            campaignStartAt: participant.campaign.startAt.toISOString(),
            timezone: participant.campaign.timezone,
        },
        campaignName: participant.campaign.name,
        scoringSummary: {
            audiobookMinutes: `${participant.campaign.pointsPerAudiobookMinute.toString()} points per minute`,
            bookCompletion: `${participant.campaign.pointsPerBook.toString()} points per book`,
            challengeCompletion: `${participant.campaign.pointsPerChallengeCompletion.toString()} points per completion`,
            pagesRead: `${participant.campaign.pointsPerPage.toString()} points per page`,
        },
    }
}

export default async function LogProgressPage() {
    const viewer = await getRoleAwareSession('COMPETITOR')
    const viewModel = await getLogProgressViewModel(viewer.userId)

    return <LogProgressScreen {...viewModel} />
}
