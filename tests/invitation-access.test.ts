import { describe, expect, it } from 'vitest'

import {
    deriveInvitationAccessProfile,
    shouldRedirectCompetitorAccess,
} from '@/lib/invitation-access'

const campaign = {
    id: 'campaign-1',
    name: 'Spring Story Sprint 2026',
    status: 'ACTIVE' as const,
}

describe('deriveInvitationAccessProfile', () => {
    it('allows competitors with an existing participant record', () => {
        const access = deriveInvitationAccessProfile({
            email: 'reader@example.com',
            invitation: null,
            now: new Date('2026-05-08T12:00:00.000Z'),
            participant: {
                joinedAt: new Date('2026-05-01T12:00:00.000Z'),
                campaign,
            },
        })

        expect(access.state).toBe('accepted')
        expect(access.allowCompetitorRoutes).toBe(true)
        expect(shouldRedirectCompetitorAccess(access)).toBeNull()
    })

    it('blocks competitors with a pending invitation until acceptance', () => {
        const access = deriveInvitationAccessProfile({
            email: 'reader@example.com',
            invitation: {
                email: 'reader@example.com',
                expiresAt: new Date('2026-05-15T05:00:00.000Z'),
                campaign,
                status: 'PENDING',
            },
            now: new Date('2026-05-08T12:00:00.000Z'),
            participant: null,
        })

        expect(access.state).toBe('pending')
        expect(access.allowCompetitorRoutes).toBe(false)
        expect(shouldRedirectCompetitorAccess(access)).toBe(
            '/accept-invitation'
        )
    })

    it('marks expired invitations as blocked', () => {
        const access = deriveInvitationAccessProfile({
            email: 'reader@example.com',
            invitation: {
                email: 'reader@example.com',
                expiresAt: new Date('2026-05-01T05:00:00.000Z'),
                campaign,
                status: 'PENDING',
            },
            now: new Date('2026-05-08T12:00:00.000Z'),
            participant: null,
        })

        expect(access.state).toBe('expired')
        expect(access.allowCompetitorRoutes).toBe(false)
    })

    it('blocks users with no invitation', () => {
        const access = deriveInvitationAccessProfile({
            email: 'reader@example.com',
            invitation: null,
            now: new Date('2026-05-08T12:00:00.000Z'),
            participant: null,
        })

        expect(access.state).toBe('missing')
        expect(access.allowCompetitorRoutes).toBe(false)
        expect(access.summary).toContain('No active invitation')
    })

    it('routes signed-out users back through sign in first', () => {
        const access = deriveInvitationAccessProfile({
            email: null,
            invitation: null,
            now: new Date('2026-05-08T12:00:00.000Z'),
            participant: null,
        })

        expect(access.state).toBe('signed-out')
        expect(shouldRedirectCompetitorAccess(access)).toBe(
            '/sign-in?callbackUrl=%2Faccept-invitation'
        )
    })
})
