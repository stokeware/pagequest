import { createHash, randomBytes } from 'node:crypto'

import { hashPassword } from '@/lib/auth/password'
import { isValidAuthEmail, normalizeAuthEmail } from '@/lib/auth/email'
import { getEmailDeliveryConfig } from '@/lib/email/config'
import { sendPasswordResetEmail } from '@/lib/email/password-reset'
import { prisma } from '@/lib/prisma'

export const PASSWORD_RESET_TTL_HOURS = 2
export const PASSWORD_RESET_TOKEN_BYTES = 24
export const PASSWORD_RESET_TOKEN_LENGTH = 32

const passwordResetTokenPattern = new RegExp(
    `^[A-Za-z0-9_-]{${PASSWORD_RESET_TOKEN_LENGTH.toString()}}$`
)

export type PasswordResetAccess = {
    email: string | null
    state: 'expired' | 'invalid' | 'ready'
}

export function buildPasswordResetExpiry(
    now: Date,
    ttlHours = PASSWORD_RESET_TTL_HOURS
) {
    return new Date(now.getTime() + ttlHours * 60 * 60 * 1000)
}

export function hashPasswordResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
}

export function issuePasswordResetToken() {
    const token = randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('base64url')

    return {
        token,
        tokenHash: hashPasswordResetToken(token),
    }
}

export function normalizePasswordResetToken(token: string | null | undefined) {
    const trimmedToken = token?.trim() ?? ''

    return passwordResetTokenPattern.test(trimmedToken) ? trimmedToken : null
}

export function buildPasswordResetPath(token: string) {
    const params = new URLSearchParams({ token })

    return `/reset-password/confirm?${params.toString()}`
}

export function buildPasswordResetUrl({
    appUrl,
    token,
}: {
    appUrl: string
    token: string
}) {
    return new URL(buildPasswordResetPath(token), appUrl).toString()
}

export async function requestPasswordReset(email: string, now = new Date()) {
    const normalizedEmail = normalizeAuthEmail(email)

    if (!normalizedEmail || !isValidAuthEmail(normalizedEmail)) {
        throw new Error('Enter a valid email address.')
    }

    const user = await prisma.user.findUnique({
        select: {
            email: true,
            id: true,
            passwordHash: true,
        },
        where: {
            email: normalizedEmail,
        },
    })

    if (!user?.passwordHash?.trim()) {
        return {
            email: normalizedEmail,
            sent: false,
        }
    }

    const { appUrl } = getEmailDeliveryConfig()
    const { token, tokenHash } = issuePasswordResetToken()

    await prisma.passwordResetToken.deleteMany({
        where: {
            userId: user.id,
        },
    })

    await prisma.passwordResetToken.create({
        data: {
            expiresAt: buildPasswordResetExpiry(now),
            tokenHash,
            userId: user.id,
        },
    })

    try {
        await sendPasswordResetEmail({
            passwordResetUrl: buildPasswordResetUrl({
                appUrl,
                token,
            }),
            recipientEmail: user.email,
        })
    } catch (error) {
        await prisma.passwordResetToken.deleteMany({
            where: {
                tokenHash,
            },
        })

        throw error
    }

    return {
        email: normalizedEmail,
        sent: true,
    }
}

async function loadPasswordResetTokenRecord(token: string | null | undefined) {
    const normalizedToken = normalizePasswordResetToken(token)

    if (!normalizedToken) {
        return null
    }

    return prisma.passwordResetToken.findUnique({
        include: {
            user: {
                select: {
                    email: true,
                    id: true,
                },
            },
        },
        where: {
            tokenHash: hashPasswordResetToken(normalizedToken),
        },
    })
}

export async function getPasswordResetAccess(
    token: string | null | undefined,
    now = new Date()
): Promise<PasswordResetAccess> {
    const resetToken = await loadPasswordResetTokenRecord(token)

    if (!resetToken) {
        return {
            email: null,
            state: 'invalid',
        }
    }

    if (resetToken.expiresAt <= now) {
        return {
            email: resetToken.user.email,
            state: 'expired',
        }
    }

    return {
        email: resetToken.user.email,
        state: 'ready',
    }
}

export async function resetPasswordWithToken({
    password,
    token,
    now = new Date(),
}: {
    password: string
    token: string
    now?: Date
}) {
    const resetToken = await loadPasswordResetTokenRecord(token)

    if (!resetToken) {
        return {
            email: null,
            outcome: 'invalid' as const,
        }
    }

    if (resetToken.expiresAt <= now) {
        await prisma.passwordResetToken.deleteMany({
            where: {
                tokenHash: resetToken.tokenHash,
            },
        })

        return {
            email: resetToken.user.email,
            outcome: 'expired' as const,
        }
    }

    const passwordHash = await hashPassword(password)

    await prisma.$transaction(async (transaction) => {
        await transaction.user.update({
            data: {
                authMethod: 'PASSWORD',
                lastPasswordChangeAt: now,
                passwordHash,
                passwordSetAt: now,
            },
            where: {
                id: resetToken.userId,
            },
        })
        await transaction.session.deleteMany({
            where: {
                userId: resetToken.userId,
            },
        })
        await transaction.passwordResetToken.deleteMany({
            where: {
                userId: resetToken.userId,
            },
        })
    })

    return {
        email: resetToken.user.email,
        outcome: 'updated' as const,
    }
}
