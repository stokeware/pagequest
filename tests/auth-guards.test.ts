import type { Session } from 'next-auth'
import { describe, expect, it } from 'vitest'

import {
    AuthSessionError,
    deriveAdminServerActionAccess,
    deriveServerActionAccess,
    deriveRoleAwareSession,
    getAdminRouteRedirectPath,
    getProtectedRouteRedirectPath,
} from '@/lib/auth/session'

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

describe('getProtectedRouteRedirectPath', () => {
    it('redirects signed-out viewers to sign in with a callback URL', () => {
        const viewer = deriveRoleAwareSession({
            expectedRole: 'COMPETITOR',
            session: null,
        })

        expect(
            getProtectedRouteRedirectPath({
                callbackUrl: '/dashboard',
                viewer,
            })
        ).toBe('/sign-in?callbackUrl=%2Fdashboard')
    })

    it('redirects wrong-role competitors away from admin routes', () => {
        const viewer = deriveRoleAwareSession({
            expectedRole: 'ADMIN',
            session: buildSession({
                roles: ['COMPETITOR'],
            }),
        })

        expect(
            getProtectedRouteRedirectPath({
                callbackUrl: '/admin',
                viewer,
            })
        ).toBe('/dashboard')
    })

    it('treats signed-in viewers without admin access as competitors', () => {
        const viewer = deriveRoleAwareSession({
            expectedRole: 'COMPETITOR',
            session: buildSession({
                roles: [],
            }),
        })

        expect(
            getProtectedRouteRedirectPath({
                callbackUrl: '/dashboard',
                viewer,
            })
        ).toBeNull()
    })

    it('allows authorized viewers to stay on the route', () => {
        const viewer = deriveRoleAwareSession({
            expectedRole: 'ADMIN',
            session: buildSession({
                roles: ['ADMIN'],
            }),
        })

        expect(
            getProtectedRouteRedirectPath({
                callbackUrl: '/admin',
                viewer,
            })
        ).toBeNull()
    })
})

describe('getAdminRouteRedirectPath', () => {
    it('reuses the admin callback path when a competitor is signed in', () => {
        const viewer = deriveRoleAwareSession({
            expectedRole: 'ADMIN',
            session: buildSession({
                roles: ['COMPETITOR'],
            }),
        })

        expect(
            getAdminRouteRedirectPath({
                viewer,
            })
        ).toBe('/dashboard')
    })
})

describe('deriveServerActionAccess', () => {
    it('rejects unauthenticated action calls', () => {
        const access = deriveServerActionAccess({
            session: null,
        })

        expect(access.user).toBeNull()
        expect(access.error).toBeInstanceOf(AuthSessionError)
        expect(access.error?.code).toBe('AUTHENTICATION_REQUIRED')
    })

    it('rejects signed-in users without the required role', () => {
        const access = deriveServerActionAccess({
            requiredRole: 'ADMIN',
            session: buildSession({
                roles: ['COMPETITOR'],
            }),
        })

        expect(access.user).toBeNull()
        expect(access.error?.code).toBe('AUTHORIZATION_REQUIRED')
    })

    it('returns the authenticated user when the role requirement is met', () => {
        const access = deriveServerActionAccess({
            requiredRole: 'ADMIN',
            session: buildSession({
                roles: ['ADMIN'],
            }),
        })

        expect(access.error).toBeNull()
        expect(access.user).toEqual({
            email: 'reader@example.com',
            id: 'user-1',
            name: 'Reader One',
            roles: ['ADMIN'],
        })
    })
})

describe('deriveAdminServerActionAccess', () => {
    it('requires the admin role for protected mutations', () => {
        const deniedAccess = deriveAdminServerActionAccess({
            session: buildSession({
                roles: ['COMPETITOR'],
            }),
        })

        expect(deniedAccess.user).toBeNull()
        expect(deniedAccess.error?.code).toBe('AUTHORIZATION_REQUIRED')

        const allowedAccess = deriveAdminServerActionAccess({
            session: buildSession({
                roles: ['ADMIN'],
            }),
        })

        expect(allowedAccess.error).toBeNull()
        expect(allowedAccess.user?.roles).toEqual(['ADMIN'])
    })
})
