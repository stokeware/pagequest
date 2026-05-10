import type { CampaignStatus } from '@prisma/client'

export type AdminCampaignWorkbenchSummary = {
    archivedAt: Date | null
    endAt: Date
    id: string
    name: string
    publishedAt: Date | null
    startAt: Date
    status: CampaignStatus
}

export type AdminCampaignBucket = 'current' | 'future' | 'past'

export function getAdminCampaignBucket(
    campaign: AdminCampaignWorkbenchSummary,
    now = new Date()
): AdminCampaignBucket {
    if (campaign.status === 'ACTIVE') {
        return 'current'
    }

    if (
        campaign.status === 'ARCHIVED' ||
        campaign.status === 'COMPLETED' ||
        campaign.endAt < now
    ) {
        return 'past'
    }

    return 'future'
}

export function selectDefaultAdminCampaignId(
    campaigns: AdminCampaignWorkbenchSummary[],
    now = new Date()
) {
    const currentCampaign = campaigns.find(
        (campaign) => getAdminCampaignBucket(campaign, now) === 'current'
    )

    if (currentCampaign) {
        return currentCampaign.id
    }

    const futureCampaign = campaigns
        .filter(
            (campaign) => getAdminCampaignBucket(campaign, now) === 'future'
        )
        .sort((left, right) => left.startAt.getTime() - right.startAt.getTime())
        .at(0)

    if (futureCampaign) {
        return futureCampaign.id
    }

    return (
        campaigns
            .filter(
                (campaign) => getAdminCampaignBucket(campaign, now) === 'past'
            )
            .sort((left, right) => right.endAt.getTime() - left.endAt.getTime())
            .at(0)?.id ?? null
    )
}

export function sortAdminCampaignTabs(
    campaigns: AdminCampaignWorkbenchSummary[],
    now = new Date()
) {
    return [...campaigns].sort((left, right) => {
        const bucketRank: Record<AdminCampaignBucket, number> = {
            current: 0,
            future: 1,
            past: 2,
        }
        const leftBucket = getAdminCampaignBucket(left, now)
        const rightBucket = getAdminCampaignBucket(right, now)

        if (leftBucket !== rightBucket) {
            return bucketRank[leftBucket] - bucketRank[rightBucket]
        }

        if (leftBucket === 'past') {
            return right.endAt.getTime() - left.endAt.getTime()
        }

        return left.startAt.getTime() - right.startAt.getTime()
    })
}

export function formatCampaignDateInput(value: Date) {
    const year = value.getUTCFullYear()
    const month = `${value.getUTCMonth() + 1}`.padStart(2, '0')
    const day = `${value.getUTCDate()}`.padStart(2, '0')

    return `${year}-${month}-${day}`
}
