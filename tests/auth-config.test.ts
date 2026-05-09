import { describe, expect, it } from 'vitest'

import {
    getAuth0Config,
    getAuthMode,
    getAuthUiConfig,
    getEntraExternalIdConfig,
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

    it('returns the Entra provider label when entra mode is selected', () => {
        expect(
            getAuthUiConfig({
                PAGEQUEST_AUTH_MODE: 'entra',
            }).providerLabel
        ).toBe('Microsoft Entra External ID')
    })

    it('returns the Auth0 provider label when auth0 mode is selected', () => {
        expect(
            getAuthUiConfig({
                PAGEQUEST_AUTH_MODE: 'auth0',
            }).providerLabel
        ).toBe('Auth0')
    })

    it('requires the Entra configuration in entra mode', () => {
        expect(() =>
            getEntraExternalIdConfig({
                PAGEQUEST_AUTH_MODE: 'entra',
            })
        ).toThrow(/ENTRA_EXTERNAL_ID_CLIENT_ID/)
    })

    it('returns the configured Entra settings', () => {
        expect(
            getEntraExternalIdConfig({
                ENTRA_EXTERNAL_ID_CLIENT_ID: 'client-id',
                ENTRA_EXTERNAL_ID_CLIENT_SECRET: 'client-secret',
                ENTRA_EXTERNAL_ID_ISSUER:
                    'https://login.example.com/tenant/v2.0',
                ENTRA_EXTERNAL_ID_SCOPE: 'openid profile email',
            })
        ).toEqual({
            clientId: 'client-id',
            clientSecret: 'client-secret',
            issuer: 'https://login.example.com/tenant/v2.0',
            scope: 'openid profile email',
        })
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
            })
        ).toBe('/dashboard')

        expect(
            getSignedInLandingPath({
                callbackUrl: '/sign-in?callbackUrl=%2Fdashboard',
                grantedRoles: ['ADMIN'],
            })
        ).toBe('/admin')
    })

    it('stays on public routes when the signed-in user has no protected role', () => {
        expect(
            getSignedInLandingPath({
                callbackUrl: '/',
                grantedRoles: [],
            })
        ).toBeNull()
    })
})
