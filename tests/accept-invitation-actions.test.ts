import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const acceptInvitationActionMocks = vi.hoisted(() => {
    const getServerSession = vi.fn()
    const revalidatePath = vi.fn()
    const redirect = vi.fn((url: string) => {
        const error = new Error(`NEXT_REDIRECT:${url}`) as Error & {
            digest: string
        }
        error.digest = `NEXT_REDIRECT;${url}`
        throw error
    })
    const deriveInvitationAcceptanceProfile = vi.fn()
    const recordInvitationAcceptance = vi.fn()
    const consumeRateLimit = vi.fn()
    const resetRateLimit = vi.fn()
    const prisma = {
        $transaction: vi.fn(),
        auditLog: {
            create: vi.fn(),
        },
        invitation: {
            findUnique: vi.fn(),
        },
    }

    return {
        consumeRateLimit,
        deriveInvitationAcceptanceProfile,
        getServerSession,
        prisma,
        recordInvitationAcceptance,
        redirect,
        resetRateLimit,
        revalidatePath,
    }
})

vi.mock('next-auth/next', () => ({
    getServerSession: acceptInvitationActionMocks.getServerSession,
}))

vi.mock('next/cache', () => ({
    revalidatePath: acceptInvitationActionMocks.revalidatePath,
}))

vi.mock('next/navigation', () => ({
    redirect: acceptInvitationActionMocks.redirect,
}))

vi.mock('@/lib/auth', () => ({
    authOptions: {},
}))

vi.mock('@/lib/invitation-acceptance', () => ({
    deriveInvitationAcceptanceProfile:
        acceptInvitationActionMocks.deriveInvitationAcceptanceProfile,
}))

vi.mock('@/lib/invitation-service', () => ({
    recordInvitationAcceptance:
        acceptInvitationActionMocks.recordInvitationAcceptance,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: acceptInvitationActionMocks.prisma,
}))

vi.mock('@/lib/security/rate-limit', () => ({
    consumeRateLimit: acceptInvitationActionMocks.consumeRateLimit,
    resetRateLimit: acceptInvitationActionMocks.resetRateLimit,
}))

import { acceptInvitationAction } from '@/app/(public)/accept-invitation/actions'

describe('acceptInvitationAction security hardening', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        acceptInvitationActionMocks.getServerSession.mockResolvedValue({
            user: {
                email: 'reader@example.com',
                id: 'user-1',
            },
        })
        acceptInvitationActionMocks.consumeRateLimit.mockReturnValue({
            allowed: true,
            remaining: 4,
            retryAfterSeconds: 0,
        })
        acceptInvitationActionMocks.deriveInvitationAcceptanceProfile.mockReturnValue(
            {
                canAccept: true,
                state: 'ready',
            }
        )
        acceptInvitationActionMocks.prisma.invitation.findUnique.mockResolvedValue(
            {
                acceptedByUserId: null,
                campaign: {
                    id: 'campaign-1',
                    name: 'Spring Story Sprint 2026',
                    status: 'ACTIVE',
                    visibility: 'INVITE_ONLY',
                },
                email: 'reader@example.com',
                expiresAt: new Date('2026-05-15T12:00:00.000Z'),
                id: 'invite-1',
                revokedAt: null,
                status: 'PENDING',
            }
        )
        acceptInvitationActionMocks.prisma.$transaction.mockImplementation(
            async (callback: (transaction: object) => Promise<void>) =>
                callback({})
        )
        acceptInvitationActionMocks.prisma.auditLog.create.mockResolvedValue(
            undefined
        )
        acceptInvitationActionMocks.recordInvitationAcceptance.mockResolvedValue(
            undefined
        )
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('rejects malformed invitation tokens before querying persistence', async () => {
        const formData = new FormData()
        formData.set('token', 'bad token')

        await expect(acceptInvitationAction(formData)).rejects.toMatchObject({
            digest: expect.stringContaining('detail=invalid-token'),
        })

        expect(
            acceptInvitationActionMocks.prisma.invitation.findUnique
        ).not.toHaveBeenCalled()
    })

    it('audits and blocks rate-limited invitation acceptance attempts', async () => {
        acceptInvitationActionMocks.consumeRateLimit.mockReturnValue({
            allowed: false,
            remaining: 0,
            retryAfterSeconds: 180,
        })

        const formData = new FormData()
        formData.set('token', 'x'.repeat(32))

        await expect(acceptInvitationAction(formData)).rejects.toMatchObject({
            digest: expect.stringContaining('detail=rate-limit-exceeded'),
        })

        expect(
            acceptInvitationActionMocks.prisma.auditLog.create
        ).toHaveBeenCalledWith({
            data: {
                action: 'invitation.acceptance_blocked',
                actorUserId: 'user-1',
                campaignId: 'campaign-1',
                entityId: 'invite-1',
                entityType: 'Invitation',
                invitationId: 'invite-1',
                metadata: {
                    attemptedEmail: 'reader@example.com',
                    campaignName: 'Spring Story Sprint 2026',
                    detail: 'rate-limit-exceeded',
                    invitationEmail: 'reader@example.com',
                },
            },
        })
    })

    it('audits failed acceptance writes before redirecting back to the secure link', async () => {
        acceptInvitationActionMocks.prisma.$transaction.mockRejectedValue(
            new Error('write failed')
        )

        const formData = new FormData()
        formData.set('token', 'x'.repeat(32))

        await expect(acceptInvitationAction(formData)).rejects.toMatchObject({
            digest: expect.stringContaining('detail=acceptance-failed'),
        })

        expect(
            acceptInvitationActionMocks.prisma.auditLog.create
        ).toHaveBeenCalledWith({
            data: {
                action: 'invitation.acceptance_failed',
                actorUserId: 'user-1',
                campaignId: 'campaign-1',
                entityId: 'invite-1',
                entityType: 'Invitation',
                invitationId: 'invite-1',
                metadata: {
                    attemptedEmail: 'reader@example.com',
                    campaignName: 'Spring Story Sprint 2026',
                    detail: 'acceptance-failed',
                    invitationEmail: 'reader@example.com',
                },
            },
        })
    })
})
