import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const passwordResetMocks = vi.hoisted(() => {
    const sendPasswordResetEmail = vi.fn()
    const transaction = {
        passwordResetToken: {
            deleteMany: vi.fn(),
        },
        session: {
            deleteMany: vi.fn(),
        },
        user: {
            update: vi.fn(),
        },
    }
    const prisma = {
        $transaction: vi.fn(),
        passwordResetToken: {
            create: vi.fn(),
            deleteMany: vi.fn(),
            findUnique: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        },
    }

    return {
        prisma,
        sendPasswordResetEmail,
        transaction,
    }
})

vi.mock('@/lib/email/password-reset', () => ({
    sendPasswordResetEmail: passwordResetMocks.sendPasswordResetEmail,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: passwordResetMocks.prisma,
}))

import {
    PASSWORD_RESET_TOKEN_LENGTH,
    getPasswordResetAccess,
    requestPasswordReset,
    resetPasswordWithToken,
} from '@/lib/password-reset'

describe('password reset service', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-05-14T18:30:00.000Z'))
        vi.clearAllMocks()
        vi.stubEnv('APP_URL', 'http://127.0.0.1:3000')
        vi.stubEnv('EMAIL_FROM', 'Page Quest <noreply@pagequest.local>')

        passwordResetMocks.prisma.$transaction.mockImplementation(
            async (
                callback: (
                    transaction: typeof passwordResetMocks.transaction
                ) => Promise<void>
            ) => callback(passwordResetMocks.transaction)
        )
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        vi.useRealTimers()
    })

    it('creates a token and sends a password reset email for a known account', async () => {
        passwordResetMocks.prisma.user.findUnique.mockResolvedValue({
            email: 'reader@example.com',
            id: 'user-1',
            passwordHash: 'existing-password-hash',
        })
        passwordResetMocks.prisma.passwordResetToken.create.mockResolvedValue({
            id: 'reset-1',
        })
        passwordResetMocks.sendPasswordResetEmail.mockResolvedValue(undefined)

        const result = await requestPasswordReset(' Reader@Example.com ')

        expect(result).toEqual({
            email: 'reader@example.com',
            sent: true,
        })
        expect(
            passwordResetMocks.prisma.passwordResetToken.deleteMany
        ).toHaveBeenCalledWith({
            where: {
                userId: 'user-1',
            },
        })
        expect(passwordResetMocks.sendPasswordResetEmail).toHaveBeenCalledWith({
            passwordResetUrl: expect.stringMatching(
                new RegExp(
                    `^http://127\\.0\\.0\\.1:3000/reset-password/confirm\\?token=[A-Za-z0-9_-]{${PASSWORD_RESET_TOKEN_LENGTH.toString()}}$`
                )
            ),
            recipientEmail: 'reader@example.com',
        })
    })

    it('returns a generic non-delivery result for unknown accounts', async () => {
        passwordResetMocks.prisma.user.findUnique.mockResolvedValue(null)

        const result = await requestPasswordReset('reader@example.com')

        expect(result).toEqual({
            email: 'reader@example.com',
            sent: false,
        })
        expect(
            passwordResetMocks.prisma.passwordResetToken.create
        ).not.toHaveBeenCalled()
        expect(passwordResetMocks.sendPasswordResetEmail).not.toHaveBeenCalled()
    })

    it('reports ready access for an active token', async () => {
        passwordResetMocks.prisma.passwordResetToken.findUnique.mockResolvedValue(
            {
                expiresAt: new Date('2026-05-14T19:30:00.000Z'),
                tokenHash: 'token-hash',
                user: {
                    email: 'reader@example.com',
                    id: 'user-1',
                },
                userId: 'user-1',
            }
        )

        const access = await getPasswordResetAccess('x'.repeat(32))

        expect(access).toEqual({
            email: 'reader@example.com',
            state: 'ready',
        })
    })

    it('updates the password, clears sessions, and deletes reset tokens', async () => {
        passwordResetMocks.prisma.passwordResetToken.findUnique.mockResolvedValue(
            {
                expiresAt: new Date('2026-05-14T19:30:00.000Z'),
                tokenHash: 'token-hash',
                user: {
                    email: 'reader@example.com',
                    id: 'user-1',
                },
                userId: 'user-1',
            }
        )

        const result = await resetPasswordWithToken({
            password: 'updated-password',
            token: 'x'.repeat(32),
        })

        expect(result).toEqual({
            email: 'reader@example.com',
            outcome: 'updated',
        })
        expect(passwordResetMocks.transaction.user.update).toHaveBeenCalledWith(
            {
                data: {
                    authMethod: 'PASSWORD',
                    lastPasswordChangeAt: new Date('2026-05-14T18:30:00.000Z'),
                    passwordHash: expect.any(String),
                    passwordSetAt: new Date('2026-05-14T18:30:00.000Z'),
                },
                where: {
                    id: 'user-1',
                },
            }
        )
        expect(
            passwordResetMocks.transaction.session.deleteMany
        ).toHaveBeenCalledWith({
            where: {
                userId: 'user-1',
            },
        })
        expect(
            passwordResetMocks.transaction.passwordResetToken.deleteMany
        ).toHaveBeenCalledWith({
            where: {
                userId: 'user-1',
            },
        })
    })
})
