import type { AppRole } from '@prisma/client'

export function dedupeRoles(roles: AppRole[]): AppRole[] {
    return Array.from(new Set(roles))
}

export function resolveGrantedRoles({
    grantedRoles,
    isAuthenticated,
}: {
    grantedRoles: AppRole[]
    isAuthenticated: boolean
}) {
    const uniqueRoles = dedupeRoles(grantedRoles)

    if (uniqueRoles.includes('ADMIN')) {
        return ['ADMIN'] as AppRole[]
    }

    if (isAuthenticated) {
        return ['COMPETITOR'] as AppRole[]
    }

    return []
}

function normalizeAppPath(path: string | null | undefined) {
    if (!path) {
        return null
    }

    const normalizedPath = path.trim()

    if (!normalizedPath) {
        return null
    }

    const url = normalizedPath.startsWith('/')
        ? new URL(normalizedPath, 'http://pagequest.local')
        : new URL(normalizedPath)

    return `${url.pathname}${url.search}${url.hash}`
}

function isDefaultPublicPath(path: string) {
    return path === '/' || path.startsWith('/sign-in')
}

export function getDefaultProtectedPath(grantedRoles: AppRole[]) {
    if (grantedRoles.includes('ADMIN')) {
        return '/admin'
    }

    if (grantedRoles.includes('COMPETITOR')) {
        return '/dashboard'
    }

    return '/'
}

export function getSignedInLandingPath({
    callbackUrl,
    grantedRoles,
    isAuthenticated = false,
}: {
    callbackUrl?: string | null
    grantedRoles: AppRole[]
    isAuthenticated?: boolean
}) {
    const normalizedCallbackUrl = normalizeAppPath(callbackUrl)
    const resolvedRoles = resolveGrantedRoles({
        grantedRoles,
        isAuthenticated,
    })

    if (normalizedCallbackUrl && !isDefaultPublicPath(normalizedCallbackUrl)) {
        return normalizedCallbackUrl
    }

    return getDefaultProtectedPath(resolvedRoles)
}
