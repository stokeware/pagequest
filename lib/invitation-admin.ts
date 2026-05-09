import { createHash, randomBytes } from 'node:crypto'

import type { InvitationStatus } from '@prisma/client'

export const INVITATION_TTL_DAYS = 7
export const INVITATION_TOKEN_BYTES = 24
export const INVITATION_TOKEN_LENGTH = 32

const invitationTokenPattern = new RegExp(
    `^[A-Za-z0-9_-]{${INVITATION_TOKEN_LENGTH.toString()}}$`
)

type InvitationLifecycleRecord = {
    acceptedAt?: Date | null
    expiresAt: Date
    revokedAt?: Date | null
    status: InvitationStatus
}

type InvitationTokenCampaignRecord = {
    name: string
}

export type InvitationTokenRecord = InvitationLifecycleRecord & {
    email: string
    campaign: InvitationTokenCampaignRecord
}

export type InvitationTokenState =
    | 'accepted'
    | 'expired'
    | 'invalid'
    | 'pending'
    | 'revoked'

export type InvitationTokenBundle = {
    expiresAt: Date
    lastSentAt: Date
    revokedAt: null
    status: 'PENDING'
    token: string
    tokenHash: string
}

export function normalizeInvitationEmail(email: string) {
    return email.trim().toLowerCase()
}

export function buildInvitationExpiry(
    now: Date,
    ttlDays = INVITATION_TTL_DAYS
) {
    return new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000)
}

export function issueInvitationToken() {
    const token = randomBytes(INVITATION_TOKEN_BYTES).toString('base64url')
    const tokenHash = hashInvitationToken(token)

    return {
        token,
        tokenHash,
    }
}

export function hashInvitationToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
}

export function normalizeInvitationToken(token: string | null | undefined) {
    const trimmedToken = token?.trim() ?? ''

    return invitationTokenPattern.test(trimmedToken) ? trimmedToken : null
}

export function buildInvitationAcceptPath(token: string) {
    const params = new URLSearchParams({ token })

    return `/accept-invitation?${params.toString()}`
}

export function buildInvitationAcceptUrl({
    appUrl,
    token,
}: {
    appUrl: string
    token: string
}) {
    return new URL(buildInvitationAcceptPath(token), appUrl).toString()
}

export function prepareInvitationCreateValues({ now }: { now: Date }) {
    const { token, tokenHash } = issueInvitationToken()

    return {
        expiresAt: buildInvitationExpiry(now),
        lastSentAt: now,
        revokedAt: null,
        status: 'PENDING',
        token,
        tokenHash,
    } satisfies InvitationTokenBundle
}

export function prepareInvitationResendValues({ now }: { now: Date }) {
    return prepareInvitationCreateValues({ now })
}

export function getInvitationTokenState(
    invitation: InvitationLifecycleRecord | null,
    now: Date
): InvitationTokenState {
    if (!invitation) {
        return 'invalid'
    }

    if (invitation.status === 'ACCEPTED') {
        return 'accepted'
    }

    if (invitation.status === 'REVOKED' || invitation.revokedAt) {
        return 'revoked'
    }

    if (invitation.status === 'EXPIRED' || invitation.expiresAt <= now) {
        return 'expired'
    }

    return 'pending'
}

export function deriveInvitationTokenSummary({
    invitation,
    now,
}: {
    invitation: InvitationTokenRecord | null
    now: Date
}) {
    const state = getInvitationTokenState(invitation, now)

    if (!invitation) {
        return {
            invitationEmail: null,
            campaignName: null,
            state,
            summary:
                'This invitation link is not recognized. Ask an administrator for a fresh invite.',
        }
    }

    if (state === 'accepted') {
        return {
            invitationEmail: invitation.email,
            campaignName: invitation.campaign.name,
            state,
            summary: `This invitation for ${invitation.campaign.name} has already been used. Sign in with the accepted account to continue.`,
        }
    }

    if (state === 'revoked') {
        return {
            invitationEmail: invitation.email,
            campaignName: invitation.campaign.name,
            state,
            summary: `This invitation for ${invitation.campaign.name} has been revoked. Ask an administrator to resend it if you should still join.`,
        }
    }

    if (state === 'expired') {
        return {
            invitationEmail: invitation.email,
            campaignName: invitation.campaign.name,
            state,
            summary: `This invitation for ${invitation.campaign.name} has expired. An administrator will need to resend it before you can join.`,
        }
    }

    return {
        invitationEmail: invitation.email,
        campaignName: invitation.campaign.name,
        state,
        summary: `This secure invite link is valid for ${invitation.campaign.name}. Sign in with ${invitation.email} to continue.`,
    }
}

export function getEffectiveInvitationStatus(
    invitation: InvitationLifecycleRecord,
    now: Date
) {
    if (invitation.status === 'ACCEPTED') {
        return 'ACCEPTED'
    }

    if (invitation.status === 'REVOKED' || invitation.revokedAt) {
        return 'REVOKED'
    }

    if (invitation.status === 'EXPIRED' || invitation.expiresAt <= now) {
        return 'EXPIRED'
    }

    return 'PENDING'
}

export function canResendInvitation(
    invitation: InvitationLifecycleRecord,
    now: Date
) {
    return getEffectiveInvitationStatus(invitation, now) !== 'ACCEPTED'
}

export function canRevokeInvitation(
    invitation: InvitationLifecycleRecord,
    now: Date
) {
    if (invitation.status === 'REVOKED' || invitation.revokedAt) {
        return false
    }

    return getEffectiveInvitationStatus(invitation, now) !== 'ACCEPTED'
}
