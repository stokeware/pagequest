import type {
    ChallengeReviewState,
    CampaignStatus,
    ReadingEntryType,
} from '@prisma/client'
import { cache } from 'react'

import { prisma } from '@/lib/prisma'
import type { CampaignScoringRules } from '@/lib/campaign-domain'

export type CompetitorCampaignStatus = Extract<
    CampaignStatus,
    'ACTIVE' | 'COMPLETED' | 'SCHEDULED'
>

export type CompetitorHistoryCampaignStatus = Extract<
    CampaignStatus,
    'ACTIVE' | 'SCHEDULED' | 'COMPLETED' | 'ARCHIVED'
>

export type CompetitorCampaignParticipantRecord = {
    createdAt: Date
    id: string
    joinedAt: Date | null
    lastActivityAt: Date | null
    campaign: {
        endAt: Date
        id: string
        name: string
        startAt: Date
        status: CompetitorCampaignStatus
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

export type CompetitorCampaignContext = {
    participant: CompetitorCampaignParticipantRecord
    recentEntries: CompetitorRecentEntryRecord[]
    standings: CompetitorStandingRecord[]
}

export type CompetitorCampaignContextWithScoring = CompetitorCampaignContext & {
    scoringRules: CampaignScoringRules
}

export type CompetitorHistoryCampaignRecord = {
    createdAt: Date
    id: string
    lastActivityAt: Date | null
    campaign: {
        endAt: Date
        name: string
        startAt: Date
        status: CompetitorHistoryCampaignStatus
        timezone: string
    }
    scoringRules: CampaignScoringRules
    totalAudiobookMinutes: number
    totalBooks: number
    totalChallenges: number
    totalPages: number
    totalPoints: { toString(): string }
}

type CompetitorCurrentCampaignParticipant =
    CompetitorCampaignParticipantRecord & {
        scoringRules: CampaignScoringRules
    }

type CompetitorHistoryCampaignParticipant = CompetitorHistoryCampaignRecord

const currentCampaignStatuses: CompetitorCampaignStatus[] = [
    'ACTIVE',
    'SCHEDULED',
    'COMPLETED',
]

const historyCampaignStatuses: CompetitorHistoryCampaignStatus[] = [
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

export const getCompetitorCampaignContext = cache(
    async (
        userId: string | null
    ): Promise<CompetitorCampaignContextWithScoring | null> => {
        const participants =
            await getCompetitorCurrentCampaignParticipants(userId)
        const participant = selectPrimaryCompetitorParticipant(participants)

        if (!participant) {
            return null
        }

        const [standings, recentEntries] = await Promise.all([
            getCampaignStandings(participant.campaign.id),
            getRecentReadingEntries(participant.id),
        ])

        return {
            participant,
            recentEntries,
            scoringRules: participant.scoringRules,
            standings,
        }
    }
)

export const getCompetitorHistoryCampaignRecords = cache(
    async (
        userId: string | null
    ): Promise<CompetitorHistoryCampaignRecord[]> => {
        if (!userId) {
            return []
        }

        return prisma.campaignParticipant
            .findMany({
                select: {
                    createdAt: true,
                    id: true,
                    lastActivityAt: true,
                    campaign: {
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
                    campaign: {
                        status: {
                            in: historyCampaignStatuses,
                        },
                    },
                    removedAt: null,
                    userId,
                },
            })
            .then((participants) =>
                participants.flatMap((participant) => {
                    if (
                        !isCompetitorHistoryCampaignStatus(
                            participant.campaign.status
                        )
                    ) {
                        return []
                    }

                    return [
                        {
                            createdAt: participant.createdAt,
                            id: participant.id,
                            lastActivityAt: participant.lastActivityAt,
                            campaign: {
                                endAt: participant.campaign.endAt,
                                name: participant.campaign.name,
                                startAt: participant.campaign.startAt,
                                status: participant.campaign.status,
                                timezone: participant.campaign.timezone,
                            },
                            scoringRules: toCampaignScoringRules(
                                participant.campaign
                            ),
                            totalAudiobookMinutes:
                                participant.totalAudiobookMinutes,
                            totalBooks: participant.totalBooks,
                            totalChallenges: participant.totalChallenges,
                            totalPages: participant.totalPages,
                            totalPoints: participant.totalPoints,
                        } satisfies CompetitorHistoryCampaignParticipant,
                    ]
                })
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
                campaignParticipantId: participantId,
            },
        })
    }
)

export function selectPrimaryCompetitorParticipant<
    T extends {
        campaign: {
            status: CompetitorCampaignStatus
        }
    },
>(participants: T[]) {
    return (
        participants.find((entry) => entry.campaign.status === 'ACTIVE') ??
        participants[0] ??
        null
    )
}

async function getCompetitorCurrentCampaignParticipants(userId: string | null) {
    if (!userId) {
        return []
    }

    return prisma.campaignParticipant
        .findMany({
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                createdAt: true,
                id: true,
                joinedAt: true,
                lastActivityAt: true,
                campaign: {
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
                campaign: {
                    status: {
                        in: currentCampaignStatuses,
                    },
                },
                removedAt: null,
                userId,
            },
        })
        .then((participants) =>
            participants.flatMap((participant) => {
                if (!isCompetitorCampaignStatus(participant.campaign.status)) {
                    return []
                }

                return [
                    {
                        createdAt: participant.createdAt,
                        id: participant.id,
                        joinedAt: participant.joinedAt,
                        lastActivityAt: participant.lastActivityAt,
                        campaign: {
                            endAt: participant.campaign.endAt,
                            id: participant.campaign.id,
                            name: participant.campaign.name,
                            startAt: participant.campaign.startAt,
                            status: participant.campaign.status,
                            timezone: participant.campaign.timezone,
                        },
                        scoringRules: toCampaignScoringRules(
                            participant.campaign
                        ),
                        totalAudiobookMinutes:
                            participant.totalAudiobookMinutes,
                        totalBooks: participant.totalBooks,
                        totalChallenges: participant.totalChallenges,
                        totalPages: participant.totalPages,
                        totalPoints: participant.totalPoints,
                    } satisfies CompetitorCurrentCampaignParticipant,
                ]
            })
        )
}

function isCompetitorCampaignStatus(
    status: CampaignStatus
): status is CompetitorCampaignStatus {
    return currentCampaignStatuses.includes(status as CompetitorCampaignStatus)
}

function isCompetitorHistoryCampaignStatus(
    status: CampaignStatus
): status is CompetitorHistoryCampaignStatus {
    return historyCampaignStatuses.includes(
        status as CompetitorHistoryCampaignStatus
    )
}

async function getCampaignStandings(campaignId: string) {
    return prisma.campaignParticipant.findMany({
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
            campaignId,
            removedAt: null,
        },
    })
}

async function getRecentReadingEntries(participantId: string) {
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
        where: {
            deletedAt: null,
            campaignParticipantId: participantId,
        },
    })
}

function toCampaignScoringRules(campaign: {
    pointsPerAudiobookMinute: { toString(): string }
    pointsPerBook: { toString(): string }
    pointsPerChallengeCompletion: { toString(): string }
    pointsPerPage: { toString(): string }
}) {
    return {
        pointsPerAudiobookMinute: campaign.pointsPerAudiobookMinute.toString(),
        pointsPerBook: campaign.pointsPerBook.toString(),
        pointsPerChallengeCompletion:
            campaign.pointsPerChallengeCompletion.toString(),
        pointsPerPage: campaign.pointsPerPage.toString(),
    }
}
