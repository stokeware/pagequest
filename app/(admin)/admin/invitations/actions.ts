'use server'

import { type CampaignStatus } from '@prisma/client'
import { getServerSession } from 'next-auth/next'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { authOptions } from '@/lib/auth'
import { sendInvitationEmail } from '@/lib/email/invitation'
import {
    buildInvitationAcceptUrl,
    canResendInvitation,
    canRevokeInvitation,
    normalizeInvitationEmail,
    prepareInvitationCreateValues,
    prepareInvitationResendValues,
} from '@/lib/invitation-admin'
import {
    deriveRoleAwareSession,
    getAdminRouteRedirectPath,
} from '@/lib/auth/session'
import { getAppUrl } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { consumeRateLimit } from '@/lib/security/rate-limit'

const adminInvitationsPath = '/admin/invitations'
const appUrl = getAppUrl()
const invitationCreateRateLimit = {
    maxAttempts: 12,
    windowMs: 10 * 60 * 1000,
} as const
const invitationResendRateLimit = {
    maxAttempts: 4,
    windowMs: 15 * 60 * 1000,
} as const

function buildRedirectUrl({
    outcome,
    detail,
    invitationLink,
}: {
    outcome: string
    detail?: string
    invitationLink?: string
}) {
    const params = new URLSearchParams({ outcome })

    if (detail) {
        params.set('detail', detail)
    }

    if (invitationLink) {
        params.set('invitationLink', invitationLink)
    }

    return `${adminInvitationsPath}?${params.toString()}`
}

function finishAction({
    outcome,
    detail,
    invitationLink,
}: {
    outcome: string
    detail?: string
    invitationLink?: string
}): never {
    revalidatePath(adminInvitationsPath)
    redirect(
        buildRedirectUrl({
            outcome,
            detail,
            invitationLink,
        })
    )
}

function buildCreateInvitationRateLimitKey({
    actorUserId,
    campaignId,
}: {
    actorUserId: string
    campaignId: string
}) {
    return `invitation-create:${actorUserId}:${campaignId}`
}

function buildResendInvitationRateLimitKey({
    actorUserId,
    invitationId,
}: {
    actorUserId: string
    invitationId: string
}) {
    return `invitation-resend:${actorUserId}:${invitationId}`
}

async function recordInvitationDeliveryFailureAudit({
    actorUserId,
    campaignId,
    campaignName,
    email,
    invitationId,
    stage,
}: {
    actorUserId: string
    campaignId: string
    campaignName: string
    email: string
    invitationId: string
    stage: 'created' | 'resent'
}) {
    await prisma.auditLog.create({
        data: {
            action: 'invitation.delivery_failed',
            actorUserId,
            campaignId,
            entityId: invitationId,
            entityType: 'Invitation',
            invitationId,
            metadata: {
                campaignName,
                email,
                stage,
            },
        },
    })
}

async function sendInvitationNotification({
    expiresAt,
    invitationLink,
    campaignName,
    recipientEmail,
}: {
    expiresAt: Date
    invitationLink: string
    campaignName: string
    recipientEmail: string
}) {
    return sendInvitationEmail({
        expiresAt,
        invitationUrl: invitationLink,
        campaignName,
        recipientEmail,
    })
}

function getStringField(formData: FormData, fieldName: string) {
    const value = formData.get(fieldName)

    return typeof value === 'string' ? value.trim() : ''
}

async function requireAdminActionUser() {
    const session = await getServerSession(authOptions)
    const viewer = deriveRoleAwareSession({
        expectedRole: 'ADMIN',
        session,
    })
    const redirectPath = getAdminRouteRedirectPath({
        callbackUrl: adminInvitationsPath,
        viewer,
    })

    if (redirectPath) {
        redirect(redirectPath)
    }

    if (!viewer.userId) {
        redirect(
            `/sign-in?callbackUrl=${encodeURIComponent(adminInvitationsPath)}`
        )
    }

    return {
        email: viewer.userEmail,
        id: viewer.userId,
    }
}

async function loadTargetQuest(campaignId: string) {
    return prisma.campaign.findFirst({
        select: {
            id: true,
            name: true,
            status: true,
        },
        where: {
            id: campaignId,
            status: {
                not: 'ARCHIVED' satisfies CampaignStatus,
            },
            visibility: 'INVITE_ONLY',
        },
    })
}

export async function createInvitationAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const campaignId = getStringField(formData, 'campaignId')
    const emailInput = getStringField(formData, 'email')

    if (!campaignId) {
        finishAction({
            outcome: 'error',
            detail: 'missing-campaign',
        })
    }

    if (!emailInput) {
        finishAction({
            outcome: 'error',
            detail: 'missing-email',
        })
    }

    const email = normalizeInvitationEmail(emailInput)
    const campaign = await loadTargetQuest(campaignId)

    if (!campaign) {
        finishAction({
            outcome: 'error',
            detail: 'campaign-unavailable',
        })
    }

    const createRateLimit = consumeRateLimit({
        key: buildCreateInvitationRateLimitKey({
            actorUserId: actor.id,
            campaignId,
        }),
        ...invitationCreateRateLimit,
    })

    if (!createRateLimit.allowed) {
        finishAction({
            outcome: 'error',
            detail: 'rate-limit-exceeded',
        })
    }

    const existingInvitation = await prisma.invitation.findUnique({
        select: {
            acceptedAt: true,
            id: true,
            status: true,
        },
        where: {
            campaignId_email: {
                email,
                campaignId,
            },
        },
    })

    if (existingInvitation) {
        finishAction({
            outcome: 'error',
            detail:
                existingInvitation.status === 'ACCEPTED' ||
                existingInvitation.acceptedAt
                    ? 'accepted-invitation'
                    : 'duplicate-invitation',
        })
    }

    const now = new Date()
    const values = prepareInvitationCreateValues({ now })
    const invitationLink = buildInvitationAcceptUrl({
        appUrl,
        token: values.token,
    })

    const createdInvitation = await prisma.$transaction(async (transaction) => {
        const invitation = await transaction.invitation.create({
            data: {
                email,
                expiresAt: values.expiresAt,
                invitedByUserId: actor.id,
                lastSentAt: values.lastSentAt,
                campaignId,
                status: values.status,
                tokenHash: values.tokenHash,
            },
            select: {
                id: true,
            },
        })

        await transaction.auditLog.create({
            data: {
                action: 'invitation.created',
                actorUserId: actor.id,
                entityId: invitation.id,
                entityType: 'Invitation',
                invitationId: invitation.id,
                metadata: {
                    email,
                    expiresAt: values.expiresAt.toISOString(),
                    campaignName: campaign.name,
                },
                campaignId,
            },
        })

        return invitation
    })

    try {
        await sendInvitationNotification({
            expiresAt: values.expiresAt,
            invitationLink,
            campaignName: campaign.name,
            recipientEmail: email,
        })
    } catch {
        await recordInvitationDeliveryFailureAudit({
            actorUserId: actor.id,
            campaignId,
            campaignName: campaign.name,
            email,
            invitationId: createdInvitation.id,
            stage: 'created',
        })

        finishAction({
            outcome: 'error',
            detail: 'email-send-failed',
            invitationLink,
        })
    }

    finishAction({
        outcome: 'created',
        invitationLink,
    })
}

export async function resendInvitationAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const invitationId = getStringField(formData, 'invitationId')

    if (!invitationId) {
        finishAction({
            outcome: 'error',
            detail: 'missing-invitation',
        })
    }

    const invitation = await prisma.invitation.findUnique({
        select: {
            acceptedAt: true,
            email: true,
            expiresAt: true,
            id: true,
            campaign: {
                select: {
                    id: true,
                    name: true,
                    status: true,
                    visibility: true,
                },
            },
            revokedAt: true,
            status: true,
        },
        where: {
            id: invitationId,
        },
    })

    if (!invitation) {
        finishAction({
            outcome: 'error',
            detail: 'missing-invitation',
        })
    }

    if (
        invitation.campaign.status === 'ARCHIVED' ||
        invitation.campaign.visibility !== 'INVITE_ONLY'
    ) {
        finishAction({
            outcome: 'error',
            detail: 'campaign-unavailable',
        })
    }

    if (!canResendInvitation(invitation, new Date())) {
        finishAction({
            outcome: 'error',
            detail: 'action-not-allowed',
        })
    }

    const resendRateLimit = consumeRateLimit({
        key: buildResendInvitationRateLimitKey({
            actorUserId: actor.id,
            invitationId: invitation.id,
        }),
        ...invitationResendRateLimit,
    })

    if (!resendRateLimit.allowed) {
        finishAction({
            outcome: 'error',
            detail: 'rate-limit-exceeded',
        })
    }

    const now = new Date()
    const values = prepareInvitationResendValues({ now })
    const invitationLink = buildInvitationAcceptUrl({
        appUrl,
        token: values.token,
    })

    await prisma.$transaction(async (transaction) => {
        await transaction.invitation.update({
            data: {
                expiresAt: values.expiresAt,
                invitedByUserId: actor.id,
                lastSentAt: values.lastSentAt,
                revokedAt: null,
                status: values.status,
                tokenHash: values.tokenHash,
            },
            where: {
                id: invitation.id,
            },
        })

        await transaction.auditLog.create({
            data: {
                action: 'invitation.resent',
                actorUserId: actor.id,
                entityId: invitation.id,
                entityType: 'Invitation',
                invitationId: invitation.id,
                metadata: {
                    email: invitation.email,
                    expiresAt: values.expiresAt.toISOString(),
                    previousStatus: invitation.status,
                    campaignName: invitation.campaign.name,
                },
                campaignId: invitation.campaign.id,
            },
        })
    })

    try {
        await sendInvitationNotification({
            expiresAt: values.expiresAt,
            invitationLink,
            campaignName: invitation.campaign.name,
            recipientEmail: invitation.email,
        })
    } catch {
        await recordInvitationDeliveryFailureAudit({
            actorUserId: actor.id,
            campaignId: invitation.campaign.id,
            campaignName: invitation.campaign.name,
            email: invitation.email,
            invitationId: invitation.id,
            stage: 'resent',
        })

        finishAction({
            outcome: 'error',
            detail: 'email-send-failed',
            invitationLink,
        })
    }

    finishAction({
        outcome: 'resent',
        invitationLink,
    })
}

export async function revokeInvitationAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const invitationId = getStringField(formData, 'invitationId')

    if (!invitationId) {
        finishAction({
            outcome: 'error',
            detail: 'missing-invitation',
        })
    }

    const invitation = await prisma.invitation.findUnique({
        select: {
            acceptedAt: true,
            email: true,
            expiresAt: true,
            id: true,
            campaign: {
                select: {
                    id: true,
                    name: true,
                },
            },
            revokedAt: true,
            status: true,
        },
        where: {
            id: invitationId,
        },
    })

    if (!invitation) {
        finishAction({
            outcome: 'error',
            detail: 'missing-invitation',
        })
    }

    if (!canRevokeInvitation(invitation, new Date())) {
        finishAction({
            outcome: 'error',
            detail: 'action-not-allowed',
        })
    }

    const now = new Date()

    await prisma.$transaction(async (transaction) => {
        await transaction.invitation.update({
            data: {
                revokedAt: now,
                status: 'REVOKED',
            },
            where: {
                id: invitation.id,
            },
        })

        await transaction.auditLog.create({
            data: {
                action: 'invitation.revoked',
                actorUserId: actor.id,
                entityId: invitation.id,
                entityType: 'Invitation',
                invitationId: invitation.id,
                metadata: {
                    email: invitation.email,
                    campaignName: invitation.campaign.name,
                    revokedAt: now.toISOString(),
                },
                campaignId: invitation.campaign.id,
            },
        })
    })

    finishAction({
        outcome: 'revoked',
    })
}
