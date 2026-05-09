'use server'

import { getServerSession } from 'next-auth/next'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { authOptions } from '@/lib/auth'
import {
    buildInvitationAcceptPath,
    hashInvitationToken,
} from '@/lib/invitation-admin'
import { deriveInvitationAcceptanceProfile } from '@/lib/invitation-acceptance'
import { recordInvitationAcceptance } from '@/lib/invitation-service'
import { prisma } from '@/lib/prisma'

function getStringField(formData: FormData, fieldName: string) {
    const value = formData.get(fieldName)

    return typeof value === 'string' ? value.trim() : ''
}

export async function acceptInvitationAction(formData: FormData) {
    const token = getStringField(formData, 'token')

    if (!token) {
        redirect('/accept-invitation')
    }

    const session = await getServerSession(authOptions)
    const userId = session?.user?.id ?? null
    const userEmail = session?.user?.email?.trim().toLowerCase() ?? null

    if (!userId || !userEmail) {
        redirect(
            `/sign-in?callbackUrl=${encodeURIComponent(
                buildInvitationAcceptPath(token)
            )}`
        )
    }

    const invitation = await prisma.invitation.findUnique({
        select: {
            acceptedByUserId: true,
            email: true,
            expiresAt: true,
            id: true,
            quest: {
                select: {
                    id: true,
                    name: true,
                    status: true,
                    visibility: true,
                },
            },
            revokedAt: true,
            status: true,
        },
        where: {
            tokenHash: hashInvitationToken(token),
        },
    })

    const acceptance = deriveInvitationAcceptanceProfile({
        invitation,
        now: new Date(),
        viewer: {
            userEmail,
            userId,
        },
    })

    if (acceptance.state === 'accepted') {
        redirect('/dashboard?invitationAccepted=1')
    }

    if (!acceptance.canAccept || !invitation) {
        redirect(buildInvitationAcceptPath(token))
    }

    const now = new Date()

    await prisma.$transaction(async (transaction) => {
        await recordInvitationAcceptance(transaction, {
            invitation,
            now,
            userId,
        })
    })

    revalidatePath('/accept-invitation')
    revalidatePath('/admin/invitations')
    revalidatePath('/dashboard')
    redirect('/dashboard?invitationAccepted=1')
}
