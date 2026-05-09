import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createTransport, sendMail } = vi.hoisted(() => {
    const sendMail = vi.fn()
    const createTransport = vi.fn(() => ({ sendMail }))

    return {
        createTransport,
        sendMail,
    }
})

vi.mock('nodemailer', () => ({
    default: {
        createTransport,
    },
}))

import { sendEmail } from '@/lib/email/service'

describe('sendEmail', () => {
    beforeEach(() => {
        sendMail.mockReset()
        createTransport.mockClear()
        sendMail.mockResolvedValue({
            messageId: 'smtp-message-id',
        })
        vi.stubEnv('PAGEQUEST_EMAIL_DELIVERY_MODE', 'smtp')
        vi.stubEnv('EMAIL_FROM', 'Page Quest <noreply@pagequest.local>')
        vi.stubEnv('SMTP_HOST', '127.0.0.1')
        vi.stubEnv('SMTP_USER', '')
        vi.stubEnv('SMTP_PASSWORD', '')
        vi.stubEnv('SMTP_PORT', '1025')
        vi.stubEnv('SMTP_SECURE', 'false')
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('sends invitation email through the smtp adapter', async () => {
        const result = await sendEmail({
            content: {
                html: '<p>Hello</p>',
                plainText: 'Hello',
                subject: 'Invitation',
            },
            recipients: {
                to: [{ address: 'reader@example.com' }],
            },
            senderAddress: 'Page Quest <noreply@pagequest.local>',
        })

        expect(createTransport).toHaveBeenCalledWith({
            auth: undefined,
            host: '127.0.0.1',
            port: 1025,
            secure: false,
        })
        expect(sendMail).toHaveBeenCalledWith({
            from: 'Page Quest <noreply@pagequest.local>',
            html: '<p>Hello</p>',
            subject: 'Invitation',
            text: 'Hello',
            to: 'reader@example.com',
        })
        expect(result).toEqual({
            id: 'smtp-message-id',
            mode: 'smtp',
        })
    })
})
