import type {
    ChallengeReviewState,
    QuestStatus,
    ReadingEntryType,
} from '@prisma/client'
import { cache } from 'react'

import { prisma } from '@/lib/prisma'
import type { QuestScoringRules } from '@/lib/quest-domain'

export type CompetitorQuestStatus = Extract<
    QuestStatus,
    'ACTIVE' | 'COMPLETED' | 'SCHEDULED'
>

export type CompetitorHistoryQuestStatus = Extract<
    QuestStatus,
    'ACTIVE' | 'SCHEDULED' | 'COMPLETED' | 'ARCHIVED'
>

export type CompetitorQuestParticipantRecord = {
    createdAt: Date
    id: string
    joinedAt: Date | null
    lastActivityAt: Date | null
    quest: {
        endAt: Date
        id: string
        name: string
        startAt: Date
        status: CompetitorQuestStatus
        timezone: string
    }
    totalAudiobookMinutes: number
    totalBooks: number
    totalChallenges: number
    totalPages: number
    totalPoints: { toString(): string }
}

export type CompetitorStandingRecord = {
    createdAt: Date
    id: string
    lastActivityAt: Date | null
    totalAudiobookMinutes: number
    totalBooks: number
    totalChallenges: number
    totalPages: number
    totalPoints: { toString(): string }
    user: {
        email: string
        name: string | null
    }
}

export type CompetitorRecentEntryRecord = {
    activityDate: Date
    bookAuthor: string | null
    bookTitle: string | null
    challengeCompletion: {
        challenge: {
            title: string
        }
        reviewState: ChallengeReviewState
    } | null
    id: string
    type: ReadingEntryType
    value: number
}

export type CompetitorHistoryEntryRecord = {
    activityDate: Date
    bookAuthor: string | null
    bookTitle: string | null
    challengeCompletion: {
        awardedPoints: { toString(): string } | null
        challenge: {
            title: string
        }
        evidenceText: string | null
        reviewState: ChallengeReviewState
    } | null
    id: string
    notes: string | null
    type: ReadingEntryType
    value: number
}

export type CompetitorQuestContext = {
    participant: CompetitorQuestParticipantRecord
    recentEntries: CompetitorRecentEntryRecord[]
    standings: CompetitorStandingRecord[]
}

export type CompetitorQuestContextWithScoring = CompetitorQuestContext & {
    scoringRules: QuestScoringRules
}

export type CompetitorHistoryQuestRecord = {
    createdAt: Date
    id: string
    lastActivityAt: Date | null
    quest: {
        endAt: Date
        name: string
        startAt: Date
        status: CompetitorHistoryQuestStatus
        timezone: string
    }
    scoringRules: QuestScoringRules
    totalAudiobookMinutes: number
    totalBooks: number
    totalChallenges: number
    totalPages: number
    totalPoints: { toString(): string }
}

const currentQuestStatuses: CompetitorQuestStatus[] = [
    'ACTIVE',
    'SCHEDULED',
    'COMPLETED',
]

const historyQuestStatuses: CompetitorHistoryQuestStatus[] = [
    'ACTIVE',
    'SCHEDULED',
    'COMPLETED',
    'ARCHIVED',
]

const standingsOrderBy = [
    {
        totalPoints: 'desc' as const,
    },
    {
        totalPages: 'desc' as const,
    },
    {
        totalAudiobookMinutes: 'desc' as const,
    },
    {
        totalBooks: 'desc' as const,
    },
    {
        createdAt: 'asc' as const,
    },
]

const readingEntriesOrderBy = [
    {
        activityDate: 'desc' as const,
    },
    {
        createdAt: 'desc' as const,
    },
]

export const getCompetitorQuestContext = cache(
    async (
        userId: string | null
    ): Promise<CompetitorQuestContextWithScoring | null> => {
        const participants = await getCompetitorCurrentQuestParticipants(userId)
        const participant = selectPrimaryCompetitorParticipant(participants)

        if (!participant) {
            return null
        }

        const [standings, recentEntries] = await Promise.all([
            getQuestStandings(participant.quest.id),
            getRecentReadingEntries(participant.id, 5),
        ])

        return {
            participant,
            recentEntries,
            scoringRules: participant.scoringRules,
            standings,
        }
    }
)

export const getCompetitorHistoryQuestRecords = cache(
    async (userId: string | null): Promise<CompetitorHistoryQuestRecord[]> => {
        if (!userId) {
            return []
        }

        return prisma.questParticipant
            .findMany({
                select: {
                    createdAt: true,
                    id: true,
                    lastActivityAt: true,
                    quest: {
                        select: {
                            endAt: true,
                            name: true,
                            pointsPerAudiobookMinute: true,
                            pointsPerBook: true,
                            pointsPerChallengeCompletion: true,
                            pointsPerPage: true,
                            startAt: true,
                            status: true,
                            timezone: true,
                        },
                    },
                    totalAudiobookMinutes: true,
                    totalBooks: true,
                    totalChallenges: true,
                    totalPages: true,
                    totalPoints: true,
                },
                where: {
                    quest: {
                        status: {
                            in: historyQuestStatuses,
                        },
                    },
                    removedAt: null,
                    userId,
                },
            })
            .then((participants) =>
                participants.map((participant) => ({
                    createdAt: participant.createdAt,
                    id: participant.id,
                    lastActivityAt: participant.lastActivityAt,
                    quest: {
                        endAt: participant.quest.endAt,
                        name: participant.quest.name,
                        startAt: participant.quest.startAt,
                        status: participant.quest.status,
                        timezone: participant.quest.timezone,
                    },
                    scoringRules: toQuestScoringRules(participant.quest),
                    totalAudiobookMinutes: participant.totalAudiobookMinutes,
                    totalBooks: participant.totalBooks,
                    totalChallenges: participant.totalChallenges,
                    totalPages: participant.totalPages,
                    totalPoints: participant.totalPoints,
                }))
            )
    }
)

export const getParticipantReadingEntries = cache(
    async (participantId: string): Promise<CompetitorHistoryEntryRecord[]> => {
        return prisma.readingEntry.findMany({
            orderBy: readingEntriesOrderBy,
            select: {
                activityDate: true,
                bookAuthor: true,
                bookTitle: true,
                challengeCompletion: {
                    select: {
                        awardedPoints: true,
                        challenge: {
                            select: {
                                title: true,
                            },
                        },
                        evidenceText: true,
                        reviewState: true,
                    },
                },
                id: true,
                notes: true,
                type: true,
                value: true,
            },
            where: {
                deletedAt: null,
                questParticipantId: participantId,
            },
        })
    }
)

export function selectPrimaryCompetitorParticipant<
    T extends {
        quest: {
            status: CompetitorQuestStatus
        }
    },
>(participants: T[]) {
    return (
        participants.find((entry) => entry.quest.status === 'ACTIVE') ??
        participants[0] ??
        null
    )
}

async function getCompetitorCurrentQuestParticipants(userId: string | null) {
    if (!userId) {
        return []
    }

    return prisma.questParticipant
        .findMany({
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                createdAt: true,
                id: true,
                joinedAt: true,
                lastActivityAt: true,
                quest: {
                    select: {
                        endAt: true,
                        id: true,
                        name: true,
                        pointsPerAudiobookMinute: true,
                        pointsPerBook: true,
                        pointsPerChallengeCompletion: true,
                        pointsPerPage: true,
                        startAt: true,
                        status: true,
                        timezone: true,
                    },
                },
                totalAudiobookMinutes: true,
                totalBooks: true,
                totalChallenges: true,
                totalPages: true,
                totalPoints: true,
            },
            take: 5,
            where: {
                quest: {
                    status: {
                        in: currentQuestStatuses,
                    },
                },
                removedAt: null,
                userId,
            },
        })
        .then((participants) =>
            participants.map((participant) => ({
                createdAt: participant.createdAt,
                id: participant.id,
                joinedAt: participant.joinedAt,
                lastActivityAt: participant.lastActivityAt,
                quest: {
                    endAt: participant.quest.endAt,
                    id: participant.quest.id,
                    name: participant.quest.name,
                    startAt: participant.quest.startAt,
                    status: participant.quest.status,
                    timezone: participant.quest.timezone,
                },
                scoringRules: toQuestScoringRules(participant.quest),
                totalAudiobookMinutes: participant.totalAudiobookMinutes,
                totalBooks: participant.totalBooks,
                totalChallenges: participant.totalChallenges,
                totalPages: participant.totalPages,
                totalPoints: participant.totalPoints,
            }))
        )
}

async function getQuestStandings(questId: string) {
    return prisma.questParticipant.findMany({
        orderBy: standingsOrderBy,
        select: {
            createdAt: true,
            id: true,
            lastActivityAt: true,
            totalAudiobookMinutes: true,
            totalBooks: true,
            totalChallenges: true,
            totalPages: true,
            totalPoints: true,
            user: {
                select: {
                    email: true,
                    name: true,
                },
            },
        },
        where: {
            questId,
            removedAt: null,
        },
    })
}

async function getRecentReadingEntries(participantId: string, take: number) {
    return prisma.readingEntry.findMany({
        orderBy: readingEntriesOrderBy,
        select: {
            activityDate: true,
            bookAuthor: true,
            bookTitle: true,
            challengeCompletion: {
                select: {
                    challenge: {
                        select: {
                            title: true,
                        },
                    },
                    reviewState: true,
                },
            },
            id: true,
            type: true,
            value: true,
        },
        take,
        where: {
            deletedAt: null,
            questParticipantId: participantId,
        },
    })
}

function toQuestScoringRules(quest: {
    pointsPerAudiobookMinute: { toString(): string }
    pointsPerBook: { toString(): string }
    pointsPerChallengeCompletion: { toString(): string }
    pointsPerPage: { toString(): string }
}) {
    return {
        pointsPerAudiobookMinute: quest.pointsPerAudiobookMinute.toString(),
        pointsPerBook: quest.pointsPerBook.toString(),
        pointsPerChallengeCompletion:
            quest.pointsPerChallengeCompletion.toString(),
        pointsPerPage: quest.pointsPerPage.toString(),
    }
}
