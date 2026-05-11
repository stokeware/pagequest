import type { AppRole } from '@prisma/client'
import type { JWT } from 'next-auth/jwt'

import {
    dedupeRoles,
    getDefaultProtectedPath,
    resolveGrantedRoles,
} from '@/lib/auth/access'

function hasSessionIdentity(token: JWT | null) {
    return Boolean(token?.sub || token?.email || token?.userId)
}

function getProtectedMiddlewareRedirectPath({
    callbackUrl,
    expectedRole,
    token,
}: {
    callbackUrl: string
    expectedRole: AppRole
    token: JWT | null
}) {
    const isAuthenticated = hasSessionIdentity(token)
    const roles = resolveGrantedRoles({
        grantedRoles: Array.isArray(token?.roles)
            ? dedupeRoles(token.roles as AppRole[])
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
    token,
}: {
    callbackUrl: string
    token: JWT | null
}) {
    return getProtectedMiddlewareRedirectPath({
        callbackUrl,
        expectedRole: 'ADMIN',
        token,
    })
}

export function getCompetitorMiddlewareRedirectPath({
    callbackUrl,
    token,
}: {
    callbackUrl: string
    token: JWT | null
}) {
    return getProtectedMiddlewareRedirectPath({
        callbackUrl,
        expectedRole: 'COMPETITOR',
        token,
    })
}
