import { describe, expect, it } from 'vitest'

import {
    INVITATION_TTL_DAYS,
    buildInvitationExpiry,
    buildInvitationAcceptPath,
    buildInvitationAcceptUrl,
    canResendInvitation,
    canRevokeInvitation,
    deriveInvitationTokenSummary,
    getEffectiveInvitationStatus,
    getInvitationTokenState,
    hashInvitationToken,
    normalizeInvitationEmail,
    prepareInvitationCreateValues,
    prepareInvitationResendValues,
} from '@/lib/invitation-admin'

describe('normalizeInvitationEmail', () => {
    it('trims whitespace and lowercases the invited email', () => {
        expect(normalizeInvitationEmail(' Reader@Example.COM  ')).toBe(
            'reader@example.com'
        )
    })
})

describe('buildInvitationExpiry', () => {
    it('extends the invitation window by the default ttl', () => {
        const now = new Date('2026-05-08T12:00:00.000Z')

        expect(buildInvitationExpiry(now)).toEqual(
            new Date(
                now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000
            )
        )
    })
})

describe('secure invitation links', () => {
    it('hashes raw tokens before persistence', () => {
        expect(hashInvitationToken('plain-token')).toHaveLength(64)
        expect(hashInvitationToken('plain-token')).not.toBe('plain-token')
    })

    it('builds the public accept-invitation path and absolute url', () => {
        const path = buildInvitationAcceptPath('abc123')

        expect(path).toBe('/accept-invitation?token=abc123')
        expect(
            buildInvitationAcceptUrl({
                appUrl: 'http://127.0.0.1:3000',
                token: 'abc123',
            })
        ).toBe('http://127.0.0.1:3000/accept-invitation?token=abc123')
    })
})

describe('getEffectiveInvitationStatus', () => {
    const now = new Date('2026-05-08T12:00:00.000Z')

    it('treats expired pending invitations as expired in admin views', () => {
        expect(
            getEffectiveInvitationStatus(
                {
                    expiresAt: new Date('2026-05-01T12:00:00.000Z'),
                    status: 'PENDING',
                },
                now
            )
        ).toBe('EXPIRED')
    })

    it('keeps revoked invitations revoked regardless of their expiry window', () => {
        expect(
            getEffectiveInvitationStatus(
                {
                    expiresAt: new Date('2026-05-15T12:00:00.000Z'),
                    revokedAt: new Date('2026-05-02T12:00:00.000Z'),
                    status: 'PENDING',
                },
                now
            )
        ).toBe('REVOKED')
    })
})

describe('getInvitationTokenState', () => {
    const now = new Date('2026-05-08T12:00:00.000Z')

    it('treats missing links as invalid', () => {
        expect(getInvitationTokenState(null, now)).toBe('invalid')
    })

    it('treats unexpired pending links as pending', () => {
        expect(
            getInvitationTokenState(
                {
                    expiresAt: new Date('2026-05-15T12:00:00.000Z'),
                    status: 'PENDING',
                },
                now
            )
        ).toBe('pending')
    })
})

describe('deriveInvitationTokenSummary', () => {
    const now = new Date('2026-05-08T12:00:00.000Z')

    it('summarizes valid secure links with the invited account email', () => {
        const summary = deriveInvitationTokenSummary({
            invitation: {
                email: 'reader@example.com',
                expiresAt: new Date('2026-05-15T12:00:00.000Z'),
                quest: {
                    name: 'Spring Story Sprint 2026',
                },
                status: 'PENDING',
            },
            now,
        })

        expect(summary.state).toBe('pending')
        expect(summary.invitationEmail).toBe('reader@example.com')
        expect(summary.summary).toContain('secure invite link is valid')
    })

    it('summarizes invalid secure links clearly', () => {
        const summary = deriveInvitationTokenSummary({
            invitation: null,
            now,
        })

        expect(summary.state).toBe('invalid')
        expect(summary.summary).toContain('not recognized')
    })
})

describe('invitation lifecycle actions', () => {
    const now = new Date('2026-05-08T12:00:00.000Z')

    it('allows resend for expired and revoked invitations', () => {
        expect(
            canResendInvitation(
                {
                    expiresAt: new Date('2026-05-01T12:00:00.000Z'),
                    status: 'PENDING',
                },
                now
            )
        ).toBe(true)

        expect(
            canResendInvitation(
                {
                    expiresAt: new Date('2026-05-15T12:00:00.000Z'),
                    status: 'REVOKED',
                },
                now
            )
        ).toBe(true)
    })

    it('blocks resend and revoke once an invitation has been accepted', () => {
        const acceptedInvitation = {
            acceptedAt: new Date('2026-05-05T12:00:00.000Z'),
            expiresAt: new Date('2026-05-15T12:00:00.000Z'),
            status: 'ACCEPTED' as const,
        }

        expect(canResendInvitation(acceptedInvitation, now)).toBe(false)
        expect(canRevokeInvitation(acceptedInvitation, now)).toBe(false)
    })

    it('blocks revoke for invitations that are already revoked', () => {
        expect(
            canRevokeInvitation(
                {
                    expiresAt: new Date('2026-05-15T12:00:00.000Z'),
                    revokedAt: new Date('2026-05-05T12:00:00.000Z'),
                    status: 'REVOKED',
                },
                now
            )
        ).toBe(false)
    })
})

describe('prepareInvitationCreateValues', () => {
    it('issues a new pending invitation token and timestamps the send', () => {
        const now = new Date('2026-05-08T12:00:00.000Z')
        const invitation = prepareInvitationCreateValues({ now })

        expect(invitation.status).toBe('PENDING')
        expect(invitation.lastSentAt).toEqual(now)
        expect(invitation.expiresAt).toEqual(buildInvitationExpiry(now))
        expect(invitation.revokedAt).toBeNull()
        expect(invitation.token).not.toHaveLength(0)
        expect(invitation.tokenHash).not.toBe(invitation.token)
    })

    it('rotates token material when an invitation is resent', () => {
        const now = new Date('2026-05-08T12:00:00.000Z')
        const resentInvitation = prepareInvitationResendValues({ now })

        expect(resentInvitation.status).toBe('PENDING')
        expect(resentInvitation.lastSentAt).toEqual(now)
        expect(resentInvitation.tokenHash).not.toBe(resentInvitation.token)
    })
})