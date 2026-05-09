import type { AppRole } from '@prisma/client'

export function dedupeRoles(roles: AppRole[]): AppRole[] {
    return Array.from(new Set(roles))
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
