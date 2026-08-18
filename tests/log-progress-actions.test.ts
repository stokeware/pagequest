import { beforeEach, describe, expect, it, vi } from 'vitest'

const actionMocks = vi.hoisted(() => ({
    findUnique: vi.fn(),
    requireAuthenticatedActionUser: vi.fn(),
    transaction: vi.fn(),
}))

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth/session', () => ({
    requireAuthenticatedActionUser: actionMocks.requireAuthenticatedActionUser,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        $transaction: actionMocks.transaction,
        campaignParticipant: {
            findUnique: actionMocks.findUnique,
        },
    },
}))

import { saveCampaignWorkspaceAction } from '@/app/(competitor)/log-progress/actions'

describe('log progress actions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        actionMocks.requireAuthenticatedActionUser.mockResolvedValue({
            id: 'user-1',
        })
    })

    it('rejects workspace changes after the campaign ends', async () => {
        actionMocks.findUnique.mockResolvedValue({
            campaign: {
                endAt: new Date('2026-05-15T18:00:00.000Z'),
                status: 'COMPLETED',
            },
            campaignId: 'campaign-1',
            id: 'participant-1',
            removedAt: null,
            userId: 'user-1',
            user: {
                email: 'reader@example.com',
                name: 'Reader',
            },
        })

        const result = await saveCampaignWorkspaceAction({
            campaignParticipantId: 'participant-1',
            workspaceState: {
                personalGoalTitle: 'The Giver',
                progressRows: [],
                recommendationTitle: 'Gathering Blue',
            },
        })

        expect(result).toEqual({
            detail: 'campaign-ended',
            message: 'This campaign has ended and is now read only.',
            outcome: 'error',
        })
        expect(actionMocks.transaction).not.toHaveBeenCalled()
    })
})
