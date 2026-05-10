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
                              ? 'PERSONAL_GOAL'
                              : 'STANDARD',
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

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function getStringValue(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function getBooleanValue(value: unknown) {
    return value === true
}
