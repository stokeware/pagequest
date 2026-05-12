import { describe, expect, it } from 'vitest'

import {
    getAdminMiddlewareRedirectPath,
    getCompetitorMiddlewareRedirectPath,
} from '@/lib/auth/middleware'

function buildIdentity(
    overrides: Partial<{
        email: string
        roles?: Array<'ADMIN' | 'COMPETITOR'>
        userId: string
    }> = {}
) {
    return {
        email: 'reader@example.com',
        roles: [],
        userId: 'user-1',
        ...overrides,
    } as const
}

describe('getAdminMiddlewareRedirectPath', () => {
    it('redirects signed-out admin requests to sign in with the full callback URL', () => {
        expect(
            getAdminMiddlewareRedirectPath({
                callbackUrl: '/admin/reports?view=weekly',
                identity: null,
            })
        ).toBe('/sign-in?callbackUrl=%2Fadmin%2Freports%3Fview%3Dweekly')
    })

    it('redirects non-admin users to their best available route', () => {
        expect(
            getAdminMiddlewareRedirectPath({
                callbackUrl: '/admin',
                identity: buildIdentity({
                    roles: ['COMPETITOR'],
                }),
            })
        ).toBe('/dashboard')
    })

    it('allows admin users through middleware', () => {
        expect(
            getAdminMiddlewareRedirectPath({
                callbackUrl: '/admin',
                identity: buildIdentity({
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
                callbackUrl: '/campaign-board?tab=audio',
                identity: null,
            })
        ).toBe('/sign-in?callbackUrl=%2Fcampaign-board%3Ftab%3Daudio')
    })

    it('redirects admin-only users to their best available route', () => {
        expect(
            getCompetitorMiddlewareRedirectPath({
                callbackUrl: '/campaign-board',
                identity: buildIdentity({
                    roles: ['ADMIN'],
                }),
            })
        ).toBe('/admin')
    })

    it('treats authenticated users without admin access as competitors', () => {
        expect(
            getCompetitorMiddlewareRedirectPath({
                callbackUrl: '/campaign-board',
                identity: buildIdentity({
                    roles: [],
                }),
            })
        ).toBeNull()
    })

    it('allows competitor users through middleware', () => {
        expect(
            getCompetitorMiddlewareRedirectPath({
                callbackUrl: '/campaign-board',
                identity: buildIdentity({
                    roles: ['COMPETITOR'],
                }),
            })
        ).toBeNull()
    })
})
