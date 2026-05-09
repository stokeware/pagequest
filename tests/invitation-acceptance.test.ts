import { describe, expect, it } from 'vitest'

import { deriveInvitationAcceptanceProfile } from '@/lib/invitation-acceptance'

const baseInvitation = {
    email: 'reader@example.com',
    expiresAt: new Date('2026-05-15T12:00:00.000Z'),
    quest: {
        name: 'Spring Story Sprint 2026',
        status: 'ACTIVE' as const,
        visibility: 'INVITE_ONLY' as const,
    },
    status: 'PENDING' as const,
}

describe('deriveInvitationAcceptanceProfile', () => {
    const now = new Date('2026-05-08T12:00:00.000Z')

    it('requires sign-in before a pending invitation can be accepted', () => {
        const profile = deriveInvitationAcceptanceProfile({
            invitation: baseInvitation,
            now,
            viewer: {
                userEmail: null,
                userId: null,
            },
        })

        expect(profile.state).toBe('sign-in-required')
        expect(profile.canAccept).toBe(false)
    })

    it('blocks acceptance when the signed-in email does not match', () => {
        const profile = deriveInvitationAcceptanceProfile({
            invitation: baseInvitation,
            now,
            viewer: {
                userEmail: 'other@example.com',
                userId: 'user-1',
            },
        })

        expect(profile.state).toBe('wrong-account')
        expect(profile.summary).toContain('other@example.com')
    })

    it('allows acceptance when the invited account is signed in', () => {
        const profile = deriveInvitationAcceptanceProfile({
            invitation: baseInvitation,
            now,
            viewer: {
                userEmail: 'reader@example.com',
                userId: 'user-1',
            },
        })

        expect(profile.state).toBe('ready')
        expect(profile.canAccept).toBe(true)
    })

    it('blocks archived quests even if the token is otherwise valid', () => {
        const profile = deriveInvitationAcceptanceProfile({
            invitation: {
                ...baseInvitation,
                quest: {
                    ...baseInvitation.quest,
                    status: 'ARCHIVED',
                },
            },
            now,
            viewer: {
                userEmail: 'reader@example.com',
                userId: 'user-1',
            },
        })

        expect(profile.state).toBe('invalid')
    })

    it('surfaces accepted invitations as already settled', () => {
        const profile = deriveInvitationAcceptanceProfile({
            invitation: {
                ...baseInvitation,
                acceptedByUserId: 'user-1',
                status: 'ACCEPTED',
            },
            now,
            viewer: {
                userEmail: 'reader@example.com',
                userId: 'user-1',
            },
        })

        expect(profile.state).toBe('accepted')
        expect(profile.canAccept).toBe(false)
    })
})
