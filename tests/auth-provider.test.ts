import type { AppRole } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authProviderMocks = vi.hoisted(() => {
    const prisma = {
        invitation: {
            findFirst: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
            update: vi.fn(),
            upsert: vi.fn(),
        },
    }

    return {
        prisma,
    }
})

vi.mock('@/lib/prisma', () => ({
    prisma: authProviderMocks.prisma,
}))

import { authOptions } from '@/lib/auth'

type HostedCallbackUser = {
    email?: string | null
    id?: string
    image?: string | null
    name?: string | null
    roles?: AppRole[]
}

function getHostedSignInCallback() {
    const callback = authOptions.callbacks?.signIn

    if (!callback) {
        throw new Error('Expected authOptions.callbacks.signIn to be defined.')
    }

    return callback
}

function getJwtCallback() {
    const callback = authOptions.callbacks?.jwt

    if (!callback) {
        throw new Error('Expected authOptions.callbacks.jwt to be defined.')
    }

    return callback
}

describe('auth hosted sign-in callback', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        authProviderMocks.prisma.invitation.findFirst.mockResolvedValue(null)
        authProviderMocks.prisma.user.upsert.mockResolvedValue({
            email: 'reader@example.com',
            id: 'user-1',
            image: 'https://cdn.example.com/reader.png',
            name: 'Reader One',
            roleAssignments: [
                {
                    role: 'ADMIN',
                },
            ],
        })
    })

    it('syncs the hosted Auth0 user and assigns persisted roles', async () => {
        const signIn = getHostedSignInCallback()
        const user: HostedCallbackUser = {
            email: null,
            image: null,
            name: null,
            roles: [],
        }

        const result = await signIn({
            account: {
                provider: 'auth0',
            },
            profile: {
                name: 'Reader One',
                picture: 'https://cdn.example.com/reader.png',
                preferred_username: 'Reader@Example.com',
                sub: 'auth0|reader-1',
            },
            user,
        } as never)

        expect(result).toBe(true)
        expect(authProviderMocks.prisma.user.upsert).toHaveBeenCalledOnce()
        expect(authProviderMocks.prisma.user.upsert).toHaveBeenCalledWith({
            create: {
                email: 'reader@example.com',
                image: 'https://cdn.example.com/reader.png',
                lastSignedInAt: expect.any(Date),
                name: 'Reader One',
            },
            include: {
                roleAssignments: {
                    select: {
                        role: true,
                    },
                },
            },
            update: {
                image: 'https://cdn.example.com/reader.png',
                lastSignedInAt: expect.any(Date),
                name: 'Reader One',
            },
            where: {
                email: 'reader@example.com',
            },
        })
        expect(user).toEqual({
            email: 'reader@example.com',
            id: 'user-1',
            image: 'https://cdn.example.com/reader.png',
            name: 'Reader One',
            roles: ['ADMIN'],
        })
    })

    it('rejects hosted sign-in when no email can be derived', async () => {
        const signIn = getHostedSignInCallback()

        const result = await signIn({
            account: {
                provider: 'auth0',
            },
            profile: {
                name: 'Reader One',
                sub: 'auth0|reader-1',
            },
            user: {
                email: null,
                roles: [],
            },
        } as never)

        expect(result).toBe(false)
        expect(authProviderMocks.prisma.user.upsert).not.toHaveBeenCalled()
    })

    it('refreshes stale jwt user ids from the current persisted user record', async () => {
        const jwt = getJwtCallback()

        authProviderMocks.prisma.invitation.findFirst.mockResolvedValue({
            acceptedAt: new Date('2026-05-08T18:00:00.000Z'),
            email: 'reader@example.com',
            id: 'invite-1',
        })
        authProviderMocks.prisma.user.findUnique.mockResolvedValue({
            email: 'reader@example.com',
            id: 'user-current',
            image: null,
            name: 'Reader One',
            roleAssignments: [],
        })

        const token = await jwt({
            token: {
                email: 'reader@example.com',
                roles: ['COMPETITOR'],
                userId: 'user-stale',
            },
        } as never)

        expect(authProviderMocks.prisma.user.findUnique).toHaveBeenCalledWith({
            include: {
                roleAssignments: {
                    select: {
                        role: true,
                    },
                },
            },
            where: {
                email: 'reader@example.com',
            },
        })
        expect(
            authProviderMocks.prisma.invitation.findFirst
        ).toHaveBeenCalledWith({
            orderBy: [
                {
                    acceptedAt: 'desc',
                },
                {
                    createdAt: 'desc',
                },
            ],
            select: {
                acceptedAt: true,
                email: true,
                id: true,
            },
            where: {
                OR: [
                    {
                        acceptedByUserId: 'user-current',
                    },
                    {
                        email: 'reader@example.com',
                    },
                ],
                status: 'ACCEPTED',
            },
        })
        expect(token.userId).toBe('user-current')
        expect(token.roles).toEqual(['COMPETITOR'])
    })

    it('clears jwt roles and user id when the persisted user record no longer exists', async () => {
        const jwt = getJwtCallback()

        authProviderMocks.prisma.user.findUnique.mockResolvedValue(null)

        const token = await jwt({
            token: {
                email: 'reader@example.com',
                roles: ['COMPETITOR'],
                userId: 'user-stale',
            },
        } as never)

        expect(token.userId).toBeUndefined()
        expect(token.roles).toEqual([])
    })
})
