import type { CampaignStatus, CampaignVisibility } from '@prisma/client'

import {
    getInvitationTokenState,
    normalizeInvitationEmail,
} from '@/lib/invitation-admin'

type InvitationAcceptanceCampaignRecord = {
    name: string
    status: CampaignStatus
    visibility: CampaignVisibility
}

export type InvitationAcceptanceRecord = {
    acceptedByUserId?: string | null
    email: string
    expiresAt: Date
    campaign: InvitationAcceptanceCampaignRecord | null
    revokedAt?: Date | null
    status: 'ACCEPTED' | 'EXPIRED' | 'PENDING' | 'REVOKED'
}

export type InvitationAcceptanceViewer = {
    userEmail: string | null
    userId: string | null
}

export type InvitationAcceptanceState =
    | 'accepted'
    | 'expired'
    | 'invalid'
    | 'ready'
    | 'revoked'
    | 'sign-in-required'
    | 'wrong-account'

export type InvitationAcceptanceProfile = {
    canAccept: boolean
    expectedEmail: string | null
    campaignName: string | null
    state: InvitationAcceptanceState
    summary: string
}

function describeInvitationScope(
    campaignName: string | null,
    fallback: string
) {
    return campaignName ? `${fallback} for ${campaignName}` : fallback
}

export function deriveInvitationAcceptanceProfile({
    invitation,
    now,
    viewer,
}: {
    invitation: InvitationAcceptanceRecord | null
    now: Date
    viewer: InvitationAcceptanceViewer
}): InvitationAcceptanceProfile {
    if (!invitation) {
        return {
            canAccept: false,
            expectedEmail: null,
            campaignName: null,
            state: 'invalid',
            summary:
                'This invitation link is not recognized. Ask an administrator for a fresh invite.',
        }
    }

    if (
        invitation.campaign &&
        (invitation.campaign.status === 'ARCHIVED' ||
            invitation.campaign.visibility !== 'INVITE_ONLY')
    ) {
        return {
            canAccept: false,
            expectedEmail: invitation.email,
            campaignName: invitation.campaign.name,
            state: 'invalid',
            summary:
                'This invitation is no longer available for onboarding. Ask an administrator for an updated invite if the campaign is still open.',
        }
    }

    if (invitation.status === 'EXPIRED' || invitation.expiresAt <= now) {
        return {
            canAccept: false,
            expectedEmail: invitation.email,
            campaignName: invitation.campaign?.name ?? null,
            state: 'expired',
            summary: `${describeInvitationScope(
                invitation.campaign?.name ?? null,
                'This invitation has expired'
            )}. Ask an administrator to send a fresh invite before continuing.`,
        }
    }

    const tokenState = getInvitationTokenState(invitation, now)

    if (tokenState === 'accepted') {
        return {
            canAccept: false,
            expectedEmail: invitation.email,
            campaignName: invitation.campaign?.name ?? null,
            state: 'accepted',
            summary: `${describeInvitationScope(
                invitation.campaign?.name ?? null,
                'This invitation has already been accepted'
            )}. Sign in with the linked account to continue into Page Quest.`,
        }
    }

    if (tokenState === 'revoked') {
        return {
            canAccept: false,
            expectedEmail: invitation.email,
            campaignName: invitation.campaign?.name ?? null,
            state: 'revoked',
            summary: `${describeInvitationScope(
                invitation.campaign?.name ?? null,
                'This invitation has been revoked'
            )}. Ask an administrator to resend it if you should still join.`,
        }
    }

    if (!viewer.userId || !viewer.userEmail) {
        return {
            canAccept: false,
            expectedEmail: invitation.email,
            campaignName: invitation.campaign?.name ?? null,
            state: 'sign-in-required',
            summary: `Create your Page Quest account or sign in with ${invitation.email} to finish accepting ${invitation.campaign ? `the invitation for ${invitation.campaign.name}` : 'your site invitation'}.`,
        }
    }

    if (
        normalizeInvitationEmail(viewer.userEmail) !==
        normalizeInvitationEmail(invitation.email)
    ) {
        return {
            canAccept: false,
            expectedEmail: invitation.email,
            campaignName: invitation.campaign?.name ?? null,
            state: 'wrong-account',
            summary: `You are signed in as ${viewer.userEmail}, but this invitation belongs to ${invitation.email}. Switch to the invited email before finishing ${invitation.campaign ? `setup for ${invitation.campaign.name}` : 'your Page Quest account setup'}.`,
        }
    }

    return {
        canAccept: true,
        expectedEmail: invitation.email,
        campaignName: invitation.campaign?.name ?? null,
        state: 'ready',
        summary: invitation.campaign
            ? `Everything is ready. Accept this invitation to finish setting up Page Quest for ${viewer.userEmail} and join ${invitation.campaign.name}.`
            : `Everything is ready. Accept this invitation to finish setting up Page Quest for ${viewer.userEmail}.`,
    }
}
