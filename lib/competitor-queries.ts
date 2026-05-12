import type {
    ChallengeReviewState,
    CampaignStatus,
    ReadingEntryType,
} from '@prisma/client'
import { cache } from 'react'

import { prisma } from '@/lib/prisma'
import { synchronizeDerivedCampaignStatuses } from '@/lib/campaign-status'
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
    campaign: CompetitorCampaignRecord
    totalAudiobookMinutes: number
    totalBooks: number
    totalChallenges: number
    totalPages: number
    totalPoints: { toString(): string }
}

export type CompetitorCampaignRecord = {
    endAt: Date
    id: string
    name: string
    startAt: Date
    status: CompetitorCampaignStatus
    timezone: string
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
    campaign: CompetitorCampaignRecord
    participant: CompetitorCampaignParticipantRecord | null
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

type CompetitorVisibleCampaign = CompetitorCampaignRecord & {
    scoringRules: CampaignScoringRules
}

type CompetitorVisibleCampaignSelection = Pick<
    CompetitorCampaignRecord,
    'endAt' | 'startAt' | 'status'
>

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
        await synchronizeDerivedCampaignStatuses()

        const visibleCampaign = await getVisibleCompetitorCampaign()

        if (!visibleCampaign) {
            return null
        }

        const participant = await getCompetitorCampaignParticipant(
            userId,
            visibleCampaign.id
        )

        const [standings, recentEntries] = await Promise.all([
            getCampaignStandings(visibleCampaign.id),
            participant
                ? getRecentReadingEntries(participant.id)
                : Promise.resolve([]),
        ])

        return {
            campaign: toCompetitorCampaignRecord(visibleCampaign),
            participant,
            recentEntries,
            scoringRules: visibleCampaign.scoringRules,
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

export function selectVisibleCompetitorCampaign<
    T extends CompetitorVisibleCampaignSelection,
>(campaigns: T[], now = new Date()) {
    return selectVisibleCompetitorEntry(campaigns, (campaign) => campaign, now)
}

export function selectPrimaryCompetitorParticipant<
    T extends {
        campaign: CompetitorVisibleCampaignSelection
    },
>(participants: T[], now = new Date()) {
    return selectVisibleCompetitorEntry(
        participants,
        (participant) => participant.campaign,
        now
    )
}

function selectVisibleCompetitorEntry<T>(
    entries: T[],
    getCampaign: (entry: T) => CompetitorVisibleCampaignSelection,
    now = new Date()
) {
    const nowTimestamp = now.getTime()
    const activeEntry = entries.find((entry) => {
        const campaign = getCampaign(entry)

        return (
            campaign.status === 'ACTIVE' ||
            (campaign.status === 'SCHEDULED' &&
                campaign.startAt.getTime() <= nowTimestamp &&
                campaign.endAt.getTime() > nowTimestamp)
        )
    })

    if (activeEntry) {
        return activeEntry
    }

    const futureEntry = [...entries]
        .filter((entry) => {
            const campaign = getCampaign(entry)

            return (
                campaign.status === 'SCHEDULED' ||
                campaign.startAt.getTime() > nowTimestamp
            )
        })
        .sort(
            (left, right) =>
                getCampaign(left).startAt.getTime() -
                getCampaign(right).startAt.getTime()
        )[0]

    if (futureEntry) {
        return futureEntry
    }

    const latestPastEntry = [...entries]
        .filter((entry) => {
            const campaign = getCampaign(entry)

            return (
                campaign.status === 'COMPLETED' ||
                campaign.endAt.getTime() <= nowTimestamp
            )
        })
        .sort(
            (left, right) =>
                getCampaign(right).endAt.getTime() -
                getCampaign(left).endAt.getTime()
        )[0]

    return latestPastEntry ?? null
}

async function getVisibleCompetitorCampaign() {
    const campaigns = await prisma.campaign.findMany({
        orderBy: {
            startAt: 'asc',
        },
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
        where: {
            archivedAt: null,
            publishedAt: {
                not: null,
            },
            status: {
                in: currentCampaignStatuses,
            },
        },
    })

    return selectVisibleCompetitorCampaign(
        campaigns.flatMap((campaign) => {
            if (!isCompetitorCampaignStatus(campaign.status)) {
                return []
            }

            return [
                {
                    endAt: campaign.endAt,
                    id: campaign.id,
                    name: campaign.name,
                    scoringRules: toCampaignScoringRules(campaign),
                    startAt: campaign.startAt,
                    status: campaign.status,
                    timezone: campaign.timezone,
                } satisfies CompetitorVisibleCampaign,
            ]
        })
    )
}

async function getCompetitorCampaignParticipant(
    userId: string | null,
    campaignId: string
) {
    if (!userId) {
        return null
    }

    const participant = await prisma.campaignParticipant.findFirst({
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
        where: {
            campaignId,
            removedAt: null,
            userId,
        },
    })

    if (
        !participant ||
        !isCompetitorCampaignStatus(participant.campaign.status)
    ) {
        return null
    }

    return {
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
        scoringRules: toCampaignScoringRules(participant.campaign),
        totalAudiobookMinutes: participant.totalAudiobookMinutes,
        totalBooks: participant.totalBooks,
        totalChallenges: participant.totalChallenges,
        totalPages: participant.totalPages,
        totalPoints: participant.totalPoints,
    } satisfies CompetitorCurrentCampaignParticipant
}

function toCompetitorCampaignRecord(
    campaign: CompetitorVisibleCampaign
): CompetitorCampaignRecord {
    return {
        endAt: campaign.endAt,
        id: campaign.id,
        name: campaign.name,
        startAt: campaign.startAt,
        status: campaign.status,
        timezone: campaign.timezone,
    }
}

export function isCompetitorCampaignStatus(
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
