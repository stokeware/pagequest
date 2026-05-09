import { describe, expect, it } from 'vitest'

import {
    getAzureCommunicationServicesEmailConfig,
    getEmailDeliveryConfig,
    getEmailDeliveryMode,
    getSmtpEmailDeliveryConfig,
} from '@/lib/email/config'

describe('email config', () => {
    it('defaults to smtp delivery for local development', () => {
        expect(getEmailDeliveryMode({})).toBe('smtp')
    })

    it('parses smtp settings and the default sender address', () => {
        expect(
            getSmtpEmailDeliveryConfig({
                EMAIL_FROM: 'Page Quest <noreply@pagequest.local>',
                SMTP_HOST: '127.0.0.1',
                SMTP_PORT: '1025',
                SMTP_SECURE: 'false',
            })
        ).toMatchObject({
            appUrl: 'http://127.0.0.1:3000',
            fromAddress: 'Page Quest <noreply@pagequest.local>',
            host: '127.0.0.1',
            mode: 'smtp',
            port: 1025,
            secure: false,
        })
    })

    it('reads the Azure Communication Services settings when requested', () => {
        expect(
            getAzureCommunicationServicesEmailConfig({
                AZURE_COMMUNICATION_SERVICES_CONNECTION_STRING:
                    'endpoint=https://example.communication.azure.com/;accesskey=secret',
                EMAIL_FROM: 'Page Quest <noreply@pagequest.local>',
                PAGEQUEST_EMAIL_DELIVERY_MODE: 'azure-communication-services',
            })
        ).toEqual({
            appUrl: 'http://127.0.0.1:3000',
            connectionString:
                'endpoint=https://example.communication.azure.com/;accesskey=secret',
            fromAddress: 'Page Quest <noreply@pagequest.local>',
            mode: 'azure-communication-services',
        })
    })

    it('requires the sender address for any delivery mode', () => {
        expect(() => getEmailDeliveryConfig({})).toThrow(/EMAIL_FROM/)
    })
})
