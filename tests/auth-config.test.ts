import { describe, expect, it } from 'vitest'

import {
    getAuthMode,
    getAuthUiConfig,
    getEntraExternalIdConfig,
    getLocalAuthPassphrase,
} from '@/lib/auth/config'

describe('auth config', () => {
    it('defaults to local auth mode', () => {
        expect(getAuthMode({})).toBe('local')
        expect(getLocalAuthPassphrase({})).toBe('pagequest-local')
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
})
