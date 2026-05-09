import type { JWT } from 'next-auth/jwt'

import { dedupeRoles, getDefaultProtectedPath } from '@/lib/auth/access'

function hasSessionIdentity(token: JWT | null) {
    return Boolean(token?.sub || token?.email || token?.userId)
}

export function getAdminMiddlewareRedirectPath({
    callbackUrl,
    token,
}: {
    callbackUrl: string
    token: JWT | null
}) {
    const roles = Array.isArray(token?.roles) ? dedupeRoles(token.roles) : []

    if (roles.includes('ADMIN')) {
        return null
    }

    if (!hasSessionIdentity(token)) {
        return `/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`
    }

    return getDefaultProtectedPath(roles)
}
