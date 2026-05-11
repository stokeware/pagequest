'use server'

import { getServerSession } from 'next-auth/next'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { authOptions } from '@/lib/auth'
import { sendInvitationEmail } from '@/lib/email/invitation'
import {
    buildInvitationAcceptUrl,
    canResendInvitation,
    canRevokeInvitation,
    isValidInvitationEmail,
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

const adminMembersPath = '/admin/members'
const appUrl = getAppUrl()
const invitationCreateRateLimit = {
    maxAttempts: 12,
    windowMs: 10 * 60 * 1000,
} as const
const invitationResendRateLimit = {
    maxAttempts: 4,
    windowMs: 15 * 60 * 1000,
} as const

function isRedirectSignal(error: unknown) {
    if (typeof error !== 'object' || error === null) {
        return false
    }

    const digest = 'digest' in error ? error.digest : null

    return typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message
    }

    return typeof error === 'string' ? error : null
}

function resolveUnexpectedActionDetail(error: unknown) {
    const errorMessage = getErrorMessage(error)?.toLowerCase() ?? ''

    if (
        errorMessage.includes('campaignid') &&
        (errorMessage.includes('null') ||
            errorMessage.includes('not null') ||
            errorMessage.includes('constraint'))
    ) {
        return 'schema-outdated'
    }

    return 'unexpected-error'
}

function finishUnexpectedAction(error: unknown): never {
    if (isRedirectSignal(error)) {
        throw error
    }

    const detail = resolveUnexpectedActionDetail(error)

    console.error('Admin invitation action failed.', {
        detail,
        error,
    })

    finishAction({
        outcome: 'error',
        detail,
    })
}

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

    return `${adminMembersPath}?${params.toString()}`
}

function revalidateActionPath(path: string) {
    try {
        revalidatePath(path)
    } catch (error) {
        console.warn('Admin invitation revalidation failed.', {
            error,
            path,
        })
    }
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
    revalidateActionPath(adminMembersPath)
    revalidateActionPath('/admin/invitations')
    revalidateActionPath('/accept-invitation')
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
    email,
}: {
    actorUserId: string
    email: string
}) {
    return `invitation-create:${actorUserId}:${email}`
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
    errorMessage,
    invitationId,
    stage,
}: {
    actorUserId: string
    campaignId: string | null
    campaignName: string | null
    email: string
    errorMessage: string | null
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
                errorMessage,
                stage,
            },
        },
    })
}

function resolveDeliveryFailureMessage(error: unknown) {
    return getErrorMessage(error)
}

function logInvitationDeliveryFailure({
    campaignId,
    email,
    error,
    invitationId,
    stage,
}: {
    campaignId: string | null
    email: string
    error: unknown
    invitationId: string
    stage: 'created' | 'resent'
}) {
    console.error('Invitation email delivery failed.', {
        campaignId,
        email,
        error,
        invitationId,
        stage,
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
    campaignName: string | null
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
        callbackUrl: adminMembersPath,
        viewer,
    })

    if (redirectPath) {
        redirect(redirectPath)
    }

    if (!viewer.userId) {
        redirect(`/sign-in?callbackUrl=${encodeURIComponent(adminMembersPath)}`)
    }

    return {
        email: viewer.userEmail,
        id: viewer.userId,
    }
}

export async function createInvitationAction(formData: FormData) {
    try {
        const actor = await requireAdminActionUser()
        const emailInput = getStringField(formData, 'email')

        if (!emailInput) {
            finishAction({
                outcome: 'error',
                detail: 'missing-email',
            })
        }

        const email = normalizeInvitationEmail(emailInput)

        if (!isValidInvitationEmail(email)) {
            finishAction({
                outcome: 'error',
                detail: 'invalid-email',
            })
        }

        const createRateLimit = consumeRateLimit({
            key: buildCreateInvitationRateLimitKey({
                actorUserId: actor.id,
                email,
            }),
            ...invitationCreateRateLimit,
        })

        if (!createRateLimit.allowed) {
            finishAction({
                outcome: 'error',
                detail: 'rate-limit-exceeded',
            })
        }

        const existingInvitation = await prisma.invitation.findFirst({
            select: {
                acceptedAt: true,
                id: true,
                status: true,
            },
            where: {
                email,
                status: {
                    in: ['ACCEPTED', 'PENDING'],
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

        const createdInvitation = await prisma.$transaction(
            async (transaction) => {
                const invitation = await transaction.invitation.create({
                    data: {
                        email,
                        expiresAt: values.expiresAt,
                        invitedByUserId: actor.id,
                        lastSentAt: values.lastSentAt,
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
                            campaignName: null,
                        },
                        campaignId: null,
                    },
                })

                return invitation
            }
        )

        try {
            await sendInvitationNotification({
                expiresAt: values.expiresAt,
                invitationLink,
                campaignName: null,
                recipientEmail: email,
            })
        } catch (error) {
            const errorMessage = resolveDeliveryFailureMessage(error)

            logInvitationDeliveryFailure({
                campaignId: null,
                email,
                error,
                invitationId: createdInvitation.id,
                stage: 'created',
            })

            await recordInvitationDeliveryFailureAudit({
                actorUserId: actor.id,
                campaignId: null,
                campaignName: null,
                email,
                errorMessage,
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
    } catch (error) {
        finishUnexpectedAction(error)
    }
}

export async function resendInvitationAction(formData: FormData) {
    try {
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

        if (!canResendInvitation(invitation, new Date())) {
            finishAction({
                outcome: 'error',
                detail: 'action-not-allowed',
            })
        }

        if (!isValidInvitationEmail(invitation.email)) {
            finishAction({
                outcome: 'error',
                detail: 'invalid-email',
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
                    campaignId: null,
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
                        campaignName: invitation.campaign?.name ?? null,
                    },
                    campaignId: null,
                },
            })
        })

        try {
            await sendInvitationNotification({
                expiresAt: values.expiresAt,
                invitationLink,
                campaignName: null,
                recipientEmail: invitation.email,
            })
        } catch (error) {
            const errorMessage = resolveDeliveryFailureMessage(error)

            logInvitationDeliveryFailure({
                campaignId: null,
                email: invitation.email,
                error,
                invitationId: invitation.id,
                stage: 'resent',
            })

            await recordInvitationDeliveryFailureAudit({
                actorUserId: actor.id,
                campaignId: null,
                campaignName: invitation.campaign?.name ?? null,
                email: invitation.email,
                errorMessage,
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
    } catch (error) {
        finishUnexpectedAction(error)
    }
}

export async function revokeInvitationAction(formData: FormData) {
    try {
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

        await prisma.$transaction(async (transaction) => {
            await transaction.auditLog.create({
                data: {
                    action: 'invitation.revoked',
                    actorUserId: actor.id,
                    entityId: invitation.id,
                    entityType: 'Invitation',
                    invitationId: invitation.id,
                    metadata: {
                        email: invitation.email,
                        campaignName: invitation.campaign?.name ?? null,
                    },
                    campaignId: invitation.campaign?.id ?? null,
                },
            })

            await transaction.invitation.delete({
                where: {
                    id: invitation.id,
                },
            })
        })

        finishAction({
            outcome: 'revoked',
        })
    } catch (error) {
        finishUnexpectedAction(error)
    }
}

export async function removeMemberAction(formData: FormData) {
    try {
        const actor = await requireAdminActionUser()
        const email = normalizeInvitationEmail(
            getStringField(formData, 'email')
        )
        const memberUserId = getStringField(formData, 'memberUserId') || null

        if (!email) {
            finishAction({
                outcome: 'error',
                detail: 'missing-member',
            })
        }

        const acceptedInvitations = await prisma.invitation.findMany({
            select: {
                campaignId: true,
                id: true,
            },
            where: {
                OR: [
                    {
                        acceptedByUserId: memberUserId ?? undefined,
                    },
                    {
                        email,
                    },
                ],
                status: 'ACCEPTED',
            },
        })

        if (acceptedInvitations.length === 0) {
            finishAction({
                outcome: 'error',
                detail: 'missing-member',
            })
        }

        const invitationIds = acceptedInvitations.map(
            (invitation) => invitation.id
        )
        const campaignIds = Array.from(
            new Set(
                acceptedInvitations
                    .map((invitation) => invitation.campaignId)
                    .filter((campaignId): campaignId is string =>
                        Boolean(campaignId)
                    )
            )
        )
        const now = new Date()

        await prisma.$transaction(async (transaction) => {
            await transaction.auditLog.create({
                data: {
                    action: 'member.removed',
                    actorUserId: actor.id,
                    entityId: memberUserId ?? email,
                    entityType: 'Member',
                    metadata: {
                        email,
                        removedAt: now.toISOString(),
                        removedInvitationCount: invitationIds.length,
                    },
                },
            })

            if (memberUserId) {
                if (campaignIds.length > 0) {
                    await transaction.campaignParticipant.updateMany({
                        data: {
                            removedAt: now,
                        },
                        where: {
                            campaignId: {
                                in: campaignIds,
                            },
                            removedAt: null,
                            userId: memberUserId,
                        },
                    })
                }
            }

            await transaction.invitation.deleteMany({
                where: {
                    id: {
                        in: invitationIds,
                    },
                },
            })
        })

        finishAction({
            outcome: 'removed',
        })
    } catch (error) {
        finishUnexpectedAction(error)
    }
}
