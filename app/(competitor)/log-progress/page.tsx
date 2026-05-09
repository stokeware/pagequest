import type { QuestStatus } from '@prisma/client'

import { getRoleAwareSession } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

import {
    LogProgressScreen,
    type LogProgressViewModel,
} from './log-progress-screen'

const loggableQuestStatuses: QuestStatus[] = [
    'ACTIVE',
    'SCHEDULED',
    'COMPLETED',
]

const defaultViewModel: LogProgressViewModel = {
    challengeOptions: [],
    hasLiveQuest: false,
    participantSummary:
        'No active quest participation is linked to this account yet. This screen is ready for reading entries once a quest is available.',
    questParticipantId: null,
    questPolicy: null,
    questName: 'Quest assignment pending',
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

    const participants = await prisma.questParticipant.findMany({
        orderBy: {
            createdAt: 'desc',
        },
        select: {
            id: true,
            quest: {
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
                    questChallenges: {
                        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
                        select: {
                            challenge: {
                                select: {
                                    availability: true,
                                    description: true,
                                    evidencePrompt: true,
                                    pointValue: true,
                                    requiresReview: true,
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
            quest: {
                status: {
                    in: loggableQuestStatuses,
                },
            },
            removedAt: null,
            userId,
        },
    })

    const participant =
        participants.find((entry) => entry.quest.status === 'ACTIVE') ??
        participants[0] ??
        null

    if (!participant) {
        return defaultViewModel
    }

    return {
        challengeOptions: participant.quest.questChallenges.map(
            ({ challenge, id, pointValueOverride }) => ({
                availability: challenge.availability,
                description: challenge.description,
                evidencePrompt: challenge.evidencePrompt,
                id,
                pointsLabel: `${(
                    pointValueOverride ??
                    challenge.pointValue ??
                    participant.quest.pointsPerChallengeCompletion
                ).toString()} points`,
                requiresReview: challenge.requiresReview,
                title: challenge.title,
            })
        ),
        hasLiveQuest: participant.quest.status === 'ACTIVE',
        participantSummary:
            participant.quest.status === 'ACTIVE'
                ? 'Your current quest is live, so this form is ready for book, page, audio, and challenge entries.'
                : 'Your most recent quest context is loaded here while active quest logging is still pending for this account.',
        questParticipantId: participant.id,
        questPolicy: {
            entryDeleteWindowMinutes:
                participant.quest.entryDeleteWindowMinutes,
            entryEditWindowMinutes: participant.quest.entryEditWindowMinutes,
            questEndAt: participant.quest.endAt.toISOString(),
            questStartAt: participant.quest.startAt.toISOString(),
            timezone: participant.quest.timezone,
        },
        questName: participant.quest.name,
        scoringSummary: {
            audiobookMinutes: `${participant.quest.pointsPerAudiobookMinute.toString()} points per minute`,
            bookCompletion: `${participant.quest.pointsPerBook.toString()} points per book`,
            challengeCompletion: `${participant.quest.pointsPerChallengeCompletion.toString()} points per completion`,
            pagesRead: `${participant.quest.pointsPerPage.toString()} points per page`,
        },
    }
}

export default async function LogProgressPage() {
    const viewer = await getRoleAwareSession('COMPETITOR')
    const viewModel = await getLogProgressViewModel(viewer.userId)

    return <LogProgressScreen {...viewModel} />
}
