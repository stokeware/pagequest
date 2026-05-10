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
    const ensureCampaignChallengeTemplates = vi.fn()
    const requireAdminActionUser = vi.fn()
    const transaction = {
        auditLog: {
            create: vi.fn(),
        },
        campaignChallenge: {
            create: vi.fn(),
            delete: vi.fn(),
        },
        campaign: {
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
            findMany: vi.fn(),
            findFirst: vi.fn(),
        },
    }

    return {
        ensureCampaignChallengeTemplates,
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

vi.mock('@/lib/challenge-config', () => ({
    ensureCampaignChallengeTemplates:
        campaignActionMocks.ensureCampaignChallengeTemplates,
    personalGoalTemplateTitle: 'Personal Goal',
    recommendationTemplateTitle: 'Recommendation',
}))

import {
    createCampaignChallengeAction,
    deleteCampaignAction,
    deleteCampaignChallengeAction,
    saveCampaignChallengesAction,
    updateCompetitorChallengesAction,
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
        campaignActionMocks.transaction.campaign.delete.mockResolvedValue(
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
        campaignActionMocks.transaction.challenge.update.mockResolvedValue({
            id: 'challenge-1',
        })
        campaignActionMocks.prisma.challenge.findMany.mockResolvedValue([])
        campaignActionMocks.ensureCampaignChallengeTemplates.mockResolvedValue(
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

    it('records the deletion audit log before removing the challenge', async () => {
        const deletedChallengeIds = new Set<string>()

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
        campaignActionMocks.transaction.auditLog.create.mockImplementation(
            async ({ data }: { data: { challengeId?: string } }) => {
                if (
                    data.challengeId &&
                    deletedChallengeIds.has(data.challengeId)
                ) {
                    throw new Error('Challenge foreign key is already gone')
                }
            }
        )
        campaignActionMocks.transaction.challenge.delete.mockImplementation(
            async ({ where }: { where: { id: string } }) => {
                deletedChallengeIds.add(where.id)
            }
        )

        const formData = new FormData()
        formData.set('campaignId', 'campaign-1')
        formData.set('challengeId', 'challenge-1')

        await expect(
            deleteCampaignChallengeAction(formData)
        ).rejects.toMatchObject({
            digest: expect.stringContaining('NEXT_REDIRECT'),
        })

        expect(campaignActionMocks.redirect).toHaveBeenCalledWith(
            '/admin/campaigns?outcome=challenge-deleted&selectedCampaignId=campaign-1'
        )
        expect(
            campaignActionMocks.transaction.auditLog.create.mock
                .invocationCallOrder[0]
        ).toBeLessThan(
            campaignActionMocks.transaction.challenge.delete.mock
                .invocationCallOrder[0]
        )
    })

    it('deletes a campaign and redirects back to the workbench', async () => {
        campaignActionMocks.prisma.campaign.findUnique.mockResolvedValue({
            archivedAt: null,
            challengeCategoryBonuses: null,
            description: null,
            endAt: new Date('2026-05-30T12:00:00.000Z'),
            entryDeleteWindowMinutes: null,
            entryEditWindowMinutes: null,
            id: 'campaign-1',
            name: 'Spring Story Sprint',
            pointsPerAudiobookMinute: 0.75,
            pointsPerBook: 1,
            pointsPerChallengeCompletion: 1,
            pointsPerPage: 1,
            publishedAt: null,
            startAt: new Date('2026-05-01T12:00:00.000Z'),
            timezone: 'America/Chicago',
            visibility: 'INVITE_ONLY',
        })

        const formData = new FormData()
        formData.set('campaignId', 'campaign-1')

        await expect(deleteCampaignAction(formData)).rejects.toMatchObject({
            digest: expect.stringContaining('NEXT_REDIRECT'),
        })

        expect(
            campaignActionMocks.transaction.campaign.delete
        ).toHaveBeenCalledWith({
            where: {
                id: 'campaign-1',
            },
        })
        expect(
            campaignActionMocks.transaction.auditLog.create
        ).toHaveBeenCalledWith({
            data: {
                action: 'campaign.deleted',
                actorUserId: 'admin-1',
                entityId: 'campaign-1',
                entityType: 'Campaign',
                metadata: {
                    campaignName: 'Spring Story Sprint',
                },
            },
        })
    })

    it('saves all campaign challenges and creates a new row entry', async () => {
        campaignActionMocks.prisma.campaign.findUnique.mockResolvedValue({
            archivedAt: null,
            id: 'campaign-1',
        })
        campaignActionMocks.prisma.challenge.findMany.mockResolvedValue([
            {
                id: 'challenge-1',
            },
        ])
        campaignActionMocks.transaction.challenge.create.mockResolvedValue({
            id: 'challenge-2',
            title: 'Weekend Sprint',
        })

        const formData = new FormData()
        formData.set('campaignId', 'campaign-1')
        formData.append('existingChallengeId', 'challenge-1')
        formData.append('existingTitle', 'Night Reading')
        formData.append('existingPointValue', '15')
        formData.append('existingPageMinuteMultiplier', '1')
        formData.set('newTitle', 'Weekend Sprint')
        formData.set('newPointValue', '20')
        formData.set('newPageMinuteMultiplier', '2')

        await expect(
            saveCampaignChallengesAction(formData)
        ).rejects.toMatchObject({
            digest: expect.stringContaining('NEXT_REDIRECT'),
        })

        expect(
            campaignActionMocks.transaction.challenge.update
        ).toHaveBeenCalledWith({
            data: {
                pageMinuteMultiplier: expect.anything(),
                pointValue: expect.anything(),
                title: 'Night Reading',
            },
            where: {
                id: 'challenge-1',
            },
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
                title: 'Weekend Sprint',
            },
            select: {
                id: true,
                title: true,
            },
        })
    })

    it('saves competitor challenge templates from one form', async () => {
        campaignActionMocks.prisma.campaign.findUnique.mockResolvedValue({
            archivedAt: null,
            id: 'campaign-1',
        })
        campaignActionMocks.transaction.challenge.update
            .mockResolvedValueOnce({
                id: 'recommendation-template',
            })
            .mockResolvedValueOnce({
                id: 'personal-goal-template',
            })

        const formData = new FormData()
        formData.set('campaignId', 'campaign-1')
        formData.set('recommendationPointValue', '5')
        formData.set('recommendationPageMinuteMultiplier', '1')
        formData.set('personalGoalPointValue', '8')
        formData.set('personalGoalPageMinuteMultiplier', '2')

        await expect(
            updateCompetitorChallengesAction(formData)
        ).rejects.toMatchObject({
            digest: expect.stringContaining('NEXT_REDIRECT'),
        })

        expect(
            campaignActionMocks.ensureCampaignChallengeTemplates
        ).toHaveBeenCalledWith(campaignActionMocks.prisma, 'campaign-1')
        expect(
            campaignActionMocks.transaction.challenge.update
        ).toHaveBeenNthCalledWith(1, {
            data: {
                pageMinuteMultiplier: expect.anything(),
                pointValue: expect.anything(),
                title: 'Recommendation',
            },
            select: {
                id: true,
            },
            where: {
                campaignId_title: {
                    campaignId: 'campaign-1',
                    title: 'Recommendation',
                },
            },
        })
        expect(
            campaignActionMocks.transaction.challenge.update
        ).toHaveBeenNthCalledWith(2, {
            data: {
                pageMinuteMultiplier: expect.anything(),
                pointValue: expect.anything(),
                title: 'Personal Goal',
            },
            select: {
                id: true,
            },
            where: {
                campaignId_title: {
                    campaignId: 'campaign-1',
                    title: 'Personal Goal',
                },
            },
        })
    })
})
