import type { AppRole, InvitationStatus, CampaignStatus } from '@prisma/client'

import {
    ensureMemberCampaignParticipants,
    getAcceptedMemberRecord,
} from '@/lib/member-access'
import { prisma } from '@/lib/prisma'

type InvitationCampaignRecord = {
    id: string
    name: string
    status: CampaignStatus
}

type InvitationRecord = {
    email: string
    expiresAt: Date
    campaign: InvitationCampaignRecord
    status: InvitationStatus
}

type ParticipantRecord = {
    joinedAt: Date | null
    campaign: InvitationCampaignRecord
}

type AcceptedMemberRecord = {
    acceptedAt: Date | null
    email: string
}

export type InvitationAccessState =
    | 'accepted'
    | 'missing'
    | 'pending'
    | 'revoked'
    | 'signed-out'

export type InvitationAccessProfile = {
    allowCompetitorRoutes: boolean
    invitationEmail: string | null
    campaignName: string | null
    redirectPath: string | null
    state: InvitationAccessState
    summary: string
}

const protectedCampaignStatuses: CampaignStatus[] = [
    'ACTIVE',
    'COMPLETED',
    'SCHEDULED',
]

function deriveInvitationAccessProfile({
    email,
    invitation,
    member,
    participant,
}: {
    email: string | null
    invitation: InvitationRecord | null
    member: AcceptedMemberRecord | null
    participant: ParticipantRecord | null
}): InvitationAccessProfile {
    if (!email) {
        return {
            allowCompetitorRoutes: false,
            invitationEmail: null,
            campaignName: null,
            redirectPath: '/sign-in?callbackUrl=%2Faccept-invitation',
            state: 'signed-out',
            summary:
                'Sign in first so Page Quest can check whether you have an invitation for the current private campaign.',
        }
    }

    if (participant) {
        return {
            allowCompetitorRoutes: true,
            invitationEmail: email,
            campaignName: participant.campaign.name,
            redirectPath: null,
            state: 'accepted',
            summary: `Invitation already accepted for ${participant.campaign.name}. You can open the competitor experience directly.`,
        }
    }

    if (member) {
        return {
            allowCompetitorRoutes: true,
            invitationEmail: member.email,
            campaignName: null,
            redirectPath: null,
            state: 'accepted',
            summary:
                'This account is a confirmed competitor and can access current and future campaigns.',
        }
    }

    if (!invitation) {
        return {
            allowCompetitorRoutes: false,
            invitationEmail: email,
            campaignName: null,
            redirectPath: '/accept-invitation',
            state: 'missing',
            summary:
                'No active invitation was found for this account, so the private campaign remains locked until an administrator invites you.',
        }
    }

    if (invitation.status === 'REVOKED') {
        return {
            allowCompetitorRoutes: false,
            invitationEmail: email,
            campaignName: invitation.campaign.name,
            redirectPath: '/accept-invitation',
            state: 'revoked',
            summary: `The invitation for ${invitation.campaign.name} has been revoked. Ask an administrator to send a new invitation if you should still join.`,
        }
    }

    return {
        allowCompetitorRoutes: false,
        invitationEmail: email,
        campaignName: invitation.campaign.name,
        redirectPath: '/accept-invitation',
        state: 'pending',
        summary: `Invitation recognized for ${invitation.campaign.name}. Finish the acceptance flow before Page Quest unlocks competitor routes for this account.`,
    }
}

export async function getInvitationAccessProfile({
    userEmail,
    userId,
}: {
    userEmail: string | null
    userId: string | null
}): Promise<InvitationAccessProfile> {
    if (!userEmail || !userId) {
        return deriveInvitationAccessProfile({
            email: null,
            invitation: null,
            member: null,
            participant: null,
        })
    }

    const member = await getAcceptedMemberRecord({
        userEmail,
        userId,
    })

    if (member) {
        await ensureMemberCampaignParticipants({
            memberSince: member.acceptedAt ?? new Date(),
            userId,
        })
    }

    const [participant, invitation] = await Promise.all([
        prisma.campaignParticipant.findFirst({
            include: {
                campaign: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            where: {
                campaign: {
                    status: {
                        in: protectedCampaignStatuses,
                    },
                    visibility: 'INVITE_ONLY',
                },
                removedAt: null,
                userId,
            },
        }),
        prisma.invitation.findFirst({
            include: {
                campaign: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            where: {
                email: userEmail,
                status: {
                    not: 'ACCEPTED',
                },
                campaign: {
                    status: {
                        in: protectedCampaignStatuses,
                    },
                    visibility: 'INVITE_ONLY',
                },
            },
        }),
    ])

    return deriveInvitationAccessProfile({
        email: userEmail,
        invitation,
        member,
        participant,
    })
}

export function shouldRedirectCompetitorAccess(
    access: InvitationAccessProfile
) {
    return !access.allowCompetitorRoutes ? access.redirectPath : null
}

export type InvitationActionUser = {
    email: string
    id: string
    roles: AppRole[]
}

export function canUseInvitationAcceptance(
    user: InvitationActionUser,
    access: InvitationAccessProfile
) {
    return access.state === 'pending' && access.invitationEmail === user.email
}

export { deriveInvitationAccessProfile }
