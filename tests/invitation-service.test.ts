import { describe, expect, it, vi } from 'vitest'

import {
    provisionInvitationAccount,
    recordInvitationAcceptance,
} from '@/lib/invitation-service'

function buildTransaction({
    existingParticipant = null,
    existingMemberParticipants = [],
    memberCampaigns = [],
}: {
    existingParticipant?: {
        id: string
        joinedAt: Date | null
    } | null
    existingMemberParticipants?: Array<{
        campaignId: string
        id: string
        joinedAt: Date | null
        removedAt: Date | null
    }>
    memberCampaigns?: Array<{
        id: string
    }>
}) {
    return {
        auditLog: {
            create: vi.fn(async () => undefined),
        },
        campaign: {
            findMany: vi.fn(async () => memberCampaigns),
        },
        roleAssignment: {
            findUnique: vi.fn(async () => null),
            create: vi.fn(async () => undefined),
        },
        invitation: {
            update: vi.fn(async () => undefined),
        },
        user: {
            create: vi.fn(async () => ({ id: 'user-new' })),
            update: vi.fn(async () => ({
                id: existingParticipant?.id ?? 'user-existing',
            })),
        },
        campaignParticipant: {
            create: vi.fn(async () => ({ id: 'participant-new' })),
            findMany: vi.fn(async () => existingMemberParticipants),
            findUnique: vi.fn(async () => existingParticipant),
            update: vi.fn(async () => ({
                id: existingParticipant?.id ?? 'participant-existing',
            })),
        },
    }
}

const baseInput = {
    invitation: {
        email: 'reader@example.com',
        id: 'invite-1',
        campaign: {
            id: 'campaign-1',
            name: 'Spring Story Sprint 2026',
        },
    },
    now: new Date('2026-05-08T12:00:00.000Z'),
    userId: 'user-1',
}

describe('recordInvitationAcceptance', () => {
    it('creates a participant when the user is new to the campaign', async () => {
        const transaction = buildTransaction({})

        const result = await recordInvitationAcceptance(transaction, baseInput)

        expect(transaction.campaignParticipant.create).toHaveBeenCalledWith({
            data: {
                joinedAt: baseInput.now,
                campaignId: 'campaign-1',
                userId: 'user-1',
            },
            select: {
                id: true,
            },
        })
        expect(transaction.campaignParticipant.update).not.toHaveBeenCalled()
        expect(transaction.invitation.update).toHaveBeenCalledWith({
            data: {
                acceptedAt: baseInput.now,
                acceptedByUserId: 'user-1',
                acceptedParticipantId: 'participant-new',
                status: 'ACCEPTED',
            },
            where: {
                id: 'invite-1',
            },
        })
        expect(transaction.auditLog.create).toHaveBeenCalledOnce()
        expect(result).toEqual({
            participantId: 'participant-new',
        })
    })

    it('restores an existing participant and preserves the original joined date', async () => {
        const originalJoinedAt = new Date('2026-05-01T12:00:00.000Z')
        const transaction = buildTransaction({
            existingParticipant: {
                id: 'participant-existing',
                joinedAt: originalJoinedAt,
            },
        })

        const result = await recordInvitationAcceptance(transaction, baseInput)

        expect(transaction.campaignParticipant.create).not.toHaveBeenCalled()
        expect(transaction.campaignParticipant.update).toHaveBeenCalledWith({
            data: {
                joinedAt: originalJoinedAt,
                removedAt: null,
            },
            select: {
                id: true,
            },
            where: {
                id: 'participant-existing',
            },
        })
        expect(transaction.invitation.update).toHaveBeenCalledWith({
            data: {
                acceptedAt: baseInput.now,
                acceptedByUserId: 'user-1',
                acceptedParticipantId: 'participant-existing',
                status: 'ACCEPTED',
            },
            where: {
                id: 'invite-1',
            },
        })
        expect(result).toEqual({
            participantId: 'participant-existing',
        })
    })

    it('provisions current and upcoming campaign participants for a site-only invitation', async () => {
        const transaction = buildTransaction({
            memberCampaigns: [{ id: 'campaign-1' }, { id: 'campaign-2' }],
        })

        const result = await recordInvitationAcceptance(transaction, {
            ...baseInput,
            invitation: {
                email: 'reader@example.com',
                id: 'invite-site',
                campaign: null,
            },
        })

        expect(
            transaction.campaignParticipant.findUnique
        ).not.toHaveBeenCalled()
        expect(transaction.campaign.findMany).toHaveBeenCalledOnce()
        expect(transaction.campaignParticipant.findMany).toHaveBeenCalledWith({
            select: {
                campaignId: true,
                id: true,
                joinedAt: true,
                removedAt: true,
            },
            where: {
                campaignId: {
                    in: ['campaign-1', 'campaign-2'],
                },
                userId: 'user-1',
            },
        })
        expect(transaction.campaignParticipant.create).toHaveBeenCalledTimes(2)
        expect(transaction.campaignParticipant.create).toHaveBeenNthCalledWith(
            1,
            {
                data: {
                    campaignId: 'campaign-1',
                    joinedAt: baseInput.now,
                    userId: 'user-1',
                },
                select: {
                    id: true,
                },
            }
        )
        expect(transaction.campaignParticipant.create).toHaveBeenNthCalledWith(
            2,
            {
                data: {
                    campaignId: 'campaign-2',
                    joinedAt: baseInput.now,
                    userId: 'user-1',
                },
                select: {
                    id: true,
                },
            }
        )
        expect(transaction.campaignParticipant.update).not.toHaveBeenCalled()
        expect(transaction.invitation.update).toHaveBeenCalledWith({
            data: {
                acceptedAt: baseInput.now,
                acceptedByUserId: 'user-1',
                acceptedParticipantId: null,
                status: 'ACCEPTED',
            },
            where: {
                id: 'invite-site',
            },
        })
        expect(transaction.auditLog.create).toHaveBeenCalledWith({
            data: {
                action: 'invitation.accepted',
                actorUserId: 'user-1',
                entityId: 'invite-site',
                entityType: 'Invitation',
                invitationId: 'invite-site',
                metadata: {
                    acceptedAt: baseInput.now.toISOString(),
                    email: 'reader@example.com',
                    campaignName: null,
                },
                campaignId: null,
                campaignParticipantId: null,
            },
        })
        expect(result).toEqual({
            participantId: null,
        })
    })
})

describe('provisionInvitationAccount', () => {
    it('creates a new password-backed competitor account and accepts the invitation', async () => {
        const transaction = buildTransaction({})

        const result = await provisionInvitationAccount(transaction, {
            invitation: baseInput.invitation,
            name: 'Reader One',
            now: baseInput.now,
            passwordHash: 'hash-1',
        })

        expect(transaction.user.create).toHaveBeenCalledWith({
            data: {
                authMethod: 'PASSWORD',
                email: 'reader@example.com',
                lastPasswordChangeAt: baseInput.now,
                name: 'Reader One',
                passwordHash: 'hash-1',
                passwordSetAt: baseInput.now,
            },
        })
        expect(transaction.roleAssignment.create).toHaveBeenCalledWith({
            data: {
                role: 'COMPETITOR',
                userId: 'user-new',
            },
        })
        expect(transaction.invitation.update).toHaveBeenCalledWith({
            data: {
                acceptedAt: baseInput.now,
                acceptedByUserId: 'user-new',
                acceptedParticipantId: 'participant-new',
                status: 'ACCEPTED',
            },
            where: {
                id: 'invite-1',
            },
        })
        expect(result).toEqual({
            participantId: 'participant-new',
            userId: 'user-new',
        })
    })

    it('reuses an existing passwordless user and preserves an existing competitor role', async () => {
        const transaction = buildTransaction({})

        transaction.roleAssignment.findUnique = vi.fn(async () => ({
            id: 'role-1',
        }))
        transaction.user.update = vi.fn(async () => ({ id: 'user-existing' }))

        const result = await provisionInvitationAccount(transaction, {
            existingUserId: 'user-existing',
            invitation: {
                ...baseInput.invitation,
                campaign: null,
            },
            name: 'Existing Reader',
            now: baseInput.now,
            passwordHash: 'hash-2',
        })

        expect(transaction.user.create).not.toHaveBeenCalled()
        expect(transaction.user.update).toHaveBeenCalledWith({
            data: {
                authMethod: 'PASSWORD',
                lastPasswordChangeAt: baseInput.now,
                name: 'Existing Reader',
                passwordHash: 'hash-2',
                passwordSetAt: baseInput.now,
            },
            where: {
                id: 'user-existing',
            },
        })
        expect(transaction.roleAssignment.create).not.toHaveBeenCalled()
        expect(result).toEqual({
            participantId: null,
            userId: 'user-existing',
        })
    })
})
