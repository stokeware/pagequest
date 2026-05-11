import type { CampaignStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'

const memberProvisionStatuses: CampaignStatus[] = ['ACTIVE', 'SCHEDULED']

export async function getAcceptedMemberRecord({
    userEmail,
    userId,
}: {
    userEmail?: string | null
    userId?: string | null
}) {
    const clauses = [
        ...(userId
            ? [
                  {
                      acceptedByUserId: userId,
                  },
              ]
            : []),
        ...(userEmail
            ? [
                  {
                      email: userEmail,
                  },
              ]
            : []),
    ]

    if (clauses.length === 0) {
        return null
    }

    return prisma.invitation.findFirst({
        orderBy: [
            {
                acceptedAt: 'desc',
            },
            {
                createdAt: 'desc',
            },
        ],
        select: {
            acceptedAt: true,
            email: true,
            id: true,
        },
        where: {
            OR: clauses,
            status: 'ACCEPTED',
        },
    })
}

export async function ensureMemberCampaignParticipants({
    memberSince,
    userId,
}: {
    memberSince: Date
    userId: string
}) {
    const campaigns = await prisma.campaign.findMany({
        select: {
            id: true,
        },
        where: {
            status: {
                in: memberProvisionStatuses,
            },
            visibility: 'INVITE_ONLY',
        },
    })

    if (campaigns.length === 0) {
        return
    }

    const existingParticipants = await prisma.campaignParticipant.findMany({
        select: {
            campaignId: true,
            id: true,
            joinedAt: true,
            removedAt: true,
        },
        where: {
            campaignId: {
                in: campaigns.map((campaign) => campaign.id),
            },
            userId,
        },
    })

    const participantsByCampaignId = new Map(
        existingParticipants.map((participant) => [
            participant.campaignId,
            participant,
        ])
    )

    await prisma.$transaction(async (transaction) => {
        for (const campaign of campaigns) {
            const existingParticipant = participantsByCampaignId.get(
                campaign.id
            )

            if (!existingParticipant) {
                await transaction.campaignParticipant.create({
                    data: {
                        campaignId: campaign.id,
                        joinedAt: memberSince,
                        userId,
                    },
                })

                continue
            }

            if (existingParticipant.removedAt) {
                await transaction.campaignParticipant.update({
                    data: {
                        joinedAt: existingParticipant.joinedAt ?? memberSince,
                        removedAt: null,
                    },
                    where: {
                        id: existingParticipant.id,
                    },
                })
            }
        }
    })
}
