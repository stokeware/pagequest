import { prisma } from '@/lib/prisma'
import { getDerivedQuestStatusUpdates } from '@/lib/quest-domain'

export async function synchronizeDerivedQuestStatuses(now = new Date()) {
    const quests = await prisma.quest.findMany({
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

    const updates = getDerivedQuestStatusUpdates(quests, now)

    if (updates.length === 0) {
        return []
    }

    await prisma.$transaction(
        updates.map((update) =>
            prisma.quest.update({
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
