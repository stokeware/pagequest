import { describe, expect, it, vi } from 'vitest'

import { buildInvitationEmailMessage } from '@/lib/email/invitation'

describe('buildInvitationEmailMessage', () => {
    it('builds a delivery message with the secure membership link and campaign details', () => {
        vi.stubEnv('EMAIL_FROM', 'Page Quest <noreply@pagequest.local>')

        const message = buildInvitationEmailMessage({
            expiresAt: new Date('2026-05-15T05:00:00.000Z'),
            invitationUrl: 'http://127.0.0.1:3000/accept-invitation?token=abc',
            campaignName: 'Spring Story Sprint 2026',
            recipientEmail: 'reader@example.com',
        })

        expect(message.senderAddress).toBe(
            'Page Quest <noreply@pagequest.local>'
        )
        expect(message.content.subject).toBe("You're invited to Page Quest")
        expect(message.content.plainText).toContain(
            'http://127.0.0.1:3000/accept-invitation?token=abc'
        )
        expect(message.content.plainText).toContain(
            'create a password or sign in'
        )
        expect(message.content.html).toContain(
            'Open your secure invitation link'
        )
        expect(message.content.html).toContain('Spring Story Sprint 2026')
        expect(message.recipients.to).toEqual([
            {
                address: 'reader@example.com',
            },
        ])

        vi.unstubAllEnvs()
    })

    it('builds a delivery message for site-only invitations', () => {
        vi.stubEnv('EMAIL_FROM', 'Page Quest <noreply@pagequest.local>')

        const message = buildInvitationEmailMessage({
            expiresAt: new Date('2026-05-15T05:00:00.000Z'),
            invitationUrl: 'http://127.0.0.1:3000/accept-invitation?token=abc',
            recipientEmail: 'reader@example.com',
        })

        expect(message.content.plainText).toContain(
            'sets up your Page Quest account and unlocks Page Quest member access'
        )
        expect(message.content.html).not.toContain('Spring Story Sprint 2026')

        vi.unstubAllEnvs()
    })
})
