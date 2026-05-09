import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

import { getAdminMiddlewareRedirectPath } from '@/lib/auth/middleware'

export async function proxy(request: NextRequest) {
    const token = await getToken({
        req: request,
    })
    const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`
    const redirectPath = getAdminMiddlewareRedirectPath({
        callbackUrl,
        token,
    })

    if (!redirectPath) {
        return NextResponse.next()
    }

    return NextResponse.redirect(new URL(redirectPath, request.url))
}

export const config = {
    matcher: ['/admin/:path*'],
}
