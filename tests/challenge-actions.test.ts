import { Prisma } from '@prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const challengeActionMocks = vi.hoisted(() => {
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
        challengeCompletion: {
            update: vi.fn(),
        },
    }
    const prisma = {
        $transaction: vi.fn(),
        challengeCompletion: {
            findUnique: vi.fn(),
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
    revalidatePath: challengeActionMocks.revalidatePath,
}))

vi.mock('next/navigation', () => ({
    redirect: challengeActionMocks.redirect,
}))

vi.mock('@/lib/auth/session', () => ({
    requireAdminActionUser: challengeActionMocks.requireAdminActionUser,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: challengeActionMocks.prisma,
}))

import { reviewChallengeCompletionAction } from '@/app/(admin)/admin/challenges/actions'

describe('admin challenge review audit logging', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-05-08T18:30:00.000Z'))
        vi.clearAllMocks()

        challengeActionMocks.requireAdminActionUser.mockResolvedValue({
            id: 'admin-1',
        })
        challengeActionMocks.prisma.$transaction.mockImplementation(
            async (
                callback: (
                    transaction: typeof challengeActionMocks.transaction
                ) => Promise<void>
            ) => callback(challengeActionMocks.transaction)
        )
        challengeActionMocks.transaction.challengeCompletion.update.mockResolvedValue(
            undefined
        )
        challengeActionMocks.transaction.auditLog.create.mockResolvedValue(
            undefined
        )
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('records an audit log when an admin approves a challenge completion', async () => {
        challengeActionMocks.prisma.challengeCompletion.findUnique.mockResolvedValue(
            {
                challenge: {
                    id: 'challenge-1',
                    pointValue: new Prisma.Decimal('40'),
                },
                id: 'completion-1',
                campaignChallenge: {
                    pointValueOverride: null,
                },
                campaignParticipant: {
                    id: 'participant-1',
                    campaign: {
                        id: 'campaign-1',
                        pointsPerChallengeCompletion: new Prisma.Decimal('20'),
                    },
                },
                reviewState: 'PENDING',
            }
        )

        const formData = new FormData()
        formData.set('awardedPointsOverride', '55')
        formData.set('challengeCompletionId', 'completion-1')
        formData.set('decision', 'approve')
        formData.set('reviewNotes', 'Verified against the recommendation note.')

        await expect(
            reviewChallengeCompletionAction(formData)
        ).rejects.toMatchObject({
            digest: expect.stringContaining('NEXT_REDIRECT'),
        })

        expect(
            challengeActionMocks.transaction.auditLog.create
        ).toHaveBeenCalledWith({
            data: {
                action: 'challenge-completion.approved',
                actorUserId: 'admin-1',
                challengeCompletionId: 'completion-1',
                challengeId: 'challenge-1',
                entityId: 'completion-1',
                entityType: 'ChallengeCompletion',
                metadata: {
                    awardedPoints: '55',
                    reviewNotes: 'Verified against the recommendation note.',
                    reviewState: 'APPROVED',
                },
                campaignId: 'campaign-1',
                campaignParticipantId: 'participant-1',
            },
        })
    })
})
