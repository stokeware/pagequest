import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const campaignActionMocks = vi.hoisted(() => {
    const revalidatePath = vi.fn()
    const redirect = vi.fn((url: string) => {
        const error = new Error(`NEXT_REDIRECT:${url}`) as Error & {
            digest: string
        }
        error.digest = `NEXT_REDIRECT;${url}`
        throw error
    })
    const requireAdminActionUser = vi.fn()
    const transaction = {
        auditLog: {
            create: vi.fn(),
        },
        campaignChallenge: {
            create: vi.fn(),
            delete: vi.fn(),
        },
        challenge: {
            create: vi.fn(),
            delete: vi.fn(),
            update: vi.fn(),
        },
    }
    const prisma = {
        $transaction: vi.fn(),
        campaign: {
            findUnique: vi.fn(),
        },
        campaignChallenge: {
            count: vi.fn(),
            findFirst: vi.fn(),
        },
        challenge: {
            findFirst: vi.fn(),
        },
    }

    return {
        prisma,
        redirect,
        revalidatePath,
        requireAdminActionUser,
        transaction,
    }
})

vi.mock('next/cache', () => ({
    revalidatePath: campaignActionMocks.revalidatePath,
}))

vi.mock('next/navigation', () => ({
    redirect: campaignActionMocks.redirect,
}))

vi.mock('@/lib/auth/session', () => ({
    requireAdminActionUser: campaignActionMocks.requireAdminActionUser,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: campaignActionMocks.prisma,
}))

import {
    createCampaignChallengeAction,
    deleteCampaignChallengeAction,
} from '@/app/(admin)/admin/campaigns/actions'

describe('admin campaign challenge actions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        campaignActionMocks.requireAdminActionUser.mockResolvedValue({
            id: 'admin-1',
        })
        campaignActionMocks.prisma.$transaction.mockImplementation(
            async (
                callback: (
                    transaction: typeof campaignActionMocks.transaction
                ) => Promise<void>
            ) => callback(campaignActionMocks.transaction)
        )
        campaignActionMocks.transaction.auditLog.create.mockResolvedValue(
            undefined
        )
        campaignActionMocks.transaction.challenge.create.mockResolvedValue({
            id: 'challenge-1',
            title: 'Night Reading',
        })
        campaignActionMocks.transaction.campaignChallenge.create.mockResolvedValue(
            {
                id: 'assignment-1',
            }
        )
        campaignActionMocks.transaction.campaignChallenge.delete.mockResolvedValue(
            undefined
        )
        campaignActionMocks.transaction.challenge.delete.mockResolvedValue(
            undefined
        )
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('creates a new challenge and assigns it to the selected campaign', async () => {
        campaignActionMocks.prisma.campaign.findUnique.mockResolvedValue({
            archivedAt: null,
            id: 'campaign-1',
        })
        campaignActionMocks.prisma.campaignChallenge.count.mockResolvedValue(2)

        const formData = new FormData()
        formData.set('campaignId', 'campaign-1')
        formData.set('pointValue', '15')
        formData.set('title', 'Night Reading')

        await expect(
            createCampaignChallengeAction(formData)
        ).rejects.toMatchObject({
            digest: expect.stringContaining('NEXT_REDIRECT'),
        })

        expect(
            campaignActionMocks.transaction.challenge.create
        ).toHaveBeenCalledWith({
            data: {
                createdByUserId: 'admin-1',
                pointValue: expect.anything(),
                title: 'Night Reading',
            },
            select: {
                id: true,
                title: true,
            },
        })
        expect(
            campaignActionMocks.transaction.campaignChallenge.create
        ).toHaveBeenCalledWith({
            data: {
                campaignId: 'campaign-1',
                challengeId: 'challenge-1',
                isActive: true,
                pointValueOverride: null,
                sortOrder: 2,
            },
            select: {
                id: true,
            },
        })
    })

    it('removes only the campaign assignment when a shared challenge is deleted', async () => {
        campaignActionMocks.prisma.campaign.findUnique.mockResolvedValue({
            archivedAt: null,
            id: 'campaign-1',
        })
        campaignActionMocks.prisma.campaignChallenge.findFirst.mockResolvedValue(
            {
                challenge: {
                    _count: {
                        campaignChallenges: 2,
                        challengeCompletions: 0,
                    },
                    id: 'challenge-1',
                    title: 'Night Reading',
                },
                id: 'assignment-1',
            }
        )

        const formData = new FormData()
        formData.set('campaignChallengeId', 'assignment-1')
        formData.set('campaignId', 'campaign-1')

        await expect(
            deleteCampaignChallengeAction(formData)
        ).rejects.toMatchObject({
            digest: expect.stringContaining('NEXT_REDIRECT'),
        })

        expect(
            campaignActionMocks.transaction.campaignChallenge.delete
        ).toHaveBeenCalledWith({
            where: {
                id: 'assignment-1',
            },
        })
        expect(
            campaignActionMocks.transaction.challenge.delete
        ).not.toHaveBeenCalled()
        expect(
            campaignActionMocks.transaction.auditLog.create
        ).toHaveBeenCalledWith({
            data: {
                action: 'campaign.challenge-removed',
                actorUserId: 'admin-1',
                challengeId: 'challenge-1',
                campaignId: 'campaign-1',
                entityId: 'assignment-1',
                entityType: 'CampaignChallenge',
                metadata: {
                    challengeTitle: 'Night Reading',
                    deletedChallenge: false,
                },
            },
        })
    })
})
