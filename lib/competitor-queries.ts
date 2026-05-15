import type {
    ChallengeReviewState,
    CampaignStatus,
    ReadingEntryType,
} from '@prisma/client'
import { cache } from 'react'

import {
    calculateCampaignWorkspaceRowPoints,
    calculateCampaignWorkspaceTotals,
    campaignWorkspaceAuditAction,
    getCompletedCampaignWorkspaceBooks,
    parseCampaignWorkspaceState,
    type CampaignWorkspaceChallenge,
} from '@/lib/campaign-workspace'
import {
    resolveChallengePageMinuteMultiplier,
    resolveChallengePointValue,
} from '@/lib/challenge-config'
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
    workspaceCompletedBooks?: CompetitorWorkspaceCompletedBookRecord[]
}

export type CompetitorWorkspaceCompletedBookRecord = {
    activityDate: Date
    challengeLabel: string | null
    id: string
    participantId: string
    pointsAwarded: number
    readerLabel: string
    totalAudiobookMinutes: number
    totalPages: number
    title: string
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
    challenges: CampaignWorkspaceChallenge[]
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
            visibleCampaign
        )

        const [standings, recentEntries] = await Promise.all([
            getCampaignStandings(visibleCampaign),
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
            challenges: {
                select: {
                    id: true,
                    kind: true,
                    pageMinuteMultiplier: true,
                    pointValue: true,
                    title: true,
                    templateChallenge: {
                        select: {
                            pageMinuteMultiplier: true,
                            pointValue: true,
                        },
                    },
                },
                where: {
                    isActive: true,
                },
            },
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
                    challenges: campaign.challenges.map((challenge) => ({
                        id: challenge.id,
                        pageMinuteMultiplier: Number(
                            resolveChallengePageMinuteMultiplier(challenge)
                        ),
                        pointValue: Number(
                            resolveChallengePointValue(challenge)
                        ),
                        title: challenge.title,
                    })),
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
    campaign: CompetitorVisibleCampaign
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
            auditLogs: {
                orderBy: {
                    createdAt: 'desc',
                },
                select: {
                    createdAt: true,
                    metadata: true,
                },
                take: 1,
                where: {
                    action: campaignWorkspaceAuditAction,
                },
            },
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
            campaignId: campaign.id,
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

    const derivedMetrics = resolveParticipantProgressMetrics(
        participant,
        campaign
    )

    return {
        createdAt: participant.createdAt,
        id: participant.id,
        joinedAt: participant.joinedAt,
        lastActivityAt: derivedMetrics.lastActivityAt,
        campaign: {
            endAt: participant.campaign.endAt,
            id: participant.campaign.id,
            name: participant.campaign.name,
            startAt: participant.campaign.startAt,
            status: participant.campaign.status,
            timezone: participant.campaign.timezone,
        },
        scoringRules: toCampaignScoringRules(participant.campaign),
        totalAudiobookMinutes: derivedMetrics.totalAudiobookMinutes,
        totalBooks: derivedMetrics.totalBooks,
        totalChallenges: derivedMetrics.totalChallenges,
        totalPages: derivedMetrics.totalPages,
        totalPoints: derivedMetrics.totalPoints,
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

async function getCampaignStandings(campaign: CompetitorVisibleCampaign) {
    const participants = await prisma.campaignParticipant.findMany({
        orderBy: standingsOrderBy,
        select: {
            auditLogs: {
                orderBy: {
                    createdAt: 'desc',
                },
                select: {
                    createdAt: true,
                    metadata: true,
                },
                take: 1,
                where: {
                    action: campaignWorkspaceAuditAction,
                },
            },
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
            campaignId: campaign.id,
            removedAt: null,
        },
    })

    return participants
        .map((participant) => {
            const derivedMetrics = resolveParticipantProgressMetrics(
                participant,
                campaign
            )

            return {
                createdAt: participant.createdAt,
                id: participant.id,
                lastActivityAt: derivedMetrics.lastActivityAt,
                totalAudiobookMinutes: derivedMetrics.totalAudiobookMinutes,
                totalBooks: derivedMetrics.totalBooks,
                totalChallenges: derivedMetrics.totalChallenges,
                totalPages: derivedMetrics.totalPages,
                totalPoints: derivedMetrics.totalPoints,
                user: participant.user,
                workspaceCompletedBooks: getWorkspaceCompletedBooks({
                    campaign,
                    latestWorkspaceAudit: participant.auditLogs[0] ?? null,
                    participantId: participant.id,
                    readerLabel:
                        participant.user.name || participant.user.email,
                }),
            }
        })
        .sort(compareStandings)
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

function resolveParticipantProgressMetrics(
    participant: {
        auditLogs: Array<{
            createdAt: Date
            metadata: unknown
        }>
        lastActivityAt: Date | null
        totalAudiobookMinutes: number
        totalBooks: number
        totalChallenges: number
        totalPages: number
        totalPoints: { toString(): string }
    },
    campaign?: CompetitorVisibleCampaign
) {
    const latestWorkspaceAudit = participant.auditLogs[0]

    if (!latestWorkspaceAudit || !campaign) {
        return {
            lastActivityAt: participant.lastActivityAt,
            totalAudiobookMinutes: participant.totalAudiobookMinutes,
            totalBooks: participant.totalBooks,
            totalChallenges: participant.totalChallenges,
            totalPages: participant.totalPages,
            totalPoints: participant.totalPoints,
        }
    }

    const workspaceTotals = calculateCampaignWorkspaceTotals({
        campaignChallenges: campaign.challenges,
        pointsPerBook: Number(campaign.scoringRules.pointsPerBook),
        pointsPerMinute: Number(campaign.scoringRules.pointsPerAudiobookMinute),
        pointsPerPage: Number(campaign.scoringRules.pointsPerPage),
        workspaceState: parseCampaignWorkspaceState(
            latestWorkspaceAudit.metadata
        ),
    })

    if (!workspaceTotals.hasMeaningfulProgress) {
        return {
            lastActivityAt: participant.lastActivityAt,
            totalAudiobookMinutes: participant.totalAudiobookMinutes,
            totalBooks: participant.totalBooks,
            totalChallenges: participant.totalChallenges,
            totalPages: participant.totalPages,
            totalPoints: participant.totalPoints,
        }
    }

    return {
        lastActivityAt: latestWorkspaceAudit.createdAt,
        totalAudiobookMinutes: workspaceTotals.totalAudiobookMinutes,
        totalBooks: workspaceTotals.totalBooks,
        totalChallenges: workspaceTotals.totalChallenges,
        totalPages: workspaceTotals.totalPages,
        totalPoints: workspaceTotals.totalPoints,
    }
}

function getWorkspaceCompletedBooks({
    campaign,
    latestWorkspaceAudit,
    participantId,
    readerLabel,
}: {
    campaign: CompetitorVisibleCampaign
    latestWorkspaceAudit: {
        createdAt: Date
        metadata: unknown
    } | null
    participantId: string
    readerLabel: string
}) {
    if (!latestWorkspaceAudit) {
        return []
    }

    const workspaceState = parseCampaignWorkspaceState(
        latestWorkspaceAudit.metadata
    )

    return getCompletedCampaignWorkspaceBooks(workspaceState).map((book) => {
        const challenge = campaign.challenges.find(
            (candidate) => candidate.id === book.challengeId
        )

        return {
            activityDate: book.completedAt ?? latestWorkspaceAudit.createdAt,
            challengeLabel: challenge ? getChallengeLabel(challenge) : null,
            id: `${participantId}:${book.id}`,
            participantId,
            pointsAwarded: calculateCampaignWorkspaceRowPoints({
                campaignChallenges: campaign.challenges,
                pointsPerBook: Number(campaign.scoringRules.pointsPerBook),
                pointsPerMinute: Number(
                    campaign.scoringRules.pointsPerAudiobookMinute
                ),
                pointsPerPage: Number(campaign.scoringRules.pointsPerPage),
                row: {
                    bookName: book.title,
                    challengeId: book.challengeId,
                    completed: true,
                    id: book.id,
                    minutes: String(book.minutes),
                    pages: String(book.pages),
                    rowType: 'STANDARD',
                },
            }),
            readerLabel,
            totalAudiobookMinutes: book.minutes,
            totalPages: book.pages,
            title: book.title,
        } satisfies CompetitorWorkspaceCompletedBookRecord
    })
}

function getChallengeLabel(challenge: CampaignWorkspaceChallenge) {
    return challenge.title || null
}

function compareStandings(
    left: CompetitorStandingRecord,
    right: CompetitorStandingRecord
) {
    const pointsDelta =
        Number(right.totalPoints.toString()) -
        Number(left.totalPoints.toString())

    if (pointsDelta !== 0) {
        return pointsDelta
    }

    if (right.totalPages !== left.totalPages) {
        return right.totalPages - left.totalPages
    }

    if (right.totalAudiobookMinutes !== left.totalAudiobookMinutes) {
        return right.totalAudiobookMinutes - left.totalAudiobookMinutes
    }

    if (right.totalBooks !== left.totalBooks) {
        return right.totalBooks - left.totalBooks
    }

    return left.createdAt.getTime() - right.createdAt.getTime()
}
