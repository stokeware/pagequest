import { describe, expect, it, vi } from 'vitest'

import { buildPasswordResetEmailMessage } from '@/lib/email/password-reset'

describe('buildPasswordResetEmailMessage', () => {
    it('builds a delivery message with the secure password reset link', () => {
        vi.stubEnv('EMAIL_FROM', 'Page Quest <noreply@pagequest.local>')

        const message = buildPasswordResetEmailMessage({
            passwordResetUrl:
                'http://127.0.0.1:3000/reset-password/confirm?token=abc',
            recipientEmail: 'reader@example.com',
        })

        expect(message.senderAddress).toBe(
            'Page Quest <noreply@pagequest.local>'
        )
        expect(message.content.subject).toBe('Reset your Page Quest password')
        expect(message.content.plainText).toContain(
            'http://127.0.0.1:3000/reset-password/confirm?token=abc'
        )
        expect(message.content.html).toContain(
            'Open your secure password reset link'
        )
        expect(message.recipients.to).toEqual([
            {
                address: 'reader@example.com',
            },
        ])

        vi.unstubAllEnvs()
    })
})
