import { beforeEach, describe, expect, it, vi } from 'vitest'

const authProviderMocks = vi.hoisted(() => {
    const prisma = {
        session: {
            create: vi.fn(),
            delete: vi.fn(),
            findUnique: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    }

    return {
        prisma,
    }
})

vi.mock('@/lib/prisma', () => ({
    prisma: authProviderMocks.prisma,
}))

import {
    authenticatePasswordUser,
    authOptions,
    authSessionSettings,
    createAuthSession,
    deleteAuthSession,
    getAuthSessionCookie,
    loadSessionIdentity,
} from '@/lib/auth'
import { hashPassword } from '@/lib/auth/password'

function getSessionCallback() {
    const callback = authOptions.callbacks?.session

    if (!callback) {
        throw new Error('Expected authOptions.callbacks.session to be defined.')
    }

    return callback
}

describe('password authentication helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.unstubAllEnvs()
    })

    it('authenticates a user with a matching password hash', async () => {
        authProviderMocks.prisma.user.findUnique.mockResolvedValueOnce({
            email: 'reader@example.com',
            id: 'user-1',
            image: null,
            name: 'Reader One',
            passwordHash: await hashPassword('correct horse battery staple'),
            roleAssignments: [],
        })

        const user = await authenticatePasswordUser({
            email: ' Reader@Example.com ',
            password: 'correct horse battery staple',
        })

        expect(user).toEqual({
            email: 'reader@example.com',
            id: 'user-1',
            image: null,
            name: 'Reader One',
            roles: ['COMPETITOR'],
        })
        expect(authProviderMocks.prisma.user.update).toHaveBeenCalledWith({
            data: {
                lastSignedInAt: expect.any(Date),
            },
            where: {
                id: 'user-1',
            },
        })
    })

    it('rejects invalid passwords without updating the user', async () => {
        authProviderMocks.prisma.user.findUnique.mockResolvedValueOnce({
            email: 'reader@example.com',
            id: 'user-1',
            image: null,
            name: 'Reader One',
            passwordHash: await hashPassword('correct horse battery staple'),
            roleAssignments: [],
        })

        await expect(
            authenticatePasswordUser({
                email: 'reader@example.com',
                password: 'wrong password value',
            })
        ).resolves.toBeNull()

        expect(authProviderMocks.prisma.user.update).not.toHaveBeenCalled()
    })

    it('rejects users without a stored password hash', async () => {
        authProviderMocks.prisma.user.findUnique.mockResolvedValueOnce({
            email: 'reader@example.com',
            id: 'user-1',
            image: null,
            name: 'Reader One',
            passwordHash: null,
            roleAssignments: [],
        })

        await expect(
            authenticatePasswordUser({
                email: 'reader@example.com',
                password: 'correct horse battery staple',
            })
        ).resolves.toBeNull()
    })

    it('enriches database sessions with persisted user roles', async () => {
        const session = getSessionCallback()

        authProviderMocks.prisma.user.findUnique.mockResolvedValueOnce({
            email: 'admin@example.com',
            id: 'user-1',
            image: null,
            name: 'Reader One',
            roleAssignments: [
                {
                    role: 'ADMIN',
                },
            ],
        })

        const result = await session({
            session: {
                expires: '2026-06-01T00:00:00.000Z',
                user: {
                    email: 'admin@example.com',
                    id: '',
                    name: 'Reader One',
                    roles: [],
                },
            },
            user: {
                email: 'admin@example.com',
                id: 'user-1',
                image: null,
                name: 'Reader One',
            },
        } as never)

        expect(result.user).toEqual({
            email: 'admin@example.com',
            id: 'user-1',
            image: null,
            name: 'Reader One',
            roles: ['ADMIN'],
        })
    })

    it('creates and resolves database-backed sessions', async () => {
        authProviderMocks.prisma.session.create.mockResolvedValue({
            expires: new Date('2026-06-01T00:00:00.000Z'),
            sessionToken: 'session-token-1',
            userId: 'user-1',
        })
        authProviderMocks.prisma.session.findUnique.mockResolvedValue({
            expires: new Date('2026-06-01T00:00:00.000Z'),
            sessionToken: 'session-token-1',
            user: {
                email: 'admin@example.com',
                id: 'user-1',
                image: null,
                name: 'Reader One',
                roleAssignments: [
                    {
                        role: 'ADMIN',
                    },
                ],
            },
            userId: 'user-1',
        })

        const session = await createAuthSession('user-1')
        const identity = await loadSessionIdentity('session-token-1')

        expect(session.sessionToken).toBe('session-token-1')
        expect(identity).toEqual({
            email: 'admin@example.com',
            roles: ['ADMIN'],
            userId: 'user-1',
        })
    })

    it('deletes a stored database session for logout', async () => {
        await deleteAuthSession('session-token-1')

        expect(authProviderMocks.prisma.session.delete).toHaveBeenCalledWith({
            where: {
                sessionToken: 'session-token-1',
            },
        })
    })

    it('swallows missing-session errors during logout cleanup', async () => {
        authProviderMocks.prisma.session.delete.mockRejectedValueOnce(
            new Error('Record to delete does not exist.')
        )

        await expect(
            deleteAuthSession('missing-session-token')
        ).resolves.toBeUndefined()
    })

    it('configures database sessions and the local auth session cookie', () => {
        vi.stubEnv('APP_URL', 'http://127.0.0.1:3000')
        vi.stubEnv('NEXTAUTH_URL', 'http://127.0.0.1:3000')

        expect(authOptions.providers).toEqual([])
        expect(authOptions.session).toEqual({
            maxAge: authSessionSettings.maxAge,
            strategy: 'database',
            updateAge: authSessionSettings.updateAge,
        })
        expect(getAuthSessionCookie()).toEqual({
            maxAge: authSessionSettings.maxAge,
            name: 'next-auth.session-token',
            options: {
                httpOnly: true,
                path: '/',
                sameSite: 'lax',
                secure: false,
            },
        })
    })

    it('uses the secure session cookie name for https app urls', () => {
        vi.stubEnv('APP_URL', 'https://ci.pagequest.example')
        vi.stubEnv('NEXTAUTH_URL', 'https://ci.pagequest.example')

        expect(getAuthSessionCookie()).toEqual({
            maxAge: authSessionSettings.maxAge,
            name: '__Secure-next-auth.session-token',
            options: {
                httpOnly: true,
                path: '/',
                sameSite: 'lax',
                secure: true,
            },
        })
    })
})
