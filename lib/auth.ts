import type { AppRole } from '@prisma/client'
import type { NextAuthOptions, Profile } from 'next-auth'
import Auth0Provider from 'next-auth/providers/auth0'
import CredentialsProvider from 'next-auth/providers/credentials'

import {
    getAuth0Config,
    getAuthMode,
    getLocalAuthPassphrase,
} from '@/lib/auth/config'
import { resolveGrantedRoles } from '@/lib/auth/access'
import { prisma } from '@/lib/prisma'

type HostedIdentityProfile = Profile & {
    email?: string
    emails?: string[]
    name?: string
    picture?: string
    preferred_username?: string
    sub?: string
}

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

function normalizeEmail(email: string | null | undefined) {
    return email?.trim().toLowerCase() || null
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

async function loadUserByEmail(email: string): Promise<PersistedUser | null> {
    const user = await prisma.user.findUnique({
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

    return user ? await toPersistedUser(user) : null
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

function getProfileEmail(profile: HostedIdentityProfile) {
    const candidateEmail = normalizeEmail(profile.email)

    if (candidateEmail) {
        return candidateEmail
    }

    if (typeof profile.preferred_username === 'string') {
        return normalizeEmail(profile.preferred_username)
    }

    if (Array.isArray(profile.emails)) {
        const firstEmail = profile.emails.find(
            (value) => typeof value === 'string' && value.trim().length > 0
        )

        return normalizeEmail(firstEmail)
    }

    return null
}

async function syncExternalIdentityUser({
    email,
    image,
    name,
}: {
    email: string
    image: string | null
    name: string | null
}): Promise<PersistedUser> {
    const user = await prisma.user.upsert({
        create: {
            email,
            image,
            lastSignedInAt: new Date(),
            name,
        },
        include: {
            roleAssignments: {
                select: {
                    role: true,
                },
            },
        },
        update: {
            image,
            lastSignedInAt: new Date(),
            name,
        },
        where: {
            email,
        },
    })

    return toPersistedUser(user)
}

function createLocalCredentialsProvider() {
    return CredentialsProvider({
        authorize: async (credentials) => {
            const email = normalizeEmail(credentials?.email)
            const password = credentials?.password?.trim()

            if (!email || !password) {
                return null
            }

            if (password !== getLocalAuthPassphrase()) {
                return null
            }

            const user = await loadUserByEmail(email)

            if (!user) {
                return null
            }

            await touchUserLastSignedInAt(user.id)

            return user
        },
        credentials: {
            email: {
                label: 'Email address',
                type: 'email',
            },
            password: {
                label: 'Shared passphrase',
                type: 'password',
            },
        },
        id: 'credentials',
        name: 'Local development sign-in',
    })
}

function createAuth0Provider() {
    const config = getAuth0Config()

    return Auth0Provider({
        authorization: {
            params: {
                ...(config.audience ? { audience: config.audience } : {}),
                scope: config.scope,
            },
        },
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        issuer: config.issuer,
        profile(profile) {
            const email = getProfileEmail(profile as HostedIdentityProfile)

            if (!email) {
                throw new Error('Auth0 did not return an email address.')
            }

            return {
                email,
                id: profile.sub ?? email,
                image: profile.picture ?? null,
                name: profile.name ?? email,
                roles: [],
            }
        },
    })
}

function getAuthProviders() {
    const mode = getAuthMode()

    if (mode === 'auth0') {
        return [createAuth0Provider()]
    }

    return [createLocalCredentialsProvider()]
}

export const authOptions: NextAuthOptions = {
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.roles = user.roles
                token.userId = user.id
            }

            if (typeof token.email === 'string') {
                const persistedUser = await loadUserByEmail(token.email)

                if (persistedUser) {
                    token.roles = persistedUser.roles
                    token.userId = persistedUser.id
                } else {
                    token.roles = []
                    delete token.userId
                }
            }

            return token
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id =
                    typeof token.userId === 'string' ? token.userId : ''
                session.user.roles = Array.isArray(token.roles)
                    ? token.roles
                    : []
            }

            return session
        },
        async signIn({ account, profile, user }) {
            if (account?.provider === 'credentials') {
                return true
            }

            const hostedProfile = profile as HostedIdentityProfile
            const email =
                normalizeEmail(user.email) || getProfileEmail(hostedProfile)

            if (!email) {
                return false
            }

            const persistedUser = await syncExternalIdentityUser({
                email,
                image: user.image ?? hostedProfile.picture ?? null,
                name: user.name ?? hostedProfile.name ?? email,
            })

            user.email = persistedUser.email
            user.id = persistedUser.id
            user.image = persistedUser.image
            user.name = persistedUser.name
            user.roles = persistedUser.roles

            return true
        },
    },
    pages: {
        signIn: '/sign-in',
    },
    providers: getAuthProviders(),
    session: {
        strategy: 'jwt',
    },
}
