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
                    SMTP_PASSWORD: 'smtp-password',
                    SMTP_PORT: '465',
                    SMTP_SECURE: 'false',
                    SMTP_USER: 'resend',
                },
                target: 'production',
            })
        ).toThrow(/PAGEQUEST_AUTH_MODE must be set to "auth0" for production/)
    })

    it('fails clearly when hosted Auth0 or SMTP variables are missing', () => {
        expect(() =>
            validateEnvironment({
                env: {
                    APP_URL: 'https://pagequest.example.com',
                    DATABASE_URL: 'postgresql://db',
                    DIRECT_URL: 'postgresql://db',
                    EMAIL_FROM: 'Page Quest <noreply@pagequest.example.com>',
                    NEXTAUTH_SECRET: 'a-secure-production-secret-with-32-plus',
                    NEXTAUTH_URL: 'https://pagequest.example.com',
                    PAGEQUEST_AUTH_MODE: 'auth0',
                    PAGEQUEST_EMAIL_DELIVERY_MODE: 'smtp',
                    SMTP_HOST: 'smtp.resend.com',
                    SMTP_PORT: '465',
                    SMTP_SECURE: 'true',
                },
                target: 'production',
            })
        ).toThrow(/AUTH0_CLIENT_ID|SMTP_USER|SMTP_PASSWORD/)
    })

    it('accepts a valid production environment contract', () => {
        expect(
            validateEnvironment({
                env: {
                    APP_URL: 'https://pagequest.example.com',
                    AUTH0_CLIENT_ID: 'auth0-client-id',
                    AUTH0_CLIENT_SECRET: 'auth0-client-secret',
                    AUTH0_ISSUER: 'https://pagequest.us.auth0.com',
                    DATABASE_URL: 'postgresql://db',
                    DIRECT_URL: 'postgresql://db',
                    EMAIL_FROM: 'Page Quest <noreply@pagequest.example.com>',
                    NEXTAUTH_SECRET: 'a-secure-production-secret-with-32-plus',
                    NEXTAUTH_URL: 'https://pagequest.example.com',
                    PAGEQUEST_AUTH_MODE: 'auth0',
                    PAGEQUEST_EMAIL_DELIVERY_MODE: 'smtp',
                    SMTP_HOST: 'smtp.resend.com',
                    SMTP_PASSWORD: 'smtp-password',
                    SMTP_PORT: '465',
                    SMTP_SECURE: 'true',
                    SMTP_USER: 'resend',
                },
                target: 'production',
            })
        ).toMatchObject({
            appUrl: 'https://pagequest.example.com',
            authMode: 'auth0',
            emailMode: 'smtp',
            nextAuthUrl: 'https://pagequest.example.com',
            target: 'production',
        })
    })
})
