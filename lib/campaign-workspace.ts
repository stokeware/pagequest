import { Prisma } from '@prisma/client'

export const campaignWorkspaceAuditAction =
    'campaign-participant.workspace-saved'

export type PersistedProgressRow = {
    bookName: string
    challengeId: string
    completed: boolean
    id: string
    minutes: string
    pages: string
    rowType: 'PERSONAL_GOAL' | 'STANDARD'
}

export type CampaignWorkspaceState = {
    personalGoalTitle: string
    progressRows: PersistedProgressRow[]
    recommendationTitle: string
}

export type CampaignWorkspaceChallenge = {
    id: string
    pageMinuteMultiplier: number
    pointValue: number
}

export type CampaignWorkspaceTotals = {
    hasMeaningfulProgress: boolean
    totalAudiobookMinutes: number
    totalBooks: number
    totalChallenges: number
    totalPages: number
    totalPoints: Prisma.Decimal
}

const zeroDecimal = new Prisma.Decimal(0)

export const emptyCampaignWorkspaceState: CampaignWorkspaceState = {
    personalGoalTitle: '',
    progressRows: [],
    recommendationTitle: '',
}

export function parseCampaignWorkspaceState(
    metadata: unknown
): CampaignWorkspaceState {
    if (!isRecord(metadata)) {
        return emptyCampaignWorkspaceState
    }

    const progressRows = Array.isArray(metadata.progressRows)
        ? metadata.progressRows.flatMap((row, index) => {
              if (!isRecord(row)) {
                  return []
              }

              return [
                  {
                      bookName: getStringValue(row.bookName),
                      challengeId: getStringValue(row.challengeId),
                      completed: getBooleanValue(row.completed),
                      id: getStringValue(row.id) || `progress-row-${index + 1}`,
                      minutes: getStringValue(row.minutes),
                      pages: getStringValue(row.pages),
                      rowType:
                          getStringValue(row.rowType) === 'PERSONAL_GOAL'
                              ? ('PERSONAL_GOAL' as const)
                              : ('STANDARD' as const),
                  },
              ]
          })
        : []

    return {
        personalGoalTitle:
            getStringValue(metadata.personalGoalTitle) ||
            getStringValue(metadata.epicReadTitle),
        progressRows,
        recommendationTitle: getStringValue(metadata.recommendationTitle),
    }
}

export function calculateCampaignWorkspaceRowPoints({
    campaignChallenges,
    pointsPerMinute,
    pointsPerPage,
    row,
}: {
    campaignChallenges: CampaignWorkspaceChallenge[]
    pointsPerMinute: number
    pointsPerPage: number
    row: PersistedProgressRow
}) {
    const pages = toNonNegativeNumber(row.pages)
    const minutes = toNonNegativeNumber(row.minutes)
    const basePoints = pages * pointsPerPage + minutes * pointsPerMinute
    const selectedChallenge = campaignChallenges.find(
        (challenge) => challenge.id === row.challengeId
    )

    if (!row.completed || !selectedChallenge) {
        return basePoints
    }

    if (selectedChallenge.pageMinuteMultiplier > 0) {
        return basePoints * selectedChallenge.pageMinuteMultiplier
    }

    return basePoints + selectedChallenge.pointValue
}

export function calculateCampaignWorkspaceTotals({
    campaignChallenges,
    pointsPerMinute,
    pointsPerPage,
    workspaceState,
}: {
    campaignChallenges: CampaignWorkspaceChallenge[]
    pointsPerMinute: number
    pointsPerPage: number
    workspaceState: CampaignWorkspaceState
}): CampaignWorkspaceTotals {
    const meaningfulRows = workspaceState.progressRows.filter(
        isMeaningfulProgressRow
    )
    const challengeIds = new Set(
        meaningfulRows.flatMap((row) =>
            row.completed && row.challengeId ? [row.challengeId] : []
        )
    )

    return {
        hasMeaningfulProgress: meaningfulRows.length > 0,
        totalAudiobookMinutes: meaningfulRows.reduce(
            (sum, row) => sum + toNonNegativeNumber(row.minutes),
            0
        ),
        totalBooks: meaningfulRows.filter(isCompletedBookRow).length,
        totalChallenges: challengeIds.size,
        totalPages: meaningfulRows.reduce(
            (sum, row) => sum + toNonNegativeNumber(row.pages),
            0
        ),
        totalPoints: meaningfulRows.reduce(
            (sum, row) =>
                sum.plus(
                    calculateCampaignWorkspaceRowPoints({
                        campaignChallenges,
                        pointsPerMinute,
                        pointsPerPage,
                        row,
                    })
                ),
            zeroDecimal
        ),
    }
}

function isMeaningfulProgressRow(row: PersistedProgressRow) {
    return (
        row.bookName.trim().length > 0 ||
        row.challengeId.trim().length > 0 ||
        row.completed ||
        toNonNegativeNumber(row.minutes) > 0 ||
        toNonNegativeNumber(row.pages) > 0
    )
}

function isCompletedBookRow(row: PersistedProgressRow) {
    return (
        row.completed &&
        (row.bookName.trim().length > 0 ||
            toNonNegativeNumber(row.minutes) > 0 ||
            toNonNegativeNumber(row.pages) > 0)
    )
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function getStringValue(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function getBooleanValue(value: unknown) {
    return value === true
}

function toNonNegativeNumber(value: string) {
    const numericValue = Number(value)

    if (!Number.isFinite(numericValue) || numericValue < 0) {
        return 0
    }

    return numericValue
}
