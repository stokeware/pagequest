import type { CampaignWorkspaceState } from './workspace-state'

export function getAchievedChallengeIds({
    approvedChallengeIds,
    workspaceState,
}: {
    approvedChallengeIds: string[]
    workspaceState: CampaignWorkspaceState
}) {
    return new Set([
        ...approvedChallengeIds,
        ...workspaceState.progressRows.flatMap((row) =>
            row.completed && row.challengeId ? [row.challengeId] : []
        ),
    ])
}
