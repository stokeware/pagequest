import { cache } from 'react'

import {
    type CompetitorCampaignRecord,
    getCompetitorCampaignContext,
    type CompetitorCampaignContextWithScoring,
    type CompetitorCampaignParticipantRecord,
    type CompetitorCampaignStatus,
    type CompetitorRecentEntryRecord,
    type CompetitorWorkspaceCompletedBookRecord,
} from '@/lib/competitor-queries'
import { calculateEntryPoints } from '@/lib/campaign-domain'
import { getReadingEntryMetadataSummary } from '@/lib/log-progress'

export { getCompetitorCampaignContext } from '@/lib/competitor-queries'
export type {
    CompetitorCampaignContext,
    CompetitorCampaignParticipantRecord,
    CompetitorCampaignStatus,
    CompetitorRecentEntryRecord,
    CompetitorStandingRecord,
} from '@/lib/competitor-queries'

type DashboardSnapshotCard = {
    description: string
    title: string
    value: string
}

type DashboardSummaryMetric = {
    detail: string
    label: string
    value: string
}

type DashboardRecentActivityItem = {
    challengeLabel: string | null
    completedAtLabel: string
    id: string
    isViewer: boolean
    pointsLabel: string
    progressLabel: string
    readerLabel: string | null
    title: string
}

export type { DashboardRecentActivityItem, DashboardSnapshotCard }

type DashboardShellMetric = {
    detail: string
    label: string
    value: string
}

export type CompetitorDashboardViewModel = {
    hasQuest: boolean
    participantSummary: string
    campaignName: string
    campaignStatusLabel: string
    recentActivity: DashboardRecentActivityItem[]
    shellMetrics: DashboardShellMetric[]
    snapshotCards: DashboardSnapshotCard[]
    summaryMetrics: DashboardSummaryMetric[]
}

type StandingComparable = {
    createdAt: Date
    id: string
    totalAudiobookMinutes: number
    totalBooks: number
    totalPages: number
    totalPoints: { toString(): string }
}

const defaultParticipantSummary =
    'No active campaign participation is linked to this account yet. Your dashboard will fill in once an invitation connects you to a campaign.'

const emptyShellMetrics: DashboardShellMetric[] = [
    {
        detail: 'A campaign invite will unlock timing details here.',
        label: 'Active campaign',
        value: 'Pending',
    },
    {
        detail: 'Current rank appears after your first campaign is linked.',
        label: 'Current standing',
        value: 'Unranked',
    },
    {
        detail: 'Recent reading totals will appear after your first entry.',
        label: 'Recent activity',
        value: 'No entries yet',
    },
]

export const defaultCompetitorDashboardViewModel: CompetitorDashboardViewModel =
    {
        hasQuest: false,
        participantSummary: defaultParticipantSummary,
        campaignName: 'Campaign assignment pending',
        campaignStatusLabel: 'Awaiting invitation',
        recentActivity: [],
        shellMetrics: emptyShellMetrics,
        snapshotCards: [],
        summaryMetrics: [],
    }

export const getCompetitorDashboardViewModel = cache(
    async (userId: string | null): Promise<CompetitorDashboardViewModel> => {
        const context = await getCompetitorCampaignContext(userId)

        if (!context) {
            return defaultCompetitorDashboardViewModel
        }

        return buildCompetitorDashboardViewModel(context, new Date())
    }
)

export function buildCompetitorDashboardViewModel(
    selection: CompetitorCampaignContextWithScoring | null,
    now: Date
): CompetitorDashboardViewModel {
    if (!selection) {
        return defaultCompetitorDashboardViewModel
    }

    if (!selection.participant) {
        return buildCampaignVisibilityDashboardViewModel(selection, now)
    }

    const { participant, recentEntries, scoringRules, standings } = selection
    const rankedStandings = rankStandings(standings)
    const workspaceRecentActivity = buildWorkspaceCompletedBookActivityItems({
        completions: rankedStandings.flatMap(
            (standing) => standing.workspaceCompletedBooks ?? []
        ),
        timezone: participant.campaign.timezone,
        viewerParticipantId: participant.id,
    })
    const recentActivity =
        workspaceRecentActivity.length > 0
            ? workspaceRecentActivity
            : buildCompletedBookActivityItems({
                  entries: recentEntries,
                  isViewer: true,
                  scoringRules,
                  timezone: participant.campaign.timezone,
              })
    const participantStanding = rankedStandings.find(
        (entry) => entry.id === participant.id
    )
    const rankNumber = participantStanding?.rankNumber ?? null
    const leader = rankedStandings[0] ?? null
    const participantPoints = toDisplayNumber(participant.totalPoints)
    const leaderPoints = leader ? toDisplayNumber(leader.totalPoints) : 0
    const pointsBehindLeader = Math.max(leaderPoints - participantPoints, 0)
    const snapshotCards = buildDashboardSnapshotCards({
        pointsBehindLeader,
        rankNumber,
        totals: participant,
    })

    return {
        hasQuest: true,
        participantSummary: getParticipantSummary(participant),
        campaignName: participant.campaign.name,
        campaignStatusLabel: getCampaignStatusLabel(
            participant.campaign.status
        ),
        recentActivity,
        shellMetrics: [
            {
                detail: getShellCampaignDetail(participant.campaign, now),
                label: 'Active campaign',
                value: participant.campaign.name,
            },
            {
                detail: snapshotCards[0].description,
                label: 'Current standing',
                value: snapshotCards[0].value,
            },
            {
                detail:
                    recentActivity[0]?.completedAtLabel ??
                    'Finish a book to start building your recent activity list.',
                label: 'Recent activity',
                value: recentActivity[0]?.title ?? 'No completed books yet',
            },
        ],
        snapshotCards,
        summaryMetrics: [],
    }
}

function buildCampaignVisibilityDashboardViewModel(
    selection: CompetitorCampaignContextWithScoring,
    now: Date
): CompetitorDashboardViewModel {
    return {
        hasQuest: true,
        participantSummary: getCampaignVisibilitySummary(selection.campaign),
        campaignName: selection.campaign.name,
        campaignStatusLabel: getCampaignStatusLabel(selection.campaign.status),
        recentActivity: [],
        shellMetrics: [
            {
                detail: getShellCampaignDetail(selection.campaign, now),
                label: 'Active campaign',
                value: selection.campaign.name,
            },
            {
                detail:
                    selection.standings.length > 0
                        ? `${formatCount(selection.standings.length)} readers are already on the board.`
                        : 'No readers are on the board yet.',
                label: 'Current standing',
                value: 'Unranked',
            },
            {
                detail: 'Your recent reading will appear after this campaign is linked to your account.',
                label: 'Recent activity',
                value: 'No personal activity yet',
            },
        ],
        snapshotCards: [
            {
                description:
                    'Join this campaign to claim a ranked spot on the leaderboard.',
                title: 'Current rank',
                value: 'Unranked',
            },
            {
                description:
                    'Your totals will appear after this campaign is linked to your account.',
                title: 'Total points',
                value: '0 points',
            },
        ],
        summaryMetrics: [],
    }
}

function getParticipantSummary(
    participant: CompetitorCampaignParticipantRecord
) {
    const lastActivity = participant.lastActivityAt
        ? `Last activity ${formatActivityDate(participant.lastActivityAt, participant.campaign.timezone)}.`
        : 'Your first entry will set the pace for this campaign.'

    switch (participant.campaign.status) {
        case 'ACTIVE':
            return `${participant.campaign.name} is live. ${lastActivity}`
        case 'SCHEDULED':
            return `${participant.campaign.name} has not opened yet. Use this dashboard to plan your first push.`
        case 'COMPLETED':
            return `${participant.campaign.name} has wrapped up. ${lastActivity}`
        default:
            return assertNever(participant.campaign.status)
    }
}

function getCampaignVisibilitySummary(campaign: CompetitorCampaignRecord) {
    switch (campaign.status) {
        case 'ACTIVE':
            return `${campaign.name} is live. Your account is not linked to this campaign yet.`
        case 'SCHEDULED':
            return `${campaign.name} has not opened yet. Your account is not linked to this campaign yet.`
        case 'COMPLETED':
            return `${campaign.name} has wrapped up. Your account is not linked to this campaign.`
        default:
            return assertNever(campaign.status)
    }
}

function getCampaignStatusLabel(status: CompetitorCampaignStatus) {
    switch (status) {
        case 'ACTIVE':
            return 'Active campaign'
        case 'SCHEDULED':
            return 'Scheduled campaign'
        case 'COMPLETED':
            return 'Completed campaign'
        default:
            return assertNever(status)
    }
}

export function buildDashboardSnapshotCards({
    pointsBehindLeader,
    rankNumber,
    totals,
}: {
    pointsBehindLeader: number
    rankNumber: number | null
    totals: Pick<
        CompetitorCampaignParticipantRecord,
        | 'totalAudiobookMinutes'
        | 'totalBooks'
        | 'totalChallenges'
        | 'totalPages'
        | 'totalPoints'
    >
}) {
    return [
        {
            description: getRankDescription({
                pointsBehindLeader,
                rankNumber,
            }),
            title: 'Current rank',
            value: rankNumber ? `#${rankNumber}` : 'Unranked',
        },
        {
            description: getPointsDescription(totals),
            title: 'Total points',
            value: formatPoints(totals.totalPoints),
        },
    ] satisfies DashboardSnapshotCard[]
}

function getPointsDescription(
    participant: Pick<
        CompetitorCampaignParticipantRecord,
        | 'totalAudiobookMinutes'
        | 'totalBooks'
        | 'totalChallenges'
        | 'totalPages'
    >
) {
    const parts = [
        `${formatCount(participant.totalPages)} pages`,
        `${formatCount(participant.totalAudiobookMinutes)} audiobook minutes`,
    ]

    if (participant.totalBooks > 0) {
        parts.push(
            `${formatCount(participant.totalBooks)} ${pluralize('book', participant.totalBooks)}`
        )
    }

    if (participant.totalChallenges > 0) {
        parts.push(
            `${formatCount(participant.totalChallenges)} ${pluralize('challenge', participant.totalChallenges)}`
        )
    }

    return parts.join(' • ')
}

function getRankDescription({
    pointsBehindLeader,
    rankNumber,
}: {
    pointsBehindLeader: number
    rankNumber: number | null
}) {
    if (!rankNumber) {
        return 'Leaderboard placement appears after this campaign has active participants.'
    }

    return `${formatPointsFromNumber(pointsBehindLeader)} behind first place.`
}

function getShellCampaignDetail(campaign: CompetitorCampaignRecord, now: Date) {
    switch (campaign.status) {
        case 'ACTIVE':
            return `${getDurationLabel(campaign.endAt, now)} remaining`
        case 'SCHEDULED':
            return `Starts in ${getDurationLabel(campaign.startAt, now).toLowerCase()}`
        case 'COMPLETED':
            return `Ended ${formatBoundaryDate(campaign.endAt, campaign.timezone)}`
        default:
            return assertNever(campaign.status)
    }
}

export function buildCompletedBookActivityItems({
    entries,
    isViewer = false,
    scoringRules,
    timezone,
}: {
    entries: CompetitorRecentEntryRecord[]
    isViewer?: boolean
    scoringRules: CompetitorCampaignContextWithScoring['scoringRules']
    timezone: string
}) {
    const completionEntries = entries.filter(
        (entry) => entry.type === 'BOOK_COMPLETION'
    )

    return completionEntries.map((entry) =>
        toCompletedBookActivityItem({
            allEntries: entries,
            completionEntries,
            entry,
            isViewer,
            scoringRules,
            timezone,
        })
    )
}

export function buildWorkspaceCompletedBookActivityItems({
    completions,
    timezone,
    viewerParticipantId,
}: {
    completions: CompetitorWorkspaceCompletedBookRecord[]
    timezone: string
    viewerParticipantId: string | null
}) {
    return [...completions]
        .sort(
            (left, right) =>
                right.activityDate.getTime() - left.activityDate.getTime()
        )
        .slice(0, 10)
        .map((completion) => ({
            challengeLabel: completion.challengeLabel,
            completedAtLabel: formatRecentActivityDate(
                completion.activityDate,
                timezone
            ),
            id: completion.id,
            isViewer: completion.participantId === viewerParticipantId,
            pointsLabel: formatPointsFromNumber(completion.pointsAwarded),
            progressLabel: getCompletedBookProgressLabel({
                totalMinutes: completion.totalAudiobookMinutes,
                totalPages: completion.totalPages,
            }),
            readerLabel: completion.readerLabel,
            title: completion.title,
        }))
}

function toCompletedBookActivityItem({
    allEntries,
    completionEntries,
    entry,
    isViewer,
    scoringRules,
    timezone,
}: {
    allEntries: CompetitorRecentEntryRecord[]
    completionEntries: CompetitorRecentEntryRecord[]
    entry: CompetitorRecentEntryRecord
    isViewer: boolean
    scoringRules: CompetitorCampaignContextWithScoring['scoringRules']
    timezone: string
}): DashboardRecentActivityItem {
    const previousCompletionBoundary = getPreviousCompletionBoundary({
        completionEntries,
        entry,
    })
    const relatedEntries = getRelatedBookProgressEntries({
        allEntries,
        entry,
        previousCompletionBoundary,
    })
    const totalPages = relatedEntries
        .filter((relatedEntry) => relatedEntry.type === 'PAGES_READ')
        .reduce((sum, relatedEntry) => sum + relatedEntry.value, 0)
    const totalMinutes = relatedEntries
        .filter((relatedEntry) => relatedEntry.type === 'AUDIOBOOK_MINUTES')
        .reduce((sum, relatedEntry) => sum + relatedEntry.value, 0)
    const pointsAchieved = relatedEntries.reduce(
        (total, relatedEntry) =>
            total.plus(calculateEntryPoints(relatedEntry, scoringRules)),
        calculateEntryPoints(entry, scoringRules)
    )

    return {
        challengeLabel: entry.challengeCompletion?.challenge.title ?? null,
        completedAtLabel: formatRecentActivityDate(
            entry.activityDate,
            timezone
        ),
        id: entry.id,
        isViewer,
        pointsLabel: formatPoints(pointsAchieved),
        progressLabel: getCompletedBookProgressLabel({
            totalMinutes,
            totalPages,
        }),
        readerLabel: null,
        title: getCompletedBookTitle(entry),
    }
}

function getPreviousCompletionBoundary({
    completionEntries,
    entry,
}: {
    completionEntries: CompetitorRecentEntryRecord[]
    entry: CompetitorRecentEntryRecord
}) {
    const bookKey = getReadingEntryBookKey(entry)

    if (!bookKey) {
        return null
    }

    return (
        completionEntries.find((completionEntry) => {
            if (completionEntry.id === entry.id) {
                return false
            }

            return (
                getReadingEntryBookKey(completionEntry) === bookKey &&
                completionEntry.activityDate < entry.activityDate
            )
        })?.activityDate ?? null
    )
}

function getRelatedBookProgressEntries({
    allEntries,
    entry,
    previousCompletionBoundary,
}: {
    allEntries: CompetitorRecentEntryRecord[]
    entry: CompetitorRecentEntryRecord
    previousCompletionBoundary: Date | null
}) {
    const bookKey = getReadingEntryBookKey(entry)

    if (!bookKey) {
        return []
    }

    return allEntries.filter((candidateEntry) => {
        if (
            candidateEntry.type !== 'PAGES_READ' &&
            candidateEntry.type !== 'AUDIOBOOK_MINUTES'
        ) {
            return false
        }

        if (getReadingEntryBookKey(candidateEntry) !== bookKey) {
            return false
        }

        if (candidateEntry.activityDate > entry.activityDate) {
            return false
        }

        if (
            previousCompletionBoundary &&
            candidateEntry.activityDate <= previousCompletionBoundary
        ) {
            return false
        }

        return true
    })
}

function getCompletedBookTitle(entry: CompetitorRecentEntryRecord) {
    return (
        entry.bookTitle?.trim() ||
        getReadingEntryMetadataSummary({
            bookAuthor: entry.bookAuthor,
            bookTitle: entry.bookTitle,
        }) ||
        'Completed book'
    )
}

function getCompletedBookProgressLabel({
    totalMinutes,
    totalPages,
}: {
    totalMinutes: number
    totalPages: number
}) {
    if (totalPages > 0) {
        return `${formatCount(totalPages)} ${pluralize('page', totalPages)}`
    }

    if (totalMinutes > 0) {
        return `${formatCount(totalMinutes)} ${pluralize('minute', totalMinutes)}`
    }

    return 'No page or minute totals linked'
}

function getReadingEntryBookKey(entry: CompetitorRecentEntryRecord) {
    const normalizedTitle = entry.bookTitle?.trim().toLowerCase() ?? ''
    const normalizedAuthor = entry.bookAuthor?.trim().toLowerCase() ?? ''

    if (!normalizedTitle && !normalizedAuthor) {
        return null
    }

    return `${normalizedTitle}::${normalizedAuthor}`
}

function getDurationLabel(target: Date, now: Date) {
    const diffMilliseconds = target.getTime() - now.getTime()

    if (diffMilliseconds <= 0) {
        return 'Less than 1 day'
    }

    const totalHours = Math.ceil(diffMilliseconds / (1000 * 60 * 60))

    if (totalHours < 24) {
        return `${formatCount(totalHours)} ${pluralize('hour', totalHours)}`
    }

    const totalDays = Math.ceil(totalHours / 24)

    return `${formatCount(totalDays)} ${pluralize('day', totalDays)}`
}

function formatActivityDate(value: Date, timezone: string) {
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeZone: timezone,
    }).format(value)
}

function formatRecentActivityDate(value: Date, timezone: string) {
    return new Intl.DateTimeFormat('en-US', {
        day: 'numeric',
        month: 'short',
        timeZone: timezone,
    }).format(value)
}

function formatBoundaryDate(value: Date, timezone: string) {
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: timezone,
    }).format(value)
}

function formatCount(value: number) {
    return new Intl.NumberFormat('en-US').format(value)
}

function formatPoints(value: { toString(): string }) {
    return formatPointsFromNumber(toDisplayNumber(value))
}

function formatPointsFromNumber(value: number) {
    return `${new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
    }).format(value)} points`
}

export function rankStandings<T extends StandingComparable>(standings: T[]) {
    return standings.map((standing, index) => ({
        ...standing,
        rankNumber:
            index > 0 && areStandingsTied(standings[index - 1], standing)
                ? standingsRankNumberAt(index - 1, standings)
                : index + 1,
    }))
}

function pluralize(label: string, value: number) {
    return value === 1 ? label : `${label}s`
}

function areStandingsTied(
    previousStanding: StandingComparable,
    nextStanding: StandingComparable
) {
    return (
        previousStanding.totalPoints.toString() ===
            nextStanding.totalPoints.toString() &&
        previousStanding.totalPages === nextStanding.totalPages &&
        previousStanding.totalAudiobookMinutes ===
            nextStanding.totalAudiobookMinutes &&
        previousStanding.totalBooks === nextStanding.totalBooks
    )
}

function standingsRankNumberAt(index: number, standings: StandingComparable[]) {
    const rankedStandings = standings
        .slice(0, index + 1)
        .map((standing, standingIndex) => ({
            ...standing,
            rankNumber:
                standingIndex > 0 &&
                areStandingsTied(
                    standings[standingIndex - 1],
                    standings[standingIndex]
                )
                    ? 0
                    : standingIndex + 1,
        }))

    for (
        let currentIndex = rankedStandings.length - 1;
        currentIndex >= 0;
        currentIndex -= 1
    ) {
        const rankNumber = rankedStandings[currentIndex]?.rankNumber ?? 0

        if (rankNumber > 0) {
            return rankNumber
        }
    }

    return index + 1
}

function toDisplayNumber(value: { toString(): string }) {
    return Number(value.toString())
}

function assertNever(value: never): never {
    throw new Error(`Unhandled value: ${String(value)}`)
}
