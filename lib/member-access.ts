import type { CampaignStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'

const memberProvisionStatuses: CampaignStatus[] = ['ACTIVE', 'SCHEDULED']

type MemberCampaignParticipantClient = {
    campaign: {
        findMany: (args: {
            select: {
                id: true
            }
            where: {
                status: {
                    in: CampaignStatus[]
                }
                visibility: 'INVITE_ONLY'
            }
        }) => Promise<
            Array<{
                id: string
            }>
        >
    }
    campaignParticipant: {
        create: (args: {
            data: {
                campaignId: string
                joinedAt: Date
                userId: string
            }
            select: {
                id: true
            }
        }) => Promise<unknown>
        findMany: (args: {
            select: {
                campaignId: true
                id: true
                joinedAt: true
                removedAt: true
            }
            where: {
                campaignId: {
                    in: string[]
                }
                userId: string
            }
        }) => Promise<
            Array<{
                campaignId: string
                id: string
                joinedAt: Date | null
                removedAt: Date | null
            }>
        >
        update: (args: {
            data: {
                joinedAt: Date
                removedAt: null
            }
            select: {
                id: true
            }
            where: {
                id: string
            }
        }) => Promise<unknown>
    }
}

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
    await prisma.$transaction(async (transaction) => {
        await synchronizeMemberCampaignParticipants(transaction, {
            memberSince,
            userId,
        })
    })
}

export async function ensureMemberCampaignParticipantsInTransaction(
    transaction: MemberCampaignParticipantClient,
    {
        memberSince,
        userId,
    }: {
        memberSince: Date
        userId: string
    }
) {
    await synchronizeMemberCampaignParticipants(transaction, {
        memberSince,
        userId,
    })
}

async function synchronizeMemberCampaignParticipants(
    client: MemberCampaignParticipantClient,
    {
        memberSince,
        userId,
    }: {
        memberSince: Date
        userId: string
    }
) {
    const campaigns = await client.campaign.findMany({
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

    const existingParticipants = await client.campaignParticipant.findMany({
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

    for (const campaign of campaigns) {
        const existingParticipant = participantsByCampaignId.get(campaign.id)

        if (!existingParticipant) {
            await client.campaignParticipant.create({
                data: {
                    campaignId: campaign.id,
                    joinedAt: memberSince,
                    userId,
                },
                select: {
                    id: true,
                },
            })

            continue
        }

        if (existingParticipant.removedAt) {
            await client.campaignParticipant.update({
                data: {
                    joinedAt: existingParticipant.joinedAt ?? memberSince,
                    removedAt: null,
                },
                select: {
                    id: true,
                },
                where: {
                    id: existingParticipant.id,
                },
            })
        }
    }
}
