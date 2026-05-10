import { prisma } from '@/lib/prisma'

export const HOME_PAGE_FALLBACK_COUNTDOWN_TARGET = new Date(
    '2026-05-15T12:00:00.000Z'
)

type HomePageCountdownCampaign = {
    startAt: Date
}

export function selectHomePageCountdownTarget(
    campaigns: HomePageCountdownCampaign[],
    now = new Date()
) {
    const nextCampaign = [...campaigns]
        .filter((campaign) => campaign.startAt.getTime() > now.getTime())
        .sort(
            (left, right) => left.startAt.getTime() - right.startAt.getTime()
        )[0]

    if (nextCampaign) {
        return new Date(nextCampaign.startAt.getTime())
    }

    return new Date(HOME_PAGE_FALLBACK_COUNTDOWN_TARGET.getTime())
}

export async function getHomePageCountdownTarget(now = new Date()) {
    const campaigns = await prisma.campaign.findMany({
        orderBy: {
            startAt: 'asc',
        },
        select: {
            startAt: true,
        },
        where: {
            archivedAt: null,
            publishedAt: {
                not: null,
            },
        },
    })

    return selectHomePageCountdownTarget(campaigns, now)
}
