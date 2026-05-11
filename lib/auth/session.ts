import type { AppRole } from '@prisma/client'
import type { Session } from 'next-auth'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'

import { authOptions } from '@/lib/auth'
import {
    dedupeRoles,
    getDefaultProtectedPath,
    resolveGrantedRoles,
} from '@/lib/auth/access'

export type ExperienceAccessState = 'allowed' | 'signed-out' | 'wrong-role'

export type RoleAwareSession = {
    accessState: ExperienceAccessState
    expectedRole: AppRole
    expectedRoleLabel: string
    grantedRoles: AppRole[]
    grantedRoleLabels: string[]
    isAuthenticated: boolean
    isAuthorized: boolean
    summary: string
    userEmail: string | null
    userId: string | null
    userLabel: string
    userName: string | null
}

const roleLabelMap: Record<AppRole, string> = {
    ADMIN: 'Administrator',
    COMPETITOR: 'Competitor',
}

export class AuthSessionError extends Error {
    code: 'AUTHENTICATION_REQUIRED' | 'AUTHORIZATION_REQUIRED'

    constructor(
        code: 'AUTHENTICATION_REQUIRED' | 'AUTHORIZATION_REQUIRED',
        message: string
    ) {
        super(message)
        this.code = code
        this.name = 'AuthSessionError'
    }
}

export type AuthenticatedActionUser = {
    email: string | null
    id: string
    name: string | null
    roles: AppRole[]
}

function toRoleLabels(roles: AppRole[]) {
    return dedupeRoles(roles).map((role) => roleLabelMap[role])
}

function getUserLabel({
    email,
    name,
}: {
    email: string | null
    name: string | null
}) {
    return name || email || 'Guest reader'
}

function joinRoleLabels(labels: string[]) {
    if (labels.length <= 1) {
        return labels[0] ?? ''
    }

    if (labels.length === 2) {
        return `${labels[0]} and ${labels[1]}`
    }

    return `${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`
}

export function deriveRoleAwareSession({
    expectedRole,
    session,
}: {
    expectedRole: AppRole
    session: Session | null
}): RoleAwareSession {
    const user = session?.user
    const userEmail = user?.email?.trim().toLowerCase() || null
    const userName = user?.name?.trim() || null
    const roles = resolveGrantedRoles({
        grantedRoles: Array.isArray(user?.roles) ? dedupeRoles(user.roles) : [],
        isAuthenticated: Boolean(user),
    })
    const grantedRoleLabels = toRoleLabels(roles)
    const expectedRoleLabel = roleLabelMap[expectedRole]
    const userLabel = getUserLabel({
        email: userEmail,
        name: userName,
    })

    if (!user) {
        return {
            accessState: 'signed-out',
            expectedRole,
            expectedRoleLabel,
            grantedRoles: [],
            grantedRoleLabels: [],
            isAuthenticated: false,
            isAuthorized: false,
            summary: `No session detected. This ${expectedRoleLabel.toLowerCase()} shell is ready for role checks once protected routing is enabled.`,
            userEmail: null,
            userId: null,
            userLabel,
            userName: null,
        }
    }

    if (!roles.includes(expectedRole)) {
        const roleSummary = grantedRoleLabels.length
            ? `Signed in with ${joinRoleLabels(grantedRoleLabels)} access.`
            : 'Signed in without Page Quest access yet.'

        return {
            accessState: 'wrong-role',
            expectedRole,
            expectedRoleLabel,
            grantedRoles: roles,
            grantedRoleLabels,
            isAuthenticated: true,
            isAuthorized: false,
            summary: `${roleSummary} ${expectedRoleLabel} access is not present on this session yet.`,
            userEmail,
            userId: user.id || null,
            userLabel,
            userName,
        }
    }

    return {
        accessState: 'allowed',
        expectedRole,
        expectedRoleLabel,
        grantedRoles: roles,
        grantedRoleLabels,
        isAuthenticated: true,
        isAuthorized: true,
        summary: `Signed in with ${expectedRoleLabel} access for this experience.`,
        userEmail,
        userId: user.id || null,
        userLabel,
        userName,
    }
}

export async function getRoleAwareSession(expectedRole: AppRole) {
    const session = await getServerSession(authOptions)

    return deriveRoleAwareSession({
        expectedRole,
        session,
    })
}

export function getProtectedRouteRedirectPath({
    callbackUrl,
    viewer,
}: {
    callbackUrl: string
    viewer: RoleAwareSession
}) {
    if (viewer.isAuthorized) {
        return null
    }

    if (!viewer.isAuthenticated) {
        return `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`
    }

    return getDefaultProtectedPath(viewer.grantedRoles)
}

export function getAdminRouteRedirectPath({
    callbackUrl = '/admin',
    viewer,
}: {
    callbackUrl?: string
    viewer: RoleAwareSession
}) {
    return getProtectedRouteRedirectPath({
        callbackUrl,
        viewer,
    })
}

export function protectAuthenticatedRoute({
    callbackUrl,
    viewer,
}: {
    callbackUrl: string
    viewer: RoleAwareSession
}) {
    const redirectPath = getProtectedRouteRedirectPath({
        callbackUrl,
        viewer,
    })

    if (redirectPath) {
        redirect(redirectPath)
    }
}

export function protectAdminRoute({
    callbackUrl = '/admin',
    viewer,
}: {
    callbackUrl?: string
    viewer: RoleAwareSession
}) {
    const redirectPath = getAdminRouteRedirectPath({
        callbackUrl,
        viewer,
    })

    if (redirectPath) {
        redirect(redirectPath)
    }
}

export function deriveServerActionAccess({
    requiredRole,
    session,
}: {
    requiredRole?: AppRole
    session: Session | null
}) {
    const user = session?.user

    if (!user || !user.id) {
        return {
            error: new AuthSessionError(
                'AUTHENTICATION_REQUIRED',
                'Authentication is required to run this action.'
            ),
            user: null,
        }
    }

    const roles = resolveGrantedRoles({
        grantedRoles: Array.isArray(user.roles) ? dedupeRoles(user.roles) : [],
        isAuthenticated: true,
    })

    if (requiredRole && !roles.includes(requiredRole)) {
        return {
            error: new AuthSessionError(
                'AUTHORIZATION_REQUIRED',
                `${roleLabelMap[requiredRole]} access is required to run this action.`
            ),
            user: null,
        }
    }

    return {
        error: null,
        user: {
            email: user.email ?? null,
            id: user.id,
            name: user.name ?? null,
            roles,
        } satisfies AuthenticatedActionUser,
    }
}

export function deriveAdminServerActionAccess({
    session,
}: {
    session: Session | null
}) {
    return deriveServerActionAccess({
        requiredRole: 'ADMIN',
        session,
    })
}

export async function requireAuthenticatedActionUser(requiredRole?: AppRole) {
    const session = await getServerSession(authOptions)
    const access = deriveServerActionAccess({
        requiredRole,
        session,
    })

    if (access.error) {
        throw access.error
    }

    return access.user
}

export async function requireAdminActionUser() {
    return requireAuthenticatedActionUser('ADMIN')
}
