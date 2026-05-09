import { getServerSession } from 'next-auth/next'
import { NextResponse, type NextRequest } from 'next/server'

import { authOptions } from '@/lib/auth'
import {
    deriveRoleAwareSession,
    getAdminRouteRedirectPath,
} from '@/lib/auth/session'
import { getAdminQuestResultsCsv } from '@/lib/admin-reports'

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions)
    const viewer = deriveRoleAwareSession({
        expectedRole: 'ADMIN',
        session,
    })
    const callbackUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`
    const redirectPath = getAdminRouteRedirectPath({
        callbackUrl,
        viewer,
    })

    if (redirectPath) {
        return NextResponse.redirect(new URL(redirectPath, request.url))
    }

    const questId = request.nextUrl.searchParams.get('questId')
    const exportBundle = await getAdminQuestResultsCsv(questId)

    if (!exportBundle) {
        return new NextResponse('No quest is available for export.', {
            status: 404,
        })
    }

    return new NextResponse(exportBundle.csv, {
        headers: {
            'Cache-Control': 'no-store',
            'Content-Disposition': `attachment; filename="${exportBundle.filename}"`,
            'Content-Type': 'text/csv; charset=utf-8',
        },
        status: 200,
    })
}
