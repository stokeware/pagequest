'use server'

import { type QuestStatus } from '@prisma/client'
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
import { prisma } from '@/lib/prisma'

const adminInvitationsPath = '/admin/invitations'
const appUrl =
    process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://127.0.0.1:3000'

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
}) {
    revalidatePath(adminInvitationsPath)
    redirect(
        buildRedirectUrl({
            outcome,
            detail,
            invitationLink,
        })
    )
}

async function sendInvitationNotification({
    expiresAt,
    invitationLink,
    questName,
    recipientEmail,
}: {
    expiresAt: Date
    invitationLink: string
    questName: string
    recipientEmail: string
}) {
    return sendInvitationEmail({
        expiresAt,
        invitationUrl: invitationLink,
        questName,
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
        redirect(`/sign-in?callbackUrl=${encodeURIComponent(adminInvitationsPath)}`)
    }

    return {
        email: viewer.userEmail,
        id: viewer.userId,
    }
}

async function loadTargetQuest(questId: string) {
    return prisma.quest.findFirst({
        select: {
            id: true,
            name: true,
            status: true,
        },
        where: {
            id: questId,
            status: {
                not: 'ARCHIVED' satisfies QuestStatus,
            },
            visibility: 'INVITE_ONLY',
        },
    })
}

export async function createInvitationAction(formData: FormData) {
    const actor = await requireAdminActionUser()
    const questId = getStringField(formData, 'questId')
    const emailInput = getStringField(formData, 'email')

    if (!questId) {
        finishAction({
            outcome: 'error',
            detail: 'missing-quest',
        })
    }

    if (!emailInput) {
        finishAction({
            outcome: 'error',
            detail: 'missing-email',
        })
    }

    const email = normalizeInvitationEmail(emailInput)
    const quest = await loadTargetQuest(questId)

    if (!quest) {
        finishAction({
            outcome: 'error',
            detail: 'quest-unavailable',
        })
    }

    const existingInvitation = await prisma.invitation.findUnique({
        select: {
            acceptedAt: true,
            id: true,
            status: true,
        },
        where: {
            questId_email: {
                email,
                questId,
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

    await prisma.$transaction(async (transaction) => {
        const invitation = await transaction.invitation.create({
            data: {
                email,
                expiresAt: values.expiresAt,
                invitedByUserId: actor.id,
                lastSentAt: values.lastSentAt,
                questId,
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
                    questName: quest.name,
                },
                questId,
            },
        })
    })

    try {
        await sendInvitationNotification({
            expiresAt: values.expiresAt,
            invitationLink,
            questName: quest.name,
            recipientEmail: email,
        })
    } catch {
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
            quest: {
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
        invitation.quest.status === 'ARCHIVED' ||
        invitation.quest.visibility !== 'INVITE_ONLY'
    ) {
        finishAction({
            outcome: 'error',
            detail: 'quest-unavailable',
        })
    }

    if (!canResendInvitation(invitation, new Date())) {
        finishAction({
            outcome: 'error',
            detail: 'action-not-allowed',
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
                    questName: invitation.quest.name,
                },
                questId: invitation.quest.id,
            },
        })
    })

    try {
        await sendInvitationNotification({
            expiresAt: values.expiresAt,
            invitationLink,
            questName: invitation.quest.name,
            recipientEmail: invitation.email,
        })
    } catch {
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
            quest: {
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
                    questName: invitation.quest.name,
                    revokedAt: now.toISOString(),
                },
                questId: invitation.quest.id,
            },
        })
    })

    finishAction({
        outcome: 'revoked',
    })
}