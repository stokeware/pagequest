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
    campaign: InvitationAcceptanceCampaignRecord
    revokedAt?: Date | null
    status: 'ACCEPTED' | 'EXPIRED' | 'PENDING' | 'REVOKED'
}

export type InvitationAcceptanceViewer = {
    userEmail: string | null
    userId: string | null
}

export type InvitationAcceptanceState =
    | 'accepted'
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
        invitation.campaign.status === 'ARCHIVED' ||
        invitation.campaign.visibility !== 'INVITE_ONLY'
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

    const tokenState = getInvitationTokenState(invitation, now)

    if (tokenState === 'accepted') {
        return {
            canAccept: false,
            expectedEmail: invitation.email,
            campaignName: invitation.campaign.name,
            state: 'accepted',
            summary: `This invitation for ${invitation.campaign.name} has already been accepted. Open the competitor dashboard with the linked account to continue.`,
        }
    }

    if (tokenState === 'revoked') {
        return {
            canAccept: false,
            expectedEmail: invitation.email,
            campaignName: invitation.campaign.name,
            state: 'revoked',
            summary: `This invitation for ${invitation.campaign.name} has been revoked. Ask an administrator to resend it if you should still join.`,
        }
    }

    if (!viewer.userId || !viewer.userEmail) {
        return {
            canAccept: false,
            expectedEmail: invitation.email,
            campaignName: invitation.campaign.name,
            state: 'sign-in-required',
            summary: `Sign in with ${invitation.email} to link your account and accept the invitation for ${invitation.campaign.name}.`,
        }
    }

    if (
        normalizeInvitationEmail(viewer.userEmail) !==
        normalizeInvitationEmail(invitation.email)
    ) {
        return {
            canAccept: false,
            expectedEmail: invitation.email,
            campaignName: invitation.campaign.name,
            state: 'wrong-account',
            summary: `You are signed in as ${viewer.userEmail}, but this invitation belongs to ${invitation.email}. Sign in with the invited account before accepting ${invitation.campaign.name}.`,
        }
    }

    return {
        canAccept: true,
        expectedEmail: invitation.email,
        campaignName: invitation.campaign.name,
        state: 'ready',
        summary: `Everything is ready. Accept the invitation to link ${viewer.userEmail} to ${invitation.campaign.name} and unlock the competitor dashboard.`,
    }
}
