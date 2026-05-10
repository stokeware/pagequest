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

    it('creates a new campaign-owned admin challenge', async () => {
        campaignActionMocks.prisma.campaign.findUnique.mockResolvedValue({
            archivedAt: null,
            id: 'campaign-1',
        })

        const formData = new FormData()
        formData.set('campaignId', 'campaign-1')
        formData.set('pointValue', '15')
        formData.set('pageMinuteMultiplier', '0')
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
                campaignId: 'campaign-1',
                createdByUserId: 'admin-1',
                kind: 'ADMIN',
                pageMinuteMultiplier: expect.anything(),
                pointValue: expect.anything(),
                title: 'Night Reading',
            },
            select: {
                id: true,
                title: true,
            },
        })
    })

    it('deletes a direct campaign-owned challenge when it has no history', async () => {
        campaignActionMocks.prisma.campaign.findUnique.mockResolvedValue({
            archivedAt: null,
            id: 'campaign-1',
        })
        campaignActionMocks.prisma.challenge.findFirst.mockResolvedValue({
            _count: {
                challengeCompletions: 0,
            },
            id: 'challenge-1',
            title: 'Night Reading',
        })

        const formData = new FormData()
        formData.set('campaignId', 'campaign-1')
        formData.set('challengeId', 'challenge-1')

        await expect(
            deleteCampaignChallengeAction(formData)
        ).rejects.toMatchObject({
            digest: expect.stringContaining('NEXT_REDIRECT'),
        })

        expect(
            campaignActionMocks.transaction.challenge.delete
        ).toHaveBeenCalledWith({
            where: {
                id: 'challenge-1',
            },
        })
        expect(
            campaignActionMocks.transaction.auditLog.create
        ).toHaveBeenCalledWith({
            data: {
                action: 'challenge.deleted',
                actorUserId: 'admin-1',
                challengeId: 'challenge-1',
                campaignId: 'campaign-1',
                entityId: 'challenge-1',
                entityType: 'Challenge',
                metadata: {
                    challengeTitle: 'Night Reading',
                },
            },
        })
    })
})
