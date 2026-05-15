import { randomUUID } from 'node:crypto'

import { PrismaAdapter } from '@auth/prisma-adapter'
import type { AppRole } from '@prisma/client'
import type { NextAuthOptions } from 'next-auth'

import { resolveGrantedRoles } from '@/lib/auth/access'
import { normalizeAuthEmail } from '@/lib/auth/email'
import { verifyPassword } from '@/lib/auth/password'
import { getAppUrl } from '@/lib/env'
import { prisma } from '@/lib/prisma'

export const authSessionSettings = {
    maxAge: 14 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
} as const

type PersistedUser = {
    email: string
    id: string
    image: string | null
    name: string | null
    roles: AppRole[]
}

type PersistedUserRecord = {
    email: string
    id: string
    image: string | null
    name: string | null
    roleAssignments: Array<{
        role: AppRole
    }>
}

type CredentialUserRecord = PersistedUserRecord & {
    passwordHash: string | null
}

export type AuthSessionIdentity = {
    email: string
    roles: AppRole[]
    userId: string
}

function extractAdminRoles(
    roleAssignments: Array<{
        role: AppRole
    }>
): AppRole[] {
    return roleAssignments
        .filter(({ role }) => role === 'ADMIN')
        .map(({ role }) => role)
}

async function toPersistedUser(
    user: PersistedUserRecord
): Promise<PersistedUser> {
    const roles = resolveGrantedRoles({
        grantedRoles: extractAdminRoles(user.roleAssignments),
        isAuthenticated: true,
    })

    return {
        email: user.email,
        id: user.id,
        image: user.image,
        name: user.name,
        roles,
    }
}

async function loadUserById(userId: string): Promise<PersistedUser | null> {
    const user = await prisma.user.findUnique({
        include: {
            roleAssignments: {
                select: {
                    role: true,
                },
            },
        },
        where: {
            id: userId,
        },
    })

    return user ? await toPersistedUser(user) : null
}

async function loadCredentialUserByEmail(
    email: string
): Promise<CredentialUserRecord | null> {
    return prisma.user.findUnique({
        include: {
            roleAssignments: {
                select: {
                    role: true,
                },
            },
        },
        where: {
            email,
        },
    })
}

async function touchUserLastSignedInAt(userId: string) {
    await prisma.user.update({
        data: {
            lastSignedInAt: new Date(),
        },
        where: {
            id: userId,
        },
    })
}

export async function authenticatePasswordUser({
    email,
    password,
}: {
    email: string
    password: string
}): Promise<PersistedUser | null> {
    const normalizedEmail = normalizeAuthEmail(email)

    if (!normalizedEmail || !password.trim()) {
        return null
    }

    const user = await loadCredentialUserByEmail(normalizedEmail)

    if (!user) {
        return null
    }

    const passwordIsValid = await verifyPassword({
        password,
        passwordHash: user.passwordHash,
    })

    if (!passwordIsValid) {
        return null
    }

    await touchUserLastSignedInAt(user.id)

    return toPersistedUser(user)
}

function getSessionExpiry(now = new Date()) {
    return new Date(now.getTime() + authSessionSettings.maxAge * 1000)
}

function getSessionCookieName() {
    const appUrl = getAppUrl()

    return appUrl.startsWith('https://')
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token'
}

export function getAuthSessionCookie() {
    return {
        maxAge: authSessionSettings.maxAge,
        name: getSessionCookieName(),
        options: {
            httpOnly: true,
            path: '/',
            sameSite: 'lax' as const,
            secure: getSessionCookieName().startsWith('__Secure-'),
        },
    }
}

export async function createAuthSession(userId: string) {
    const session = await prisma.session.create({
        data: {
            expires: getSessionExpiry(),
            sessionToken: randomUUID(),
            userId,
        },
    })

    return session
}

export async function deleteAuthSession(sessionToken: string) {
    try {
        await prisma.session.delete({
            where: {
                sessionToken,
            },
        })
    } catch {
        return
    }
}

export async function loadSessionIdentity(
    sessionToken: string | null | undefined
): Promise<AuthSessionIdentity | null> {
    const normalizedSessionToken = sessionToken?.trim()

    if (!normalizedSessionToken) {
        return null
    }

    const session = await prisma.session.findUnique({
        include: {
            user: {
                include: {
                    roleAssignments: {
                        select: {
                            role: true,
                        },
                    },
                },
            },
        },
        where: {
            sessionToken: normalizedSessionToken,
        },
    })

    if (!session || session.expires <= new Date()) {
        return null
    }

    const persistedUser = await toPersistedUser(session.user)

    return {
        email: persistedUser.email,
        roles: persistedUser.roles,
        userId: persistedUser.id,
    }
}

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    callbacks: {
        async session({ session, user }) {
            const persistedUser = await loadUserById(user.id)

            if (session.user) {
                session.user.email = persistedUser?.email ?? user.email ?? null
                session.user.id = persistedUser?.id ?? user.id
                session.user.image = persistedUser?.image ?? user.image ?? null
                session.user.name = persistedUser?.name ?? user.name ?? null
                session.user.roles = persistedUser?.roles ?? []
            }

            return session
        },
    },
    pages: {
        signIn: '/sign-in',
    },
    providers: [],
    session: {
        maxAge: authSessionSettings.maxAge,
        strategy: 'database',
        updateAge: authSessionSettings.updateAge,
    },
}
