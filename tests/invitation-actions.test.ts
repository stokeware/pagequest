import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const invitationActionMocks = vi.hoisted(() => {
    const revalidatePath = vi.fn()
    const redirect = vi.fn((url: string) => {
        const error = new Error(`NEXT_REDIRECT:${url}`) as Error & {
            digest: string
        }
        error.digest = `NEXT_REDIRECT;${url}`
        throw error
    })
    const getServerSession = vi.fn()
    const deriveRoleAwareSession = vi.fn()
    const getAdminRouteRedirectPath = vi.fn()
    const sendInvitationEmail = vi.fn()
    const buildInvitationAcceptUrl = vi.fn()
    const canResendInvitation = vi.fn()
    const canRevokeInvitation = vi.fn()
    const consumeRateLimit = vi.fn()
    const normalizeInvitationEmail = vi.fn()
    const prepareInvitationCreateValues = vi.fn()
    const prepareInvitationResendValues = vi.fn()
    const transaction = {
        auditLog: {
            create: vi.fn(),
        },
        invitation: {
            create: vi.fn(),
            delete: vi.fn(),
            update: vi.fn(),
        },
    }
    const prisma = {
        $transaction: vi.fn(),
        auditLog: {
            create: vi.fn(),
        },
        invitation: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
        },
        campaign: {
            findMany: vi.fn(),
        },
    }

    return {
        buildInvitationAcceptUrl,
        canResendInvitation,
        canRevokeInvitation,
        consumeRateLimit,
        deriveRoleAwareSession,
        getAdminRouteRedirectPath,
        getServerSession,
        normalizeInvitationEmail,
        prepareInvitationCreateValues,
        prepareInvitationResendValues,
        prisma,
        redirect,
        revalidatePath,
        sendInvitationEmail,
        transaction,
    }
})

vi.mock('next/cache', () => ({
    revalidatePath: invitationActionMocks.revalidatePath,
}))

vi.mock('next/navigation', () => ({
    redirect: invitationActionMocks.redirect,
}))

vi.mock('next-auth/next', () => ({
    getServerSession: invitationActionMocks.getServerSession,
}))

vi.mock('@/lib/auth/session', () => ({
    deriveRoleAwareSession: invitationActionMocks.deriveRoleAwareSession,
    getAdminRouteRedirectPath: invitationActionMocks.getAdminRouteRedirectPath,
}))

vi.mock('@/lib/email/invitation', () => ({
    sendInvitationEmail: invitationActionMocks.sendInvitationEmail,
}))

vi.mock('@/lib/invitation-admin', () => ({
    buildInvitationAcceptUrl: invitationActionMocks.buildInvitationAcceptUrl,
    canResendInvitation: invitationActionMocks.canResendInvitation,
    canRevokeInvitation: invitationActionMocks.canRevokeInvitation,
    normalizeInvitationEmail: invitationActionMocks.normalizeInvitationEmail,
    prepareInvitationCreateValues:
        invitationActionMocks.prepareInvitationCreateValues,
    prepareInvitationResendValues:
        invitationActionMocks.prepareInvitationResendValues,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: invitationActionMocks.prisma,
}))

vi.mock('@/lib/security/rate-limit', () => ({
    consumeRateLimit: invitationActionMocks.consumeRateLimit,
}))

import {
    createInvitationAction,
    resendInvitationAction,
    revokeInvitationAction,
} from '@/app/(admin)/admin/invitations/actions'

describe('admin invitation actions audit logging', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-05-08T18:00:00.000Z'))
        vi.clearAllMocks()

        invitationActionMocks.getServerSession.mockResolvedValue({
            user: {
                email: 'admin@pagequest.local',
                id: 'admin-1',
                roles: ['ADMIN'],
            },
        })
        invitationActionMocks.deriveRoleAwareSession.mockReturnValue({
            userEmail: 'admin@pagequest.local',
            userId: 'admin-1',
        })
        invitationActionMocks.getAdminRouteRedirectPath.mockReturnValue(null)
        invitationActionMocks.normalizeInvitationEmail.mockImplementation(
            (value: string) => value.trim().toLowerCase()
        )
        invitationActionMocks.prepareInvitationCreateValues.mockReturnValue({
            expiresAt: new Date('2026-05-22T18:00:00.000Z'),
            lastSentAt: new Date('2026-05-08T18:00:00.000Z'),
            status: 'PENDING',
            token: 'created-token',
            tokenHash: 'created-hash',
        })
        invitationActionMocks.prepareInvitationResendValues.mockReturnValue({
            expiresAt: new Date('2026-05-23T18:00:00.000Z'),
            lastSentAt: new Date('2026-05-08T18:00:00.000Z'),
            status: 'PENDING',
            token: 'resent-token',
            tokenHash: 'resent-hash',
        })
        invitationActionMocks.buildInvitationAcceptUrl.mockImplementation(
            ({ token }: { token: string }) =>
                `http://127.0.0.1:3000/accept-invitation?token=${token}`
        )
        invitationActionMocks.sendInvitationEmail.mockResolvedValue(undefined)
        invitationActionMocks.canResendInvitation.mockReturnValue(true)
        invitationActionMocks.canRevokeInvitation.mockReturnValue(true)
        invitationActionMocks.consumeRateLimit.mockReturnValue({
            allowed: true,
            remaining: 5,
            retryAfterSeconds: 0,
        })
        invitationActionMocks.prisma.$transaction.mockImplementation(
            async (
                callback: (
                    transaction: typeof invitationActionMocks.transaction
                ) => Promise<void>
            ) => callback(invitationActionMocks.transaction)
        )
        invitationActionMocks.transaction.invitation.create.mockResolvedValue({
            id: 'invite-1',
        })
        invitationActionMocks.transaction.invitation.update.mockResolvedValue(
            undefined
        )
        invitationActionMocks.transaction.auditLog.create.mockResolvedValue(
            undefined
        )
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('records an audit log when an admin creates an invitation', async () => {
        invitationActionMocks.prisma.campaign.findMany.mockResolvedValue([
            {
                createdAt: new Date('2026-04-01T12:00:00.000Z'),
                id: 'campaign-1',
                name: 'Spring Story Sprint 2026',
                startAt: new Date('2026-04-20T12:00:00.000Z'),
                status: 'ACTIVE',
            },
        ])
        invitationActionMocks.prisma.invitation.findFirst.mockResolvedValue(
            null
        )

        const formData = new FormData()
        formData.set('email', ' Reader@Example.com ')

        await expect(createInvitationAction(formData)).rejects.toMatchObject({
            digest: expect.stringContaining('NEXT_REDIRECT'),
        })

        expect(
            invitationActionMocks.transaction.auditLog.create
        ).toHaveBeenCalledWith({
            data: {
                action: 'invitation.created',
                actorUserId: 'admin-1',
                entityId: 'invite-1',
                entityType: 'Invitation',
                invitationId: 'invite-1',
                metadata: {
                    email: 'reader@example.com',
                    expiresAt: '2026-05-22T18:00:00.000Z',
                    campaignName: 'Spring Story Sprint 2026',
                },
                campaignId: 'campaign-1',
            },
        })
    })

    it('blocks invitation creation when the admin hits the send rate limit', async () => {
        invitationActionMocks.prisma.campaign.findMany.mockResolvedValue([
            {
                createdAt: new Date('2026-04-01T12:00:00.000Z'),
                id: 'campaign-1',
                name: 'Spring Story Sprint 2026',
                startAt: new Date('2026-04-20T12:00:00.000Z'),
                status: 'ACTIVE',
            },
        ])
        invitationActionMocks.consumeRateLimit.mockReturnValue({
            allowed: false,
            remaining: 0,
            retryAfterSeconds: 120,
        })

        const formData = new FormData()
        formData.set('email', 'reader@example.com')

        await expect(createInvitationAction(formData)).rejects.toMatchObject({
            digest: expect.stringContaining('detail=rate-limit-exceeded'),
        })

        expect(
            invitationActionMocks.transaction.invitation.create
        ).not.toHaveBeenCalled()
    })

    it('records delivery failure when invitation email sending fails', async () => {
        invitationActionMocks.prisma.campaign.findMany.mockResolvedValue([
            {
                createdAt: new Date('2026-04-01T12:00:00.000Z'),
                id: 'campaign-1',
                name: 'Spring Story Sprint 2026',
                startAt: new Date('2026-04-20T12:00:00.000Z'),
                status: 'ACTIVE',
            },
        ])
        invitationActionMocks.prisma.invitation.findFirst.mockResolvedValue(
            null
        )
        invitationActionMocks.sendInvitationEmail.mockRejectedValue(
            new Error('smtp down')
        )
        invitationActionMocks.prisma.auditLog = {
            create: vi.fn().mockResolvedValue(undefined),
        }

        const formData = new FormData()
        formData.set('email', 'reader@example.com')

        await expect(createInvitationAction(formData)).rejects.toMatchObject({
            digest: expect.stringContaining('detail=email-send-failed'),
        })

        expect(
            invitationActionMocks.prisma.auditLog.create
        ).toHaveBeenCalledWith({
            data: {
                action: 'invitation.delivery_failed',
                actorUserId: 'admin-1',
                campaignId: 'campaign-1',
                entityId: 'invite-1',
                entityType: 'Invitation',
                invitationId: 'invite-1',
                metadata: {
                    campaignName: 'Spring Story Sprint 2026',
                    email: 'reader@example.com',
                    stage: 'created',
                },
            },
        })
    })

    it('records an audit log when an admin resends an invitation', async () => {
        invitationActionMocks.prisma.invitation.findUnique.mockResolvedValue({
            acceptedAt: null,
            email: 'reader@example.com',
            expiresAt: new Date('2026-05-10T12:00:00.000Z'),
            id: 'invite-1',
            campaign: {
                id: 'campaign-1',
                name: 'Spring Story Sprint 2026',
                status: 'ACTIVE',
                visibility: 'INVITE_ONLY',
            },
            revokedAt: null,
            status: 'EXPIRED',
        })

        const formData = new FormData()
        formData.set('invitationId', 'invite-1')

        await expect(resendInvitationAction(formData)).rejects.toMatchObject({
            digest: expect.stringContaining('NEXT_REDIRECT'),
        })

        expect(
            invitationActionMocks.transaction.auditLog.create
        ).toHaveBeenCalledWith({
            data: {
                action: 'invitation.resent',
                actorUserId: 'admin-1',
                entityId: 'invite-1',
                entityType: 'Invitation',
                invitationId: 'invite-1',
                metadata: {
                    email: 'reader@example.com',
                    expiresAt: '2026-05-23T18:00:00.000Z',
                    previousStatus: 'EXPIRED',
                    campaignName: 'Spring Story Sprint 2026',
                },
                campaignId: 'campaign-1',
            },
        })
    })

    it('blocks invitation resend when the resend rate limit is hit', async () => {
        invitationActionMocks.prisma.invitation.findUnique.mockResolvedValue({
            acceptedAt: null,
            email: 'reader@example.com',
            expiresAt: new Date('2026-05-10T12:00:00.000Z'),
            id: 'invite-1',
            campaign: {
                id: 'campaign-1',
                name: 'Spring Story Sprint 2026',
                status: 'ACTIVE',
                visibility: 'INVITE_ONLY',
            },
            revokedAt: null,
            status: 'PENDING',
        })
        invitationActionMocks.consumeRateLimit.mockReturnValue({
            allowed: false,
            remaining: 0,
            retryAfterSeconds: 300,
        })

        const formData = new FormData()
        formData.set('invitationId', 'invite-1')

        await expect(resendInvitationAction(formData)).rejects.toMatchObject({
            digest: expect.stringContaining('detail=rate-limit-exceeded'),
        })

        expect(
            invitationActionMocks.transaction.invitation.update
        ).not.toHaveBeenCalled()
    })

    it('records an audit log when an admin revokes an invitation', async () => {
        invitationActionMocks.prisma.invitation.findUnique.mockResolvedValue({
            acceptedAt: null,
            email: 'reader@example.com',
            expiresAt: new Date('2026-05-10T12:00:00.000Z'),
            id: 'invite-1',
            campaign: {
                id: 'campaign-1',
                name: 'Spring Story Sprint 2026',
            },
            revokedAt: null,
            status: 'PENDING',
        })

        const formData = new FormData()
        formData.set('invitationId', 'invite-1')

        await expect(revokeInvitationAction(formData)).rejects.toMatchObject({
            digest: expect.stringContaining('NEXT_REDIRECT'),
        })

        expect(
            invitationActionMocks.transaction.auditLog.create
        ).toHaveBeenCalledWith({
            data: {
                action: 'invitation.revoked',
                actorUserId: 'admin-1',
                entityId: 'invite-1',
                entityType: 'Invitation',
                invitationId: 'invite-1',
                metadata: {
                    email: 'reader@example.com',
                    campaignName: 'Spring Story Sprint 2026',
                },
                campaignId: 'campaign-1',
            },
        })
        expect(
            invitationActionMocks.transaction.invitation.delete
        ).toHaveBeenCalledWith({
            where: {
                id: 'invite-1',
            },
        })
    })
})
