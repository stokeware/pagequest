import type { AppRole } from '@prisma/client'

import type { AuthSessionIdentity } from '@/lib/auth'
import {
    dedupeRoles,
    getDefaultProtectedPath,
    resolveGrantedRoles,
} from '@/lib/auth/access'

function hasSessionIdentity(identity: AuthSessionIdentity | null) {
    return Boolean(identity?.email || identity?.userId)
}

function getProtectedMiddlewareRedirectPath({
    callbackUrl,
    expectedRole,
    identity,
}: {
    callbackUrl: string
    expectedRole: AppRole
    identity: AuthSessionIdentity | null
}) {
    const isAuthenticated = hasSessionIdentity(identity)
    const roles = resolveGrantedRoles({
        grantedRoles: Array.isArray(identity?.roles)
            ? dedupeRoles(identity.roles)
            : [],
        isAuthenticated,
    })

    if (roles.includes(expectedRole)) {
        return null
    }

    if (!isAuthenticated) {
        return `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`
    }

    return getDefaultProtectedPath(roles)
}

export function getAdminMiddlewareRedirectPath({
    callbackUrl,
    identity,
}: {
    callbackUrl: string
    identity: AuthSessionIdentity | null
}) {
    return getProtectedMiddlewareRedirectPath({
        callbackUrl,
        expectedRole: 'ADMIN',
        identity,
    })
}

export function getCompetitorMiddlewareRedirectPath({
    callbackUrl,
    identity,
}: {
    callbackUrl: string
    identity: AuthSessionIdentity | null
}) {
    return getProtectedMiddlewareRedirectPath({
        callbackUrl,
        expectedRole: 'COMPETITOR',
        identity,
    })
}
