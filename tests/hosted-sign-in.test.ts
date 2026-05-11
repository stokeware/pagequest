import { describe, expect, it } from 'vitest'

import {
    buildHostedAuthPath,
    getHostedAuthRequest,
    getHostedAuthSignInOptions,
} from '@/lib/auth/hosted-sign-in'

describe('hosted invitation auth helpers', () => {
    it('builds a hosted signup path that preserves callback and invited email', () => {
        expect(
            buildHostedAuthPath({
                callbackUrl: '/accept-invitation?token=abc123',
                flow: 'signup',
                loginHint: 'reader@example.com',
            })
        ).toBe(
            '/sign-in?callbackUrl=%2Faccept-invitation%3Ftoken%3Dabc123&screen_hint=signup&login_hint=reader%40example.com'
        )
    })

    it('parses hosted auth request state from the sign-in search params', () => {
        const request = getHostedAuthRequest(
            new URLSearchParams({
                callbackUrl: '/accept-invitation?token=abc123',
                login_hint: 'reader@example.com',
                screen_hint: 'signup',
            })
        )

        expect(request).toEqual({
            callbackUrl: '/accept-invitation?token=abc123',
            flow: 'signup',
            loginHint: 'reader@example.com',
        })
        expect(getHostedAuthSignInOptions(request)).toEqual({
            callbackUrl: '/accept-invitation?token=abc123',
            login_hint: 'reader@example.com',
            screen_hint: 'signup',
        })
    })

    it('defaults to the hosted login flow when no signup hint is present', () => {
        const request = getHostedAuthRequest(new URLSearchParams())

        expect(request).toEqual({
            callbackUrl: '/',
            flow: 'login',
            loginHint: null,
        })
        expect(getHostedAuthSignInOptions(request)).toEqual({
            callbackUrl: '/',
        })
    })
})
