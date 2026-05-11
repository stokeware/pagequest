import { describe, expect, it } from 'vitest'

import {
    getAuth0Config,
    getAuthMode,
    getAuthUiConfig,
    getLocalAuthPassphrase,
} from '@/lib/auth/config'
import {
    getDefaultProtectedPath,
    getSignedInLandingPath,
} from '@/lib/auth/access'

describe('auth config', () => {
    it('defaults to local auth mode', () => {
        expect(getAuthMode({})).toBe('local')
        expect(getLocalAuthPassphrase({})).toBe('pagequest-local')
    })

    it('accepts auth0 as the hosted auth mode', () => {
        expect(
            getAuthMode({
                PAGEQUEST_AUTH_MODE: 'auth0',
            })
        ).toBe('auth0')
    })

    it('uses the configured local passphrase when provided', () => {
        expect(
            getLocalAuthPassphrase({
                LOCAL_AUTH_PASSPHRASE: 'family-reading-club',
            })
        ).toBe('family-reading-club')
    })

    it('returns the Auth0 provider label when auth0 mode is selected', () => {
        expect(
            getAuthUiConfig({
                PAGEQUEST_AUTH_MODE: 'auth0',
            }).providerLabel
        ).toBe('Auth0')
    })

    it('rejects unsupported hosted auth modes', () => {
        expect(() =>
            getAuthMode({
                PAGEQUEST_AUTH_MODE: 'mystery',
            })
        ).toThrow(/PAGEQUEST_AUTH_MODE/)
    })

    it('requires the Auth0 configuration when requested', () => {
        expect(() => getAuth0Config({})).toThrow(/AUTH0_CLIENT_ID/)
    })

    it('returns the configured Auth0 settings', () => {
        expect(
            getAuth0Config({
                AUTH0_AUDIENCE: 'https://api.pagequest.example.com',
                AUTH0_CLIENT_ID: 'auth0-client-id',
                AUTH0_CLIENT_SECRET: 'auth0-client-secret',
                AUTH0_ISSUER: 'https://pagequest.us.auth0.com',
                AUTH0_SCOPE: 'openid profile email',
            })
        ).toEqual({
            audience: 'https://api.pagequest.example.com',
            clientId: 'auth0-client-id',
            clientSecret: 'auth0-client-secret',
            issuer: 'https://pagequest.us.auth0.com',
            scope: 'openid profile email',
        })
    })

    it('returns the local provider label when auth0 is not enabled', () => {
        expect(getAuthUiConfig({}).providerLabel).toBe(
            'Local development sign-in'
        )
    })
})

describe('auth landing paths', () => {
    it('returns the default protected path for each role set', () => {
        expect(getDefaultProtectedPath(['ADMIN'])).toBe('/admin')
        expect(getDefaultProtectedPath(['COMPETITOR'])).toBe('/dashboard')
        expect(getDefaultProtectedPath([])).toBe('/')
    })

    it('prefers an explicit protected callback URL for signed-in users', () => {
        expect(
            getSignedInLandingPath({
                callbackUrl: '/admin/reports?view=weekly',
                grantedRoles: ['ADMIN'],
            })
        ).toBe('/admin/reports?view=weekly')
    })

    it('falls back to the role landing page when callback URL is public', () => {
        expect(
            getSignedInLandingPath({
                callbackUrl: '/',
                grantedRoles: ['COMPETITOR'],
                isAuthenticated: true,
            })
        ).toBe('/dashboard')

        expect(
            getSignedInLandingPath({
                callbackUrl: '/sign-in?callbackUrl=%2Fdashboard',
                grantedRoles: ['ADMIN'],
                isAuthenticated: true,
            })
        ).toBe('/admin')
    })

    it('routes signed-in users without admin access to the dashboard', () => {
        expect(
            getSignedInLandingPath({
                callbackUrl: '/',
                grantedRoles: [],
                isAuthenticated: true,
            })
        ).toBe('/dashboard')
    })
})
