import { describe, expect, it, vi } from 'vitest'

import { recordInvitationAcceptance } from '@/lib/invitation-service'

function buildTransaction({
    existingParticipant = null,
}: {
    existingParticipant?: {
        id: string
        joinedAt: Date | null
    } | null
}) {
    return {
        auditLog: {
            create: vi.fn(async () => undefined),
        },
        invitation: {
            update: vi.fn(async () => undefined),
        },
        campaignParticipant: {
            create: vi.fn(async () => ({ id: 'participant-new' })),
            findUnique: vi.fn(async () => existingParticipant),
            update: vi.fn(async () => ({
                id: existingParticipant?.id ?? 'participant-existing',
            })),
        },
        roleAssignment: {
            upsert: vi.fn(async () => undefined),
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

        expect(transaction.roleAssignment.upsert).toHaveBeenCalledOnce()
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
})
