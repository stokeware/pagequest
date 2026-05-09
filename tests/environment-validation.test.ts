import { describe, expect, it } from 'vitest'

import { validateEnvironment } from '@/lib/env'

describe('environment validation', () => {
    it('accepts the local development contract with smtp delivery', () => {
        expect(
            validateEnvironment({
                env: {
                    DATABASE_URL:
                        'postgresql://pagequest:pagequest@127.0.0.1:5433/pagequest?schema=public',
                    DIRECT_URL:
                        'postgresql://pagequest:pagequest@127.0.0.1:5433/pagequest?schema=public',
                    EMAIL_FROM: 'Page Quest <noreply@pagequest.local>',
                    NEXTAUTH_SECRET: 'replace-with-a-long-random-string',
                    SMTP_HOST: '127.0.0.1',
                    SMTP_PORT: '1025',
                    SMTP_SECURE: 'false',
                },
                target: 'local',
            })
        ).toMatchObject({
            appUrl: 'http://127.0.0.1:3000',
            authMode: 'local',
            emailMode: 'smtp',
            nextAuthUrl: 'http://127.0.0.1:3000',
            target: 'local',
        })
    })

    it('rejects invalid mode values instead of silently falling back', () => {
        expect(() =>
            validateEnvironment({
                env: {
                    DATABASE_URL: 'postgresql://db',
                    DIRECT_URL: 'postgresql://db',
                    EMAIL_FROM: 'Page Quest <noreply@pagequest.local>',
                    NEXTAUTH_SECRET: 'replace-with-a-long-random-string',
                    PAGEQUEST_AUTH_MODE: 'mystery',
                    SMTP_HOST: '127.0.0.1',
                    SMTP_SECURE: 'false',
                },
                target: 'local',
            })
        ).toThrow(/PAGEQUEST_AUTH_MODE/)
    })

    it('requires hosted-only auth and email settings for production', () => {
        expect(() =>
            validateEnvironment({
                env: {
                    APP_URL: 'http://127.0.0.1:3000',
                    DATABASE_URL: 'postgresql://db',
                    DIRECT_URL: 'postgresql://db',
                    EMAIL_FROM: 'Page Quest <noreply@pagequest.local>',
                    NEXTAUTH_SECRET: 'replace-with-a-long-random-string',
                    NEXTAUTH_URL: 'http://localhost:3000',
                    PAGEQUEST_AUTH_MODE: 'local',
                    PAGEQUEST_EMAIL_DELIVERY_MODE: 'smtp',
                    SMTP_HOST: '127.0.0.1',
                    SMTP_SECURE: 'false',
                },
                target: 'production',
            })
        ).toThrow(/PAGEQUEST_AUTH_MODE must be set to "entra" for production/)
    })

    it('accepts a valid production environment contract', () => {
        expect(
            validateEnvironment({
                env: {
                    APP_URL: 'https://pagequest.example.com',
                    AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING:
                        'endpoint=https://example.communication.azure.com/;accesskey=secret',
                    DATABASE_URL: 'postgresql://db',
                    DIRECT_URL: 'postgresql://db',
                    EMAIL_FROM: 'Page Quest <noreply@pagequest.example.com>',
                    ENTRA_EXTERNAL_ID_CLIENT_ID: 'client-id',
                    ENTRA_EXTERNAL_ID_CLIENT_SECRET: 'client-secret',
                    ENTRA_EXTERNAL_ID_ISSUER:
                        'https://login.example.com/tenant/v2.0',
                    NEXTAUTH_SECRET: 'a-secure-production-secret-with-32-plus',
                    NEXTAUTH_URL: 'https://pagequest.example.com',
                    PAGEQUEST_AUTH_MODE: 'entra',
                    PAGEQUEST_EMAIL_DELIVERY_MODE:
                        'azure-communication-services',
                },
                target: 'production',
            })
        ).toMatchObject({
            appUrl: 'https://pagequest.example.com',
            authMode: 'entra',
            emailMode: 'azure-communication-services',
            nextAuthUrl: 'https://pagequest.example.com',
            target: 'production',
        })
    })
})
