import type { AppRole } from '@prisma/client'
import type { NextAuthOptions, Profile } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import type { OAuthConfig } from 'next-auth/providers/oauth'

import {
    getAuthMode,
    getEntraExternalIdConfig,
    getLocalAuthPassphrase,
} from '@/lib/auth/config'
import { prisma } from '@/lib/prisma'

type EntraProfile = Profile & {
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

function normalizeEmail(email: string | null | undefined) {
    return email?.trim().toLowerCase() || null
}

function extractRoles(
    roleAssignments: Array<{
        role: AppRole
    }>
): AppRole[] {
    return roleAssignments.map(({ role }) => role)
}

function toPersistedUser(user: {
    email: string
    id: string
    image: string | null
    name: string | null
    roleAssignments: Array<{
        role: AppRole
    }>
}): PersistedUser {
    return {
        email: user.email,
        id: user.id,
        image: user.image,
        name: user.name,
        roles: extractRoles(user.roleAssignments),
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

    return user ? toPersistedUser(user) : null
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

function getProfileEmail(profile: EntraProfile) {
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

function createEntraExternalIdProvider() {
    const config = getEntraExternalIdConfig()

    const provider: OAuthConfig<EntraProfile> = {
        authorization: {
            params: {
                scope: config.scope,
            },
        },
        checks: ['pkce', 'state', 'nonce'],
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        id: 'microsoft-entra-external-id',
        idToken: true,
        issuer: config.issuer,
        name: 'Microsoft Entra External ID',
        profile(profile) {
            const email = getProfileEmail(profile)

            if (!email) {
                throw new Error(
                    'Microsoft Entra External ID did not return an email address.'
                )
            }

            return {
                email,
                id: profile.sub ?? email,
                image: profile.picture ?? null,
                name: profile.name ?? email,
                roles: [],
            }
        },
        type: 'oauth',
        wellKnown: `${config.issuer}/.well-known/openid-configuration`,
    }

    return provider
}

function getAuthProviders() {
    return getAuthMode() === 'entra'
        ? [createEntraExternalIdProvider()]
        : [createLocalCredentialsProvider()]
}

export const authOptions: NextAuthOptions = {
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.roles = user.roles
                token.userId = user.id
            }

            if (
                typeof token.email === 'string' &&
                (!Array.isArray(token.roles) ||
                    typeof token.userId !== 'string')
            ) {
                const persistedUser = await loadUserByEmail(token.email)

                if (persistedUser) {
                    token.roles = persistedUser.roles
                    token.userId = persistedUser.id
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
            if (account?.provider !== 'microsoft-entra-external-id') {
                return true
            }

            const entraProfile = profile as EntraProfile
            const email =
                normalizeEmail(user.email) || getProfileEmail(entraProfile)

            if (!email) {
                return false
            }

            const persistedUser = await syncExternalIdentityUser({
                email,
                image: user.image ?? entraProfile.picture ?? null,
                name: user.name ?? entraProfile.name ?? email,
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
