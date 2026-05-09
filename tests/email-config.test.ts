import { describe, expect, it } from 'vitest'

import {
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

    it('rejects unsupported hosted email delivery modes', () => {
        expect(() =>
            getEmailDeliveryMode({
                PAGEQUEST_EMAIL_DELIVERY_MODE: 'legacy-mode',
            })
        ).toThrow(/PAGEQUEST_EMAIL_DELIVERY_MODE.*smtp/)
    })

    it('requires the sender address for any delivery mode', () => {
        expect(() => getEmailDeliveryConfig({})).toThrow(/EMAIL_FROM/)
    })
})
