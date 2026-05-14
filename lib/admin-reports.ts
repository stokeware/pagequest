import type {
    InvitationStatus,
    CampaignStatus,
    ReadingEntryType,
} from '@prisma/client'
import { cache } from 'react'

import { rankStandings } from '@/lib/competitor-dashboard'
import { getEffectiveInvitationStatus } from '@/lib/invitation-admin'
import { prisma } from '@/lib/prisma'

export type AdminReportCampaignRecord = {
    createdAt: Date
    endAt: Date
    id: string
    name: string
    startAt: Date
    status: CampaignStatus
    timezone: string
}

export type AdminReportParticipantRecord = {
    createdAt: Date
    id: string
    joinedAt: Date | null
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

export type AdminReportInvitationRecord = {
    acceptedAt: Date | null
    expiresAt: Date
    revokedAt: Date | null
    status: InvitationStatus
}

export type AdminReportEntryRecord = {
    type: ReadingEntryType
    value: number
}

export type AdminReportModerationEntryRecord = {
    activityDate: Date
    bookAuthor: string | null
    bookTitle: string | null
    challengeCompletion: {
        challenge: {
            title: string
        }
    } | null
    createdAt: Date
    id: string
    notes: string | null
    campaignParticipant: {
        user: {
            email: string
            name: string | null
        }
    }
    type: ReadingEntryType
    value: number
}

export type AdminReportAuditRecord = {
    action: string
    actor: {
        email: string
        name: string | null
    } | null
    challenge: {
        title: string
    } | null
    createdAt: Date
    entityType: string
    id: string
    invitation: {
        email: string
    } | null
    metadata: unknown
    campaignParticipant: {
        user: {
            email: string
            name: string | null
        }
    } | null
}

export type AdminReportCampaignOption = {
    href: string
    id: string
    isSelected: boolean
    label: string
    statusLabel: string
}

export type AdminReportSummaryCard = {
    detail: string
    label: string
    value: string
}

export type AdminReportEntryBreakdownRow = {
    entriesLabel: string
    key: string
    label: string
    shareLabel: string
    totalLabel: string
}

export type AdminReportParticipantRow = {
    activityLabel: string
    key: string
    pointsLabel: string
    rankLabel: string
    readerLabel: string
    totalsLabel: string
}

export type AdminReportModerationRow = {
    activityLabel: string
    editHref: string | null
    isEditable: boolean
    isSelected: boolean
    key: string
    noteLabel: string | null
    readerLabel: string
    summaryLabel: string
    typeLabel: string
}

export type AdminReportSelectedModerationEntry = {
    activityDate: string
    bookAuthor: string
    bookTitle: string
    entryId: string
    helperText: string
    isEditable: boolean
    notes: string
    participantLabel: string
    statusMessage: string
    summaryLabel: string
    type: ReadingEntryType
    value: string
}

export type AdminReportAuditRow = {
    actionLabel: string
    actorLabel: string
    detailLabel: string
    key: string
    timestampLabel: string
}

export type AdminReportsViewModel = {
    auditRows: AdminReportAuditRow[]
    entryBreakdownRows: AdminReportEntryBreakdownRow[]
    hasQuest: boolean
    moderationRows: AdminReportModerationRow[]
    participantRows: AdminReportParticipantRow[]
    campaignDescription: string
    campaignName: string
    campaignOptions: AdminReportCampaignOption[]
    campaignStatusLabel: string
    campaignWindowLabel: string
    selectedModerationEntry: AdminReportSelectedModerationEntry | null
    summaryCards: AdminReportSummaryCard[]
}

export type AdminCampaignResultsCsvExport = {
    csv: string
    filename: string
}

export type BuildAdminReportsViewModelInput = {
    auditLogs: AdminReportAuditRecord[]
    availableQuests: AdminReportCampaignRecord[]
    entries: AdminReportEntryRecord[]
    invitations: AdminReportInvitationRecord[]
    moderationEntries: AdminReportModerationEntryRecord[]
    now: Date
    participants: AdminReportParticipantRecord[]
    selectedReadingEntryId: string | null
    selectedCampaignId: string | null
}

type EntryBreakdownTotals = {
    entryCount: number
    totalValue: number
}

const entryTypeOrder: ReadingEntryType[] = [
    'BOOK_COMPLETION',
    'PAGES_READ',
    'AUDIOBOOK_MINUTES',
    'CHALLENGE_COMPLETION',
]

const campaignStatusPriority: Record<CampaignStatus, number> = {
    ACTIVE: 0,
    SCHEDULED: 1,
    COMPLETED: 2,
    ARCHIVED: 3,
    DRAFT: 4,
}

const defaultAdminReportsViewModel: AdminReportsViewModel = {
    auditRows: [],
    entryBreakdownRows: [],
    hasQuest: false,
    moderationRows: [],
    participantRows: [],
    campaignDescription:
        'No campaigns are available for reporting yet. Create or publish a campaign to unlock participation summaries.',
    campaignName: 'No campaign selected',
    campaignOptions: [],
    campaignStatusLabel: 'No reportable campaign',
    campaignWindowLabel:
        'Create a campaign to see participation summaries here.',
    selectedModerationEntry: null,
    summaryCards: [],
}

export { defaultAdminReportsViewModel }

export async function getAdminCampaignResultsCsv(
    selectedCampaignId: string | null
): Promise<AdminCampaignResultsCsvExport | null> {
    const availableQuests = await prisma.campaign.findMany({
        select: {
            createdAt: true,
            endAt: true,
            id: true,
            name: true,
            startAt: true,
            status: true,
            timezone: true,
        },
    })

    const selectedQuest = selectAdminReportQuest(
        availableQuests,
        selectedCampaignId
    )

    if (!selectedQuest) {
        return null
    }

    const participants = await prisma.campaignParticipant.findMany({
        select: {
            createdAt: true,
            id: true,
            joinedAt: true,
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
            campaignId: selectedQuest.id,
            removedAt: null,
        },
    })

    return {
        csv: buildAdminCampaignResultsCsv({
            participants,
            campaign: selectedQuest,
        }),
        filename: buildAdminCampaignResultsFilename(selectedQuest.name),
    }
}

export const getAdminReportsViewModel = cache(
    async (
        selectedCampaignId: string | null,
        selectedReadingEntryId: string | null
    ): Promise<AdminReportsViewModel> => {
        const availableQuests = await prisma.campaign.findMany({
            select: {
                createdAt: true,
                endAt: true,
                id: true,
                name: true,
                startAt: true,
                status: true,
                timezone: true,
            },
        })

        const selectedQuest = selectAdminReportQuest(
            availableQuests,
            selectedCampaignId
        )

        if (!selectedQuest) {
            return defaultAdminReportsViewModel
        }

        const [
            participants,
            invitations,
            entries,
            moderationEntries,
            auditLogs,
        ] = await Promise.all([
            prisma.campaignParticipant.findMany({
                select: {
                    createdAt: true,
                    id: true,
                    joinedAt: true,
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
                    campaignId: selectedQuest.id,
                    removedAt: null,
                },
            }),
            prisma.invitation.findMany({
                select: {
                    acceptedAt: true,
                    expiresAt: true,
                    revokedAt: true,
                    status: true,
                },
                where: {
                    campaignId: selectedQuest.id,
                },
            }),
            prisma.readingEntry.findMany({
                select: {
                    type: true,
                    value: true,
                },
                where: {
                    deletedAt: null,
                    campaignParticipant: {
                        campaignId: selectedQuest.id,
                    },
                },
            }),
            prisma.readingEntry.findMany({
                orderBy: [{ activityDate: 'desc' }, { createdAt: 'desc' }],
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
                        },
                    },
                    createdAt: true,
                    id: true,
                    notes: true,
                    campaignParticipant: {
                        select: {
                            user: {
                                select: {
                                    email: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    type: true,
                    value: true,
                },
                take: 12,
                where: {
                    deletedAt: null,
                    campaignParticipant: {
                        campaignId: selectedQuest.id,
                    },
                },
            }),
            prisma.auditLog.findMany({
                orderBy: {
                    createdAt: 'desc',
                },
                select: {
                    action: true,
                    actor: {
                        select: {
                            email: true,
                            name: true,
                        },
                    },
                    challenge: {
                        select: {
                            title: true,
                        },
                    },
                    createdAt: true,
                    entityType: true,
                    id: true,
                    invitation: {
                        select: {
                            email: true,
                        },
                    },
                    metadata: true,
                    campaignParticipant: {
                        select: {
                            user: {
                                select: {
                                    email: true,
                                    name: true,
                                },
                            },
                        },
                    },
                },
                take: 12,
                where: {
                    campaignId: selectedQuest.id,
                },
            }),
        ])

        return buildAdminReportsViewModel({
            auditLogs,
            availableQuests,
            entries,
            invitations,
            moderationEntries,
            now: new Date(),
            participants,
            selectedReadingEntryId,
            selectedCampaignId,
        })
    }
)

export function buildAdminCampaignResultsCsv({
    participants,
    campaign,
}: {
    participants: AdminReportParticipantRecord[]
    campaign: AdminReportCampaignRecord
}) {
    const rankedParticipants = rankStandings(orderParticipants(participants))
    const header = [
        'campaign_name',
        'campaign_status',
        'campaign_timezone',
        'campaign_start_at',
        'campaign_end_at',
        'rank',
        'reader_name',
        'reader_email',
        'total_points',
        'total_pages',
        'total_audiobook_minutes',
        'total_books',
        'total_challenges',
        'joined_at',
        'last_activity_at',
    ]

    const rows = rankedParticipants.map((participant) => [
        campaign.name,
        getCampaignStatusLabel(campaign.status),
        campaign.timezone,
        campaign.startAt.toISOString(),
        campaign.endAt.toISOString(),
        String(participant.rankNumber),
        participant.user.name ?? '',
        participant.user.email,
        participant.totalPoints.toString(),
        String(participant.totalPages),
        String(participant.totalAudiobookMinutes),
        String(participant.totalBooks),
        String(participant.totalChallenges),
        participant.joinedAt?.toISOString() ?? '',
        participant.lastActivityAt?.toISOString() ?? '',
    ])

    return [header, ...rows]
        .map((row) => row.map(escapeCsvValue).join(','))
        .join('\n')
}

function buildAdminCampaignResultsFilename(campaignName: string) {
    const slug = campaignName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

    return `${slug || 'campaign'}-results.csv`
}

export function buildAdminReportsViewModel({
    auditLogs,
    availableQuests,
    entries,
    invitations,
    moderationEntries,
    now,
    participants,
    selectedReadingEntryId,
    selectedCampaignId,
}: BuildAdminReportsViewModelInput): AdminReportsViewModel {
    const selectedQuest = selectAdminReportQuest(
        availableQuests,
        selectedCampaignId
    )

    if (!selectedQuest) {
        return defaultAdminReportsViewModel
    }

    const activeReaders = participants.filter(
        (participant) => participant.lastActivityAt !== null
    ).length
    const statusCounts = countEffectiveInvitationStatuses(invitations, now)
    const totalEntryCount = entries.length
    const totalPoints = participants.reduce(
        (sum, participant) => sum + Number(participant.totalPoints.toString()),
        0
    )
    const selectedModerationEntry = selectModerationEntry(
        moderationEntries,
        selectedReadingEntryId
    )
    const campaignOptions = sortAdminReportQuests(availableQuests).map(
        (campaign) => ({
            href: `/admin/reports?campaignId=${encodeURIComponent(campaign.id)}`,
            id: campaign.id,
            isSelected: campaign.id === selectedQuest.id,
            label: campaign.name,
            statusLabel: getCampaignStatusLabel(campaign.status),
        })
    )

    return {
        auditRows: buildAuditRows(auditLogs),
        entryBreakdownRows: buildEntryBreakdownRows(entries),
        hasQuest: true,
        moderationRows: buildModerationRows({
            entries: moderationEntries,
            campaignId: selectedQuest.id,
            selectedReadingEntryId: selectedModerationEntry?.id ?? null,
        }),
        participantRows: buildParticipantRows(
            participants,
            selectedQuest.timezone
        ),
        campaignDescription: [
            `${formatCount(participants.length)} readers are on this campaign roster.`,
            `${formatCount(activeReaders)} have logged progress so far.`,
            `${formatCount(totalEntryCount)} ${pluralize('entry', totalEntryCount)} feed this summary.`,
        ].join(' '),
        campaignName: selectedQuest.name,
        campaignOptions,
        campaignStatusLabel: getCampaignStatusLabel(selectedQuest.status),
        campaignWindowLabel: formatCampaignWindowLabel(selectedQuest),
        selectedModerationEntry: selectedModerationEntry
            ? toSelectedModerationEntry(selectedModerationEntry)
            : null,
        summaryCards: [
            {
                detail: formatCampaignWindowLabel(selectedQuest),
                label: 'Campaign status',
                value: getCampaignStatusLabel(selectedQuest.status),
            },
            {
                detail: [
                    `${formatCount(statusCounts.PENDING)} pending`,
                    `${formatCount(statusCounts.EXPIRED)} expired`,
                    `${formatCount(statusCounts.REVOKED)} revoked`,
                ].join(' • '),
                label: 'Accepted invites',
                value: formatCount(statusCounts.ACCEPTED),
            },
            {
                detail: `${formatCount(activeReaders)} readers have logged at least one entry.`,
                label: 'Readers on roster',
                value: formatCount(participants.length),
            },
            {
                detail: `${formatCount(totalEntryCount)} total ${pluralize('entry', totalEntryCount)} across every activity type.`,
                label: 'Logged entries',
                value: formatCount(totalEntryCount),
            },
            {
                detail: 'Competition points currently assigned across all rostered readers.',
                label: 'Total points awarded',
                value: formatPointsFromNumber(totalPoints),
            },
        ],
    }
}

function buildAuditRows(auditLogs: AdminReportAuditRecord[]) {
    return auditLogs.map((auditLog) => ({
        actionLabel: getAuditActionLabel(auditLog.action),
        actorLabel: auditLog.actor
            ? auditLog.actor.name || auditLog.actor.email
            : 'System action',
        detailLabel: getAuditDetailLabel(auditLog),
        key: auditLog.id,
        timestampLabel: formatAuditTimestamp(auditLog.createdAt),
    }))
}

function buildModerationRows({
    entries,
    campaignId,
    selectedReadingEntryId,
}: {
    entries: AdminReportModerationEntryRecord[]
    campaignId: string
    selectedReadingEntryId: string | null
}) {
    return entries.map((entry) => {
        const isEditable = entry.type !== 'CHALLENGE_COMPLETION'

        return {
            activityLabel: formatCalendarDate(entry.activityDate, 'UTC'),
            editHref: isEditable
                ? `/admin/reports?campaignId=${encodeURIComponent(campaignId)}&selectedReadingEntryId=${encodeURIComponent(entry.id)}`
                : null,
            isEditable,
            isSelected: entry.id === selectedReadingEntryId,
            key: entry.id,
            noteLabel: entry.notes ? `Note: ${entry.notes}` : null,
            readerLabel:
                entry.campaignParticipant.user.name ||
                entry.campaignParticipant.user.email,
            summaryLabel: getModerationEntrySummary(entry),
            typeLabel: getModerationEntryTypeLabel(entry),
        }
    })
}

function buildEntryBreakdownRows(entries: AdminReportEntryRecord[]) {
    const totalsByType = initializeEntryBreakdownTotals()
    const totalEntryCount = entries.length

    for (const entry of entries) {
        const currentTotals = totalsByType.get(entry.type)

        if (!currentTotals) {
            continue
        }

        totalsByType.set(entry.type, {
            entryCount: currentTotals.entryCount + 1,
            totalValue: currentTotals.totalValue + entry.value,
        })
    }

    return entryTypeOrder.map((type) => {
        const totals = totalsByType.get(type) ?? {
            entryCount: 0,
            totalValue: 0,
        }

        return {
            entriesLabel: `${formatCount(totals.entryCount)} ${pluralize('entry', totals.entryCount)}`,
            key: type,
            label: getEntryTypeLabel(type),
            shareLabel:
                totalEntryCount > 0
                    ? `${formatPercentage(totals.entryCount / totalEntryCount)} of logged entries`
                    : 'No logged entries yet.',
            totalLabel: formatEntryTypeTotal(type, totals.totalValue),
        }
    })
}

function selectModerationEntry(
    entries: AdminReportModerationEntryRecord[],
    selectedReadingEntryId: string | null
) {
    if (selectedReadingEntryId) {
        const matchingEntry = entries.find(
            (entry) => entry.id === selectedReadingEntryId
        )

        if (matchingEntry) {
            return matchingEntry
        }
    }

    return (
        entries.find((entry) => entry.type !== 'CHALLENGE_COMPLETION') ??
        entries[0] ??
        null
    )
}

function toSelectedModerationEntry(
    entry: AdminReportModerationEntryRecord
): AdminReportSelectedModerationEntry {
    const isEditable = entry.type !== 'CHALLENGE_COMPLETION'

    return {
        activityDate: toDateInputValue(entry.activityDate),
        bookAuthor: entry.bookAuthor ?? '',
        bookTitle: entry.bookTitle ?? '',
        entryId: entry.id,
        helperText: isEditable
            ? 'Corrections update the reader totals immediately after the admin save completes.'
            : 'Challenge completion corrections still run through the challenge review workflow.',
        isEditable,
        notes: entry.notes ?? '',
        participantLabel:
            entry.campaignParticipant.user.name ||
            entry.campaignParticipant.user.email,
        statusMessage: isEditable
            ? 'Standard reading entries can be corrected from this moderation panel.'
            : 'Challenge completion entries are read-only here so review state and awarded points stay consistent.',
        summaryLabel: getModerationEntrySummary(entry),
        type: entry.type,
        value:
            entry.type === 'CHALLENGE_COMPLETION' ? '1' : String(entry.value),
    }
}

function buildParticipantRows(
    participants: AdminReportParticipantRecord[],
    timezone: string
) {
    const rankedParticipants = rankStandings(orderParticipants(participants))

    return rankedParticipants.map((participant) => ({
        activityLabel: [
            participant.joinedAt
                ? `Joined ${formatCalendarDate(participant.joinedAt, timezone)}.`
                : 'No join date recorded.',
            participant.lastActivityAt
                ? `Last activity ${formatCalendarDate(participant.lastActivityAt, timezone)}.`
                : 'No logged activity yet.',
        ].join(' '),
        key: participant.id,
        pointsLabel: formatPoints(participant.totalPoints),
        rankLabel: `#${participant.rankNumber}`,
        readerLabel: participant.user.name || participant.user.email,
        totalsLabel: [
            `${formatCount(participant.totalPages)} pages`,
            `${formatCount(participant.totalAudiobookMinutes)} minutes`,
            `${formatCount(participant.totalBooks)} ${pluralize('book', participant.totalBooks)}`,
            `${formatCount(participant.totalChallenges)} ${pluralize('challenge', participant.totalChallenges)}`,
        ].join(' • '),
    }))
}

function countEffectiveInvitationStatuses(
    invitations: AdminReportInvitationRecord[],
    now: Date
) {
    return invitations.reduce(
        (counts, invitation) => {
            const status = getEffectiveInvitationStatus(invitation, now)

            counts[status] += 1

            return counts
        },
        {
            ACCEPTED: 0,
            EXPIRED: 0,
            PENDING: 0,
            REVOKED: 0,
        } satisfies Record<InvitationStatus, number>
    )
}

function initializeEntryBreakdownTotals() {
    return new Map<ReadingEntryType, EntryBreakdownTotals>(
        entryTypeOrder.map((type) => [
            type,
            {
                entryCount: 0,
                totalValue: 0,
            },
        ])
    )
}

function orderParticipants(participants: AdminReportParticipantRecord[]) {
    return [...participants].sort((left, right) => {
        const pointsDifference =
            Number(right.totalPoints.toString()) -
            Number(left.totalPoints.toString())

        if (pointsDifference !== 0) {
            return pointsDifference
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
    })
}

function selectAdminReportQuest(
    availableQuests: AdminReportCampaignRecord[],
    selectedCampaignId: string | null
) {
    const sortedQuests = sortAdminReportQuests(availableQuests)

    if (selectedCampaignId) {
        const matchingQuest = sortedQuests.find(
            (campaign) => campaign.id === selectedCampaignId
        )

        if (matchingQuest) {
            return matchingQuest
        }
    }

    return sortedQuests[0] ?? null
}

function sortAdminReportQuests(availableQuests: AdminReportCampaignRecord[]) {
    return [...availableQuests].sort((left, right) => {
        const priorityDifference =
            campaignStatusPriority[left.status] -
            campaignStatusPriority[right.status]

        if (priorityDifference !== 0) {
            return priorityDifference
        }

        const startDifference = right.startAt.getTime() - left.startAt.getTime()

        if (startDifference !== 0) {
            return startDifference
        }

        return right.createdAt.getTime() - left.createdAt.getTime()
    })
}

function getEntryTypeLabel(type: ReadingEntryType) {
    switch (type) {
        case 'BOOK_COMPLETION':
            return 'Book completions'
        case 'PAGES_READ':
            return 'Pages logged'
        case 'AUDIOBOOK_MINUTES':
            return 'Audiobook entries'
        case 'CHALLENGE_COMPLETION':
            return 'Challenge submissions'
        default:
            return assertNever(type)
    }
}

function getModerationEntrySummary(entry: AdminReportModerationEntryRecord) {
    if (entry.type === 'CHALLENGE_COMPLETION') {
        return entry.challengeCompletion?.challenge.title
            ? `Challenge completion for ${entry.challengeCompletion.challenge.title}`
            : 'Challenge completion'
    }

    const metadataParts = [entry.bookTitle, entry.bookAuthor]
        .filter((value): value is string => Boolean(value))
        .join(' by ')

    if (entry.type === 'BOOK_COMPLETION') {
        return (
            metadataParts ||
            `${formatCount(entry.value)} completed ${pluralize('book', entry.value)}`
        )
    }

    if (entry.type === 'PAGES_READ') {
        return metadataParts || `${formatCount(entry.value)} pages logged`
    }

    return (
        metadataParts || `${formatCount(entry.value)} audiobook minutes logged`
    )
}

function getModerationEntryTypeLabel(entry: AdminReportModerationEntryRecord) {
    switch (entry.type) {
        case 'BOOK_COMPLETION':
            return `${formatCount(entry.value)} ${pluralize('book', entry.value)}`
        case 'PAGES_READ':
            return `${formatCount(entry.value)} pages`
        case 'AUDIOBOOK_MINUTES':
            return `${formatCount(entry.value)} audiobook minutes`
        case 'CHALLENGE_COMPLETION':
            return entry.challengeCompletion?.challenge.title
                ? `Challenge: ${entry.challengeCompletion.challenge.title}`
                : 'Challenge completion'
        default:
            return assertNever(entry.type)
    }
}

function getAuditActionLabel(action: string) {
    switch (action) {
        case 'challenge-completion.approved':
            return 'Challenge approved'
        case 'challenge-completion.rejected':
            return 'Challenge rejected'
        case 'challenge-completion.submitted':
            return 'Challenge submitted'
        case 'challenge.created':
            return 'Challenge created'
        case 'challenge.deleted':
            return 'Challenge deleted'
        case 'challenge.updated':
            return 'Challenge updated'
        case 'invitation.accepted':
            return 'Invitation accepted'
        case 'invitation.created':
            return 'Invitation created'
        case 'invitation.resent':
            return 'Invitation resent'
        case 'invitation.revoked':
            return 'Invitation revoked'
        case 'campaign.archived':
            return 'Campaign archived'
        case 'campaign.challenge-assigned':
            return 'Campaign challenge assigned'
        case 'campaign.created':
            return 'Campaign created'
        case 'campaign.duplicated':
            return 'Campaign duplicated'
        case 'campaign.published':
            return 'Campaign published'
        case 'campaign.updated':
            return 'Campaign updated'
        case 'reading-entry.admin-updated':
            return 'Entry corrected'
        case 'reading-entry.created':
            return 'Entry created'
        default:
            return action
    }
}

function getAuditDetailLabel(auditLog: AdminReportAuditRecord) {
    const metadata = toMetadataRecord(auditLog.metadata)
    const participantLabel = auditLog.campaignParticipant
        ? auditLog.campaignParticipant.user.name ||
          auditLog.campaignParticipant.user.email
        : null

    switch (auditLog.action) {
        case 'challenge-completion.approved':
        case 'challenge-completion.rejected': {
            const awardedPoints = getStringMetadataValue(
                metadata,
                'awardedPoints'
            )
            const challengeTitle =
                auditLog.challenge?.title ?? 'selected challenge completion'

            return awardedPoints
                ? `${challengeTitle} reviewed for ${awardedPoints} points.`
                : `${challengeTitle} review recorded.`
        }
        case 'challenge-completion.submitted':
            return auditLog.challenge?.title
                ? `${auditLog.challenge.title} entered into the review workflow.`
                : 'Challenge completion submitted for scoring.'
        case 'invitation.accepted':
        case 'invitation.created':
        case 'invitation.resent':
        case 'invitation.revoked': {
            const email =
                auditLog.invitation?.email ??
                getStringMetadataValue(metadata, 'email')

            return email
                ? `Invitation activity for ${email}.`
                : 'Invitation state changed.'
        }
        case 'campaign.challenge-assigned': {
            const challengeTitle = getStringMetadataValue(
                metadata,
                'challengeTitle'
            )

            return challengeTitle
                ? `${challengeTitle} linked to this campaign.`
                : 'A challenge assignment changed for this campaign.'
        }
        case 'reading-entry.admin-updated': {
            const updatedEntry = getNestedMetadataRecord(
                metadata,
                'updatedEntry'
            )
            const type = getStringMetadataValue(updatedEntry, 'type')
            const value = getNumberLikeMetadataValue(updatedEntry, 'value')

            if (type && value) {
                return `${participantLabel ?? 'Participant'} correction saved for ${value} ${formatAuditEntryUnit(type, Number(value))}.`
            }

            return `${participantLabel ?? 'Participant'} reading entry correction saved.`
        }
        case 'reading-entry.created': {
            const type = getStringMetadataValue(metadata, 'type')
            const value = getNumberLikeMetadataValue(metadata, 'value')

            if (type && value) {
                return `${participantLabel ?? 'Participant'} logged ${value} ${formatAuditEntryUnit(type, Number(value))}.`
            }

            return 'A reading entry was logged.'
        }
        default:
            return `${auditLog.entityType} activity recorded for this campaign.`
    }
}

function formatEntryTypeTotal(type: ReadingEntryType, totalValue: number) {
    switch (type) {
        case 'BOOK_COMPLETION':
            return `${formatCount(totalValue)} ${pluralize('book', totalValue)}`
        case 'PAGES_READ':
            return `${formatCount(totalValue)} pages`
        case 'AUDIOBOOK_MINUTES':
            return `${formatCount(totalValue)} audiobook minutes`
        case 'CHALLENGE_COMPLETION':
            return `${formatCount(totalValue)} ${pluralize('completion', totalValue)}`
        default:
            return assertNever(type)
    }
}

function formatCampaignWindowLabel(campaign: AdminReportCampaignRecord) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeZone: campaign.timezone,
    })

    return `${formatter.format(campaign.startAt)} to ${formatter.format(campaign.endAt)} in ${campaign.timezone}`
}

function getCampaignStatusLabel(status: CampaignStatus) {
    switch (status) {
        case 'ACTIVE':
            return 'Active'
        case 'SCHEDULED':
            return 'Scheduled'
        case 'COMPLETED':
            return 'Completed'
        case 'ARCHIVED':
            return 'Archived'
        case 'DRAFT':
            return 'Draft'
        default:
            return assertNever(status)
    }
}

function formatCalendarDate(value: Date, timezone: string) {
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeZone: timezone,
    }).format(value)
}

function formatAuditTimestamp(value: Date) {
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
    }).format(value)
}

function formatCount(value: number) {
    return new Intl.NumberFormat('en-US').format(value)
}

function formatPercentage(value: number) {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 0,
        style: 'percent',
    }).format(value)
}

function formatPoints(value: { toString(): string }) {
    return formatPointsFromNumber(Number(value.toString()))
}

function formatPointsFromNumber(value: number) {
    return `${new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
    }).format(value)} points`
}

function toDateInputValue(value: Date) {
    return value.toISOString().slice(0, 10)
}

function toMetadataRecord(value: unknown) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null
    }

    return value as Record<string, unknown>
}

function getNestedMetadataRecord(
    metadata: Record<string, unknown> | null,
    key: string
) {
    if (!metadata) {
        return null
    }

    return toMetadataRecord(metadata[key])
}

function getStringMetadataValue(
    metadata: Record<string, unknown> | null,
    key: string
) {
    if (!metadata) {
        return null
    }

    const value = metadata[key]

    return typeof value === 'string' && value.length > 0 ? value : null
}

function getNumberLikeMetadataValue(
    metadata: Record<string, unknown> | null,
    key: string
) {
    if (!metadata) {
        return null
    }

    const value = metadata[key]

    if (typeof value === 'number') {
        return String(value)
    }

    return typeof value === 'string' && value.length > 0 ? value : null
}

function formatAuditEntryUnit(type: string, value: number) {
    switch (type) {
        case 'BOOK_COMPLETION':
            return pluralize('book', value)
        case 'PAGES_READ':
            return 'pages'
        case 'AUDIOBOOK_MINUTES':
            return 'minutes'
        case 'CHALLENGE_COMPLETION':
            return pluralize('challenge completion', value)
        default:
            return 'units'
    }
}

function escapeCsvValue(value: string) {
    if (/[",\n]/.test(value)) {
        return `"${value.replaceAll('"', '""')}"`
    }

    return value
}

function pluralize(label: string, value: number) {
    if (value === 1) {
        return label
    }

    if (label.endsWith('y')) {
        return `${label.slice(0, -1)}ies`
    }

    return `${label}s`
}

function assertNever(value: never): never {
    throw new Error(`Unhandled value: ${String(value)}`)
}
