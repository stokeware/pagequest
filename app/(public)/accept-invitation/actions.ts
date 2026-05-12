'use server'

import { getServerSession } from 'next-auth/next'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { authOptions } from '@/lib/auth'
import { buildPasswordSignInPath } from '@/lib/auth/sign-in-path'
import { assertPasswordConfirmation, hashPassword } from '@/lib/auth/password'
import {
    buildInvitationAcceptPath,
    hashInvitationToken,
    normalizeInvitationEmail,
    normalizeInvitationToken,
} from '@/lib/invitation-admin'
import { deriveInvitationAcceptanceProfile } from '@/lib/invitation-acceptance'
import {
    provisionInvitationAccount,
    recordInvitationAcceptance,
} from '@/lib/invitation-service'
import { prisma } from '@/lib/prisma'
import { consumeRateLimit, resetRateLimit } from '@/lib/security/rate-limit'

const invitationAcceptRateLimit = {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
} as const

const invitationSignupRateLimit = {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
} as const

type InvitationAcceptanceAuditRecord = {
    campaign: {
        id: string
        name: string
    } | null
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
    action:
        | 'invitation.acceptance_blocked'
        | 'invitation.acceptance_failed'
        | 'invitation.signup_blocked'
        | 'invitation.signup_failed'
    actorUserId: string | null
    attemptedEmail: string
    detail: string
    invitation: InvitationAcceptanceAuditRecord
}) {
    await prisma.auditLog.create({
        data: {
            action,
            actorUserId,
            campaignId: invitation.campaign?.id ?? null,
            entityId: invitation.id,
            entityType: 'Invitation',
            invitationId: invitation.id,
            metadata: {
                attemptedEmail,
                campaignName: invitation.campaign?.name ?? null,
                detail,
                invitationEmail: invitation.email,
            },
        },
    })
}

function buildInvitationSignupRateLimitKey({
    invitationId,
    invitationEmail,
}: {
    invitationId: string
    invitationEmail: string
}) {
    return `invitation-signup:${invitationId}:${normalizeInvitationEmail(invitationEmail)}`
}

function getValidationErrorDetail(error: unknown) {
    if (!(error instanceof Error)) {
        return null
    }

    if (error.message === 'Passwords do not match.') {
        return 'password-mismatch'
    }

    if (error.message.startsWith('Password must ')) {
        return 'invalid-password'
    }

    return null
}

function getInvitationUnavailableRedirect(token: string) {
    return buildInvitationActionPath({
        detail: 'invitation-unavailable',
        outcome: 'error',
        token,
    })
}

async function loadInvitationByToken(token: string) {
    return prisma.invitation.findUnique({
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
}

export async function createInvitationAccountAction(formData: FormData) {
    const token = normalizeInvitationToken(getStringField(formData, 'token'))

    if (!token) {
        redirect(
            buildInvitationActionPath({
                detail: 'invalid-token',
                outcome: 'error',
            })
        )
    }

    const invitation = await loadInvitationByToken(token)
    const invitationAccess = deriveInvitationAcceptanceProfile({
        invitation,
        now: new Date(),
        viewer: {
            userEmail: null,
            userId: null,
        },
    })

    if (invitationAccess.state !== 'sign-in-required' || !invitation) {
        redirect(getInvitationUnavailableRedirect(token))
    }

    const rateLimitKey = buildInvitationSignupRateLimitKey({
        invitationEmail: invitation.email,
        invitationId: invitation.id,
    })
    const rateLimitResult = consumeRateLimit({
        key: rateLimitKey,
        ...invitationSignupRateLimit,
    })

    if (!rateLimitResult.allowed) {
        await recordInvitationAcceptanceAudit({
            action: 'invitation.signup_blocked',
            actorUserId: null,
            attemptedEmail: invitation.email,
            detail: 'signup-rate-limit-exceeded',
            invitation,
        })

        redirect(
            buildInvitationActionPath({
                detail: 'signup-rate-limit-exceeded',
                outcome: 'error',
                token,
            })
        )
    }

    const name = getStringField(formData, 'name')
    const password = getStringField(formData, 'password')
    const passwordConfirmation = getStringField(
        formData,
        'passwordConfirmation'
    )

    if (!name) {
        redirect(
            buildInvitationActionPath({
                detail: 'missing-name',
                outcome: 'error',
                token,
            })
        )
    }

    const existingUser = await prisma.user.findUnique({
        select: {
            id: true,
            passwordHash: true,
        },
        where: {
            email: normalizeInvitationEmail(invitation.email),
        },
    })

    if (existingUser?.passwordHash?.trim()) {
        await recordInvitationAcceptanceAudit({
            action: 'invitation.signup_blocked',
            actorUserId: existingUser.id,
            attemptedEmail: invitation.email,
            detail: 'account-exists',
            invitation,
        })

        redirect(
            buildInvitationActionPath({
                detail: 'account-exists',
                outcome: 'error',
                token,
            })
        )
    }

    let passwordHash: string

    try {
        assertPasswordConfirmation({
            password,
            passwordConfirmation,
        })
        passwordHash = await hashPassword(password)
    } catch (error) {
        const detail = getValidationErrorDetail(error) ?? 'invalid-password'

        redirect(
            buildInvitationActionPath({
                detail,
                outcome: 'error',
                token,
            })
        )
    }

    const now = new Date()

    try {
        await prisma.$transaction(async (transaction) => {
            await provisionInvitationAccount(transaction, {
                existingUserId: existingUser?.id ?? null,
                invitation,
                name,
                now,
                passwordHash,
            })
        })
        resetRateLimit(rateLimitKey)
    } catch {
        await recordInvitationAcceptanceAudit({
            action: 'invitation.signup_failed',
            actorUserId: existingUser?.id ?? null,
            attemptedEmail: invitation.email,
            detail: 'signup-failed',
            invitation,
        })

        redirect(
            buildInvitationActionPath({
                detail: 'signup-failed',
                outcome: 'error',
                token,
            })
        )
    }

    revalidatePath('/accept-invitation')
    revalidatePath('/admin/members')
    revalidatePath('/admin/invitations')
    revalidatePath('/dashboard')
    redirect(
        buildPasswordSignInPath({
            email: invitation.email,
            invitation: 'created',
        })
    )
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

    const invitation = await loadInvitationByToken(token)

    const session = await getServerSession(authOptions)
    const userId = session?.user?.id ?? null
    const userEmail = session?.user?.email?.trim().toLowerCase() ?? null

    if (!userId || !userEmail) {
        redirect(
            buildPasswordSignInPath({
                callbackUrl: buildInvitationAcceptPath(token),
                email: invitation?.email ?? null,
            })
        )
    }

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

        redirect(getInvitationUnavailableRedirect(token))
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
    revalidatePath('/admin/members')
    revalidatePath('/admin/invitations')
    revalidatePath('/dashboard')
    redirect('/dashboard?invitationAccepted=1')
}
