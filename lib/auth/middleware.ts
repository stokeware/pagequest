import type { AppRole } from '@prisma/client'
import type { JWT } from 'next-auth/jwt'

import { dedupeRoles, getDefaultProtectedPath } from '@/lib/auth/access'

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
    const roles = Array.isArray(token?.roles)
        ? dedupeRoles(token.roles as AppRole[])
        : []

    if (roles.includes(expectedRole)) {
        return null
    }

    if (!hasSessionIdentity(token)) {
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
