import type { JWT } from 'next-auth/jwt'
import { describe, expect, it } from 'vitest'

import {
    getAdminMiddlewareRedirectPath,
    getCompetitorMiddlewareRedirectPath,
} from '@/lib/auth/middleware'

function buildToken(
    overrides: Partial<JWT> & {
        roles?: Array<'ADMIN' | 'COMPETITOR'>
    } = {}
): JWT {
    return {
        email: 'reader@example.com',
        roles: [],
        sub: 'user-1',
        userId: 'user-1',
        ...overrides,
    }
}

describe('getAdminMiddlewareRedirectPath', () => {
    it('redirects signed-out admin requests to sign in with the full callback URL', () => {
        expect(
            getAdminMiddlewareRedirectPath({
                callbackUrl: '/admin/reports?view=weekly',
                token: null,
            })
        ).toBe('/sign-in?callbackUrl=%2Fadmin%2Freports%3Fview%3Dweekly')
    })

    it('redirects non-admin users to their best available route', () => {
        expect(
            getAdminMiddlewareRedirectPath({
                callbackUrl: '/admin',
                token: buildToken({
                    roles: ['COMPETITOR'],
                }),
            })
        ).toBe('/dashboard')
    })

    it('allows admin users through middleware', () => {
        expect(
            getAdminMiddlewareRedirectPath({
                callbackUrl: '/admin',
                token: buildToken({
                    roles: ['ADMIN'],
                }),
            })
        ).toBeNull()
    })
})

describe('getCompetitorMiddlewareRedirectPath', () => {
    it('redirects signed-out competitor requests to sign in with the full callback URL', () => {
        expect(
            getCompetitorMiddlewareRedirectPath({
                callbackUrl: '/log-progress?tab=audio',
                token: null,
            })
        ).toBe('/sign-in?callbackUrl=%2Flog-progress%3Ftab%3Daudio')
    })

    it('redirects admin-only users to their best available route', () => {
        expect(
            getCompetitorMiddlewareRedirectPath({
                callbackUrl: '/log-progress',
                token: buildToken({
                    roles: ['ADMIN'],
                }),
            })
        ).toBe('/admin')
    })

    it('routes authenticated users without any role to invitation acceptance', () => {
        expect(
            getCompetitorMiddlewareRedirectPath({
                callbackUrl: '/log-progress',
                token: buildToken({
                    roles: [],
                }),
            })
        ).toBe('/accept-invitation')
    })

    it('allows competitor users through middleware', () => {
        expect(
            getCompetitorMiddlewareRedirectPath({
                callbackUrl: '/log-progress',
                token: buildToken({
                    roles: ['COMPETITOR'],
                }),
            })
        ).toBeNull()
    })
})
