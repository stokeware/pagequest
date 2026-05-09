import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

import {
    getAdminMiddlewareRedirectPath,
    getCompetitorMiddlewareRedirectPath,
} from '@/lib/auth/middleware'

export async function proxy(request: NextRequest) {
    const token = await getToken({
        req: request,
    })
    const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`
    const redirectPath = request.nextUrl.pathname.startsWith('/admin')
        ? getAdminMiddlewareRedirectPath({
              callbackUrl,
              token,
          })
        : getCompetitorMiddlewareRedirectPath({
              callbackUrl,
              token,
          })

    if (!redirectPath) {
        return NextResponse.next()
    }

    return NextResponse.redirect(new URL(redirectPath, request.url))
}

export const config = {
    matcher: [
        '/admin/:path*',
        '/dashboard/:path*',
        '/history/:path*',
        '/leaderboard/:path*',
        '/log-progress/:path*',
    ],
}
