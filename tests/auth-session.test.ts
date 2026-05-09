import type { Session } from 'next-auth'
import { describe, expect, it } from 'vitest'

import { deriveRoleAwareSession } from '@/lib/auth/session'

function buildSession(
    overrides: Partial<Session['user']> & {
        roles?: Array<'ADMIN' | 'COMPETITOR'>
    }
): Session {
    return {
        expires: '2026-06-01T00:00:00.000Z',
        user: {
            email: 'reader@example.com',
            id: 'user-1',
            name: 'Reader One',
            roles: [],
            ...overrides,
        },
    }
}

describe('deriveRoleAwareSession', () => {
    it('marks missing sessions as signed out', () => {
        const viewer = deriveRoleAwareSession({
            expectedRole: 'ADMIN',
            session: null,
        })

        expect(viewer.accessState).toBe('signed-out')
        expect(viewer.isAuthenticated).toBe(false)
        expect(viewer.isAuthorized).toBe(false)
    })

    it('allows matching administrator access', () => {
        const viewer = deriveRoleAwareSession({
            expectedRole: 'ADMIN',
            session: buildSession({
                roles: ['ADMIN'],
            }),
        })

        expect(viewer.accessState).toBe('allowed')
        expect(viewer.summary).toContain('Administrator access')
        expect(viewer.grantedRoleLabels).toEqual(['Administrator'])
    })

    it('flags signed-in users without the expected role', () => {
        const viewer = deriveRoleAwareSession({
            expectedRole: 'ADMIN',
            session: buildSession({
                roles: ['COMPETITOR'],
            }),
        })

        expect(viewer.accessState).toBe('wrong-role')
        expect(viewer.isAuthenticated).toBe(true)
        expect(viewer.isAuthorized).toBe(false)
        expect(viewer.summary).toContain('Competitor')
        expect(viewer.summary).toContain('Administrator access is not present')
    })

    it('treats a session with no assigned roles as wrong-role', () => {
        const viewer = deriveRoleAwareSession({
            expectedRole: 'COMPETITOR',
            session: buildSession({
                roles: [],
            }),
        })

        expect(viewer.accessState).toBe('wrong-role')
        expect(viewer.summary).toContain('without a quest role assignment')
    })
})
