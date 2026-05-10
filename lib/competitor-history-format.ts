import type { ChallengeReviewState, ReadingEntryType } from '@prisma/client'

import { getReadingEntryMetadataSummary } from '@/lib/log-progress'
import {
    calculateEntryPoints,
    type CampaignScoringRules,
} from '@/lib/campaign-domain'

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

export type CompetitorHistoryItem = {
    description: string
    id: string
    note: string | null
    pointsLabel: string
    statusLabel: string | null
    title: string
}

export function formatCompetitorHistoryEntries({
    entries,
    scoringRules,
    timezone,
}: {
    entries: CompetitorHistoryEntryRecord[]
    scoringRules: CampaignScoringRules
    timezone: string
}) {
    return entries.map((entry) =>
        formatCompetitorHistoryEntry({
            entry,
            scoringRules,
            timezone,
        })
    )
}

function formatCompetitorHistoryEntry({
    entry,
    scoringRules,
    timezone,
}: {
    entry: CompetitorHistoryEntryRecord
    scoringRules: CampaignScoringRules
    timezone: string
}): CompetitorHistoryItem {
    const metadataSummary = getReadingEntryMetadataSummary({
        bookAuthor: entry.bookAuthor,
        bookTitle: entry.bookTitle,
    })
    const activityDateLabel = formatCalendarDate(entry.activityDate, timezone)

    switch (entry.type) {
        case 'BOOK_COMPLETION':
            return {
                description: buildHistoryDescription({
                    activityDateLabel,
                    metadataSummary,
                }),
                id: entry.id,
                note: entry.notes,
                pointsLabel: formatPoints(
                    calculateEntryPoints(
                        {
                            activityDate: entry.activityDate,
                            type: entry.type,
                            value: entry.value,
                        },
                        scoringRules
                    )
                ),
                statusLabel: null,
                title: `Book completion · ${formatCount(entry.value)} ${pluralize('book', entry.value)}`,
            }
        case 'PAGES_READ':
            return {
                description: buildHistoryDescription({
                    activityDateLabel,
                    metadataSummary,
                }),
                id: entry.id,
                note: entry.notes,
                pointsLabel: formatPoints(
                    calculateEntryPoints(
                        {
                            activityDate: entry.activityDate,
                            type: entry.type,
                            value: entry.value,
                        },
                        scoringRules
                    )
                ),
                statusLabel: null,
                title: `Pages read · ${formatCount(entry.value)} pages`,
            }
        case 'AUDIOBOOK_MINUTES':
            return {
                description: buildHistoryDescription({
                    activityDateLabel,
                    metadataSummary,
                }),
                id: entry.id,
                note: entry.notes,
                pointsLabel: formatPoints(
                    calculateEntryPoints(
                        {
                            activityDate: entry.activityDate,
                            type: entry.type,
                            value: entry.value,
                        },
                        scoringRules
                    )
                ),
                statusLabel: null,
                title: `Audiobook minutes · ${formatCount(entry.value)} minutes`,
            }
        case 'CHALLENGE_COMPLETION':
            return {
                description: buildHistoryDescription({
                    activityDateLabel,
                    metadataSummary:
                        entry.challengeCompletion?.challenge.title ??
                        metadataSummary,
                }),
                id: entry.id,
                note: entry.challengeCompletion?.evidenceText ?? entry.notes,
                pointsLabel: getChallengePointsLabel(entry, scoringRules),
                statusLabel: getChallengeStatusLabel(
                    entry.challengeCompletion?.reviewState
                ),
                title: entry.challengeCompletion?.challenge.title
                    ? `Challenge completion · ${entry.challengeCompletion.challenge.title}`
                    : 'Challenge completion',
            }
        default:
            return assertNever(entry.type)
    }
}

function buildHistoryDescription({
    activityDateLabel,
    metadataSummary,
}: {
    activityDateLabel: string
    metadataSummary: string | null
}) {
    return metadataSummary
        ? `${metadataSummary}. Logged ${activityDateLabel}.`
        : `Logged ${activityDateLabel}.`
}

function getChallengePointsLabel(
    entry: CompetitorHistoryEntryRecord,
    scoringRules: CampaignScoringRules
) {
    const reviewState = entry.challengeCompletion?.reviewState

    if (reviewState === 'PENDING') {
        return 'Pending review'
    }

    if (reviewState === 'REJECTED') {
        return 'Rejected'
    }

    return formatPoints(
        calculateEntryPoints(
            {
                activityDate: entry.activityDate,
                awardedPoints:
                    entry.challengeCompletion?.awardedPoints?.toString() ??
                    null,
                type: entry.type,
                value: entry.value,
            },
            scoringRules
        )
    )
}

function getChallengeStatusLabel(
    reviewState: ChallengeReviewState | undefined
) {
    switch (reviewState) {
        case 'APPROVED':
            return 'Approved'
        case 'AUTO_APPROVED':
            return 'Auto-approved'
        case 'PENDING':
            return 'Pending review'
        case 'REJECTED':
            return 'Rejected'
        default:
            return null
    }
}

export function formatCalendarDate(value: Date, timezone: string) {
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeZone: timezone,
    }).format(value)
}

export function formatCount(value: number) {
    return new Intl.NumberFormat('en-US').format(value)
}

export function formatPoints(value: { toString(): string }) {
    return `${new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
    }).format(Number(value.toString()))} points`
}

export function pluralize(label: string, value: number) {
    return value === 1 ? label : `${label}s`
}

function assertNever(value: never): never {
    throw new Error(`Unhandled value: ${String(value)}`)
}
