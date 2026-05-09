import { Prisma } from '@prisma/client'
import type { CampaignStatus, ReadingEntryType } from '@prisma/client'

type DecimalValue = Prisma.Decimal | number | string

export interface CampaignScoringRules {
    pointsPerBook: DecimalValue
    pointsPerPage: DecimalValue
    pointsPerAudiobookMinute: DecimalValue
    pointsPerChallengeCompletion: DecimalValue
}

export interface ScoringEntry {
    type: ReadingEntryType
    value: number
    activityDate?: Date
    awardedPoints?: DecimalValue | null
}

export interface ParticipantScoreTotals {
    totalBooks: number
    totalPages: number
    totalAudiobookMinutes: number
    totalChallenges: number
    totalPoints: Prisma.Decimal
    lastActivityAt: Date | null
}

export interface CampaignStatusInput {
    startAt: Date
    endAt: Date
    publishedAt?: Date | null
    archivedAt?: Date | null
    now?: Date
}

export interface CampaignStatusSnapshot extends CampaignStatusInput {
    id: string
    status: CampaignStatus
}

const zeroDecimal = new Prisma.Decimal(0)

export function calculateEntryPoints(
    entry: ScoringEntry,
    scoringRules: CampaignScoringRules
): Prisma.Decimal {
    if (entry.value < 0) {
        throw new Error('Entry value must be zero or greater.')
    }

    switch (entry.type) {
        case 'BOOK_COMPLETION':
            return toDecimal(scoringRules.pointsPerBook).mul(entry.value)
        case 'PAGES_READ':
            return toDecimal(scoringRules.pointsPerPage).mul(entry.value)
        case 'AUDIOBOOK_MINUTES':
            return toDecimal(scoringRules.pointsPerAudiobookMinute).mul(
                entry.value
            )
        case 'CHALLENGE_COMPLETION':
            return entry.awardedPoints == null
                ? toDecimal(scoringRules.pointsPerChallengeCompletion).mul(
                      entry.value
                  )
                : toDecimal(entry.awardedPoints)
        default:
            return assertNever(entry.type)
    }
}

export function calculateParticipantScoreTotals(
    entries: ScoringEntry[],
    scoringRules: CampaignScoringRules
): ParticipantScoreTotals {
    return entries.reduce<ParticipantScoreTotals>((totals, entry) => {
        if (
            entry.activityDate &&
            shouldReplaceLastActivity(totals.lastActivityAt, entry.activityDate)
        ) {
            totals.lastActivityAt = entry.activityDate
        }

        switch (entry.type) {
            case 'BOOK_COMPLETION':
                totals.totalBooks += entry.value
                break
            case 'PAGES_READ':
                totals.totalPages += entry.value
                break
            case 'AUDIOBOOK_MINUTES':
                totals.totalAudiobookMinutes += entry.value
                break
            case 'CHALLENGE_COMPLETION':
                totals.totalChallenges += entry.value
                break
            default:
                assertNever(entry.type)
        }

        totals.totalPoints = totals.totalPoints.plus(
            calculateEntryPoints(entry, scoringRules)
        )

        return totals
    }, createEmptyParticipantScoreTotals())
}

export function deriveCampaignStatus(
    input: CampaignStatusInput
): CampaignStatus {
    assertValidCampaignWindow(input.startAt, input.endAt)

    if (input.archivedAt) {
        return 'ARCHIVED'
    }

    if (!input.publishedAt) {
        return 'DRAFT'
    }

    const now = input.now ?? new Date()

    if (now < input.startAt) {
        return 'SCHEDULED'
    }

    if (now <= input.endAt) {
        return 'ACTIVE'
    }

    return 'COMPLETED'
}

export function getDerivedCampaignStatusUpdate(
    snapshot: CampaignStatusSnapshot,
    now = new Date()
) {
    const derivedStatus = deriveCampaignStatus({
        archivedAt: snapshot.archivedAt,
        endAt: snapshot.endAt,
        now,
        publishedAt: snapshot.publishedAt,
        startAt: snapshot.startAt,
    })

    if (derivedStatus === snapshot.status) {
        return null
    }

    return {
        id: snapshot.id,
        nextStatus: derivedStatus,
        previousStatus: snapshot.status,
    }
}

export function getDerivedCampaignStatusUpdates(
    snapshots: CampaignStatusSnapshot[],
    now = new Date()
) {
    return snapshots.flatMap((snapshot) => {
        const update = getDerivedCampaignStatusUpdate(snapshot, now)

        return update ? [update] : []
    })
}

function createEmptyParticipantScoreTotals(): ParticipantScoreTotals {
    return {
        totalBooks: 0,
        totalPages: 0,
        totalAudiobookMinutes: 0,
        totalChallenges: 0,
        totalPoints: zeroDecimal,
        lastActivityAt: null,
    }
}

function toDecimal(value: DecimalValue): Prisma.Decimal {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value)
}

function shouldReplaceLastActivity(
    currentLastActivity: Date | null,
    candidateActivity: Date
): boolean {
    return (
        currentLastActivity == null || candidateActivity > currentLastActivity
    )
}

function assertValidCampaignWindow(startAt: Date, endAt: Date) {
    if (startAt > endAt) {
        throw new Error('Campaign startAt must be on or before endAt.')
    }
}

function assertNever(value: never): never {
    throw new Error(`Unhandled value: ${String(value)}`)
}
