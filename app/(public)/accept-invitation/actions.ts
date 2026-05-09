'use server'

import { getServerSession } from 'next-auth/next'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { authOptions } from '@/lib/auth'
import {
    buildInvitationAcceptPath,
    hashInvitationToken,
    normalizeInvitationToken,
} from '@/lib/invitation-admin'
import { deriveInvitationAcceptanceProfile } from '@/lib/invitation-acceptance'
import { recordInvitationAcceptance } from '@/lib/invitation-service'
import { prisma } from '@/lib/prisma'
import { consumeRateLimit, resetRateLimit } from '@/lib/security/rate-limit'

const invitationAcceptRateLimit = {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
} as const

type InvitationAcceptanceAuditRecord = {
    campaign: {
        id: string
        name: string
    }
    email: string
    id: string
}

function getStringField(formData: FormData, fieldName: string) {
    const value = formData.get(fieldName)

    return typeof value === 'string' ? value.trim() : ''
}

function buildInvitationActionPath({
    detail,
    outcome,
    token,
}: {
    detail?: string
    outcome?: string
    token?: string
}) {
    const params = new URLSearchParams()

    if (token) {
        params.set('token', token)
    }

    if (outcome) {
        params.set('outcome', outcome)
    }

    if (detail) {
        params.set('detail', detail)
    }

    const query = params.toString()

    return query ? `/accept-invitation?${query}` : '/accept-invitation'
}

function buildInvitationAcceptanceRateLimitKey({
    invitationId,
    userId,
}: {
    invitationId: string
    userId: string
}) {
    return `invitation-accept:${userId}:${invitationId}`
}

async function recordInvitationAcceptanceAudit({
    action,
    actorUserId,
    attemptedEmail,
    detail,
    invitation,
}: {
    action: 'invitation.acceptance_blocked' | 'invitation.acceptance_failed'
    actorUserId: string
    attemptedEmail: string
    detail: string
    invitation: InvitationAcceptanceAuditRecord
}) {
    await prisma.auditLog.create({
        data: {
            action,
            actorUserId,
            campaignId: invitation.campaign.id,
            entityId: invitation.id,
            entityType: 'Invitation',
            invitationId: invitation.id,
            metadata: {
                attemptedEmail,
                campaignName: invitation.campaign.name,
                detail,
                invitationEmail: invitation.email,
            },
        },
    })
}

export async function acceptInvitationAction(formData: FormData) {
    const token = normalizeInvitationToken(getStringField(formData, 'token'))

    if (!token) {
        redirect(
            buildInvitationActionPath({
                detail: 'invalid-token',
                outcome: 'error',
            })
        )
    }

    const session = await getServerSession(authOptions)
    const userId = session?.user?.id ?? null
    const userEmail = session?.user?.email?.trim().toLowerCase() ?? null

    if (!userId || !userEmail) {
        redirect(
            `/sign-in?callbackUrl=${encodeURIComponent(
                buildInvitationAcceptPath(token)
            )}`
        )
    }

    const invitation = await prisma.invitation.findUnique({
        select: {
            acceptedByUserId: true,
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
            tokenHash: hashInvitationToken(token),
        },
    })

    if (invitation) {
        const rateLimitKey = buildInvitationAcceptanceRateLimitKey({
            invitationId: invitation.id,
            userId,
        })
        const rateLimitResult = consumeRateLimit({
            key: rateLimitKey,
            ...invitationAcceptRateLimit,
        })

        if (!rateLimitResult.allowed) {
            await recordInvitationAcceptanceAudit({
                action: 'invitation.acceptance_blocked',
                actorUserId: userId,
                attemptedEmail: userEmail,
                detail: 'rate-limit-exceeded',
                invitation,
            })

            redirect(
                buildInvitationActionPath({
                    detail: 'rate-limit-exceeded',
                    outcome: 'error',
                    token,
                })
            )
        }
    }

    const acceptance = deriveInvitationAcceptanceProfile({
        invitation,
        now: new Date(),
        viewer: {
            userEmail,
            userId,
        },
    })

    if (acceptance.state === 'accepted') {
        redirect('/dashboard?invitationAccepted=1')
    }

    if (!acceptance.canAccept || !invitation) {
        if (invitation) {
            await recordInvitationAcceptanceAudit({
                action: 'invitation.acceptance_blocked',
                actorUserId: userId,
                attemptedEmail: userEmail,
                detail: acceptance.state,
                invitation,
            })
        }

        redirect(
            buildInvitationActionPath({
                detail: 'invitation-unavailable',
                outcome: 'error',
                token,
            })
        )
    }

    const now = new Date()

    try {
        await prisma.$transaction(async (transaction) => {
            await recordInvitationAcceptance(transaction, {
                invitation,
                now,
                userId,
            })
        })
        resetRateLimit(
            buildInvitationAcceptanceRateLimitKey({
                invitationId: invitation.id,
                userId,
            })
        )
    } catch {
        await recordInvitationAcceptanceAudit({
            action: 'invitation.acceptance_failed',
            actorUserId: userId,
            attemptedEmail: userEmail,
            detail: 'acceptance-failed',
            invitation,
        })

        redirect(
            buildInvitationActionPath({
                detail: 'acceptance-failed',
                outcome: 'error',
                token,
            })
        )
    }

    revalidatePath('/accept-invitation')
    revalidatePath('/admin/invitations')
    revalidatePath('/dashboard')
    redirect('/dashboard?invitationAccepted=1')
}
