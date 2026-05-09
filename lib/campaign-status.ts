import { prisma } from '@/lib/prisma'
import { getDerivedCampaignStatusUpdates } from '@/lib/campaign-domain'

export async function synchronizeDerivedCampaignStatuses(now = new Date()) {
    const campaigns = await prisma.campaign.findMany({
        select: {
            archivedAt: true,
            endAt: true,
            id: true,
            publishedAt: true,
            startAt: true,
            status: true,
        },
        where: {
            archivedAt: null,
            publishedAt: {
                not: null,
            },
        },
    })

    const updates = getDerivedCampaignStatusUpdates(campaigns, now)

    if (updates.length === 0) {
        return []
    }

    await prisma.$transaction(
        updates.map((update) =>
            prisma.campaign.update({
                data: {
                    status: update.nextStatus,
                },
                where: {
                    id: update.id,
                },
            })
        )
    )

    return updates
}
