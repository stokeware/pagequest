import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getAuthSessionCookie, loadSessionIdentity } from '@/lib/auth'
import {
    getAdminMiddlewareRedirectPath,
    getCompetitorMiddlewareRedirectPath,
} from '@/lib/auth/middleware'

function getSessionToken(request: NextRequest) {
    const primaryCookieName = getAuthSessionCookie().name
    const fallbackCookieName = primaryCookieName.startsWith('__Secure-')
        ? 'next-auth.session-token'
        : '__Secure-next-auth.session-token'

    return (
        request.cookies.get(primaryCookieName)?.value ??
        request.cookies.get(fallbackCookieName)?.value ??
        null
    )
}

export async function proxy(request: NextRequest) {
    const identity = await loadSessionIdentity(getSessionToken(request))
    const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`
    const redirectPath = request.nextUrl.pathname.startsWith('/admin')
        ? getAdminMiddlewareRedirectPath({
              callbackUrl,
              identity,
          })
        : getCompetitorMiddlewareRedirectPath({
              callbackUrl,
              identity,
          })

    if (!redirectPath) {
        return NextResponse.next()
    }

    return NextResponse.redirect(new URL(redirectPath, request.url))
}

export const config = {
    matcher: [
        '/admin/:path*',
        '/campaign-board/:path*',
        '/dashboard/:path*',
        '/history/:path*',
        '/leaderboard/:path*',
        '/log-progress/:path*',
    ],
}
