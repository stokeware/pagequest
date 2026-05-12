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
            emailMode: 'smtp',
            nextAuthUrl: 'http://127.0.0.1:3000',
            target: 'local',
        })
    })

    it('requires public app urls for production', () => {
        expect(() =>
            validateEnvironment({
                env: {
                    APP_URL: 'http://127.0.0.1:3000',
                    DATABASE_URL: 'postgresql://db',
                    DIRECT_URL: 'postgresql://db',
                    EMAIL_FROM: 'Page Quest <noreply@pagequest.local>',
                    NEXTAUTH_SECRET: 'a-secure-production-secret-with-32-plus',
                    NEXTAUTH_URL: 'http://localhost:3000',
                    PAGEQUEST_EMAIL_DELIVERY_MODE: 'smtp',
                    SMTP_HOST: '127.0.0.1',
                    SMTP_PASSWORD: 'smtp-password',
                    SMTP_PORT: '465',
                    SMTP_SECURE: 'false',
                    SMTP_USER: 'resend',
                },
                target: 'production',
            })
        ).toThrow(/APP_URL must not point to a loopback host in production/)
    })

    it('requires smtp credentials for production', () => {
        expect(() =>
            validateEnvironment({
                env: {
                    APP_URL: 'https://pagequest.example.com',
                    DATABASE_URL: 'postgresql://db',
                    DIRECT_URL: 'postgresql://db',
                    EMAIL_FROM: 'Page Quest <noreply@pagequest.example.com>',
                    NEXTAUTH_SECRET: 'a-secure-production-secret-with-32-plus',
                    NEXTAUTH_URL: 'https://pagequest.example.com',
                    PAGEQUEST_EMAIL_DELIVERY_MODE: 'smtp',
                    SMTP_HOST: 'smtp.resend.com',
                    SMTP_PORT: '465',
                    SMTP_SECURE: 'true',
                },
                target: 'production',
            })
        ).toThrow(/SMTP_USER|SMTP_PASSWORD/)
    })

    it('accepts a valid production environment contract', () => {
        expect(
            validateEnvironment({
                env: {
                    APP_URL: 'https://pagequest.example.com',
                    DATABASE_URL: 'postgresql://db',
                    DIRECT_URL: 'postgresql://db',
                    EMAIL_FROM: 'Page Quest <noreply@pagequest.example.com>',
                    NEXTAUTH_SECRET: 'a-secure-production-secret-with-32-plus',
                    NEXTAUTH_URL: 'https://pagequest.example.com',
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
            emailMode: 'smtp',
            nextAuthUrl: 'https://pagequest.example.com',
            target: 'production',
        })
    })
})
