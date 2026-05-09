import { describe, expect, it, vi } from 'vitest'

import { buildInvitationEmailMessage } from '@/lib/email/invitation'

describe('buildInvitationEmailMessage', () => {
    it('builds a delivery message with the secure join link and quest details', () => {
        vi.stubEnv('EMAIL_FROM', 'Page Quest <noreply@pagequest.local>')

        const message = buildInvitationEmailMessage({
            expiresAt: new Date('2026-05-15T05:00:00.000Z'),
            invitationUrl: 'http://127.0.0.1:3000/accept-invitation?token=abc',
            questName: 'Spring Story Sprint 2026',
            recipientEmail: 'reader@example.com',
        })

        expect(message.senderAddress).toBe(
            'Page Quest <noreply@pagequest.local>'
        )
        expect(message.content.subject).toContain('Spring Story Sprint 2026')
        expect(message.content.plainText).toContain(
            'http://127.0.0.1:3000/accept-invitation?token=abc'
        )
        expect(message.content.html).toContain('Open your secure invitation link')
        expect(message.recipients.to).toEqual([
            {
                address: 'reader@example.com',
            },
        ])

        vi.unstubAllEnvs()
    })
})