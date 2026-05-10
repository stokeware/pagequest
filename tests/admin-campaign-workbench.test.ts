import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import {
    formatCampaignDateInput,
    getAdminCampaignBucket,
    selectDefaultAdminCampaignId,
    sortAdminCampaignTabs,
    type AdminCampaignWorkbenchSummary,
} from '@/lib/admin-campaign-workbench'

function buildCampaign(
    overrides: Partial<AdminCampaignWorkbenchSummary>
): AdminCampaignWorkbenchSummary {
    return {
        archivedAt: null,
        campaignChallenges: [],
        challengeCategoryBonuses: null,
        endAt: new Date('2026-06-01T12:00:00.000Z'),
        id: 'campaign-1',
        name: 'Campaign 1',
        pointsPerAudiobookMinute: new Prisma.Decimal('0.5'),
        pointsPerBook: new Prisma.Decimal('10'),
        pointsPerChallengeCompletion: new Prisma.Decimal('25'),
        pointsPerPage: new Prisma.Decimal('1'),
        publishedAt: new Date('2026-04-01T12:00:00.000Z'),
        startAt: new Date('2026-05-01T12:00:00.000Z'),
        status: 'ACTIVE',
        timezone: 'America/Chicago',
        visibility: 'INVITE_ONLY',
        ...overrides,
    }
}

describe('admin campaign workbench helpers', () => {
    it('classifies current, future, and past campaigns for tab display', () => {
        const now = new Date('2026-05-10T12:00:00.000Z')

        expect(
            getAdminCampaignBucket(
                buildCampaign({
                    id: 'current',
                    status: 'ACTIVE',
                }),
                now
            )
        ).toBe('current')

        expect(
            getAdminCampaignBucket(
                buildCampaign({
                    id: 'future',
                    startAt: new Date('2026-06-01T12:00:00.000Z'),
                    endAt: new Date('2026-07-01T12:00:00.000Z'),
                    status: 'SCHEDULED',
                }),
                now
            )
        ).toBe('future')

        expect(
            getAdminCampaignBucket(
                buildCampaign({
                    id: 'past',
                    endAt: new Date('2026-04-01T12:00:00.000Z'),
                    status: 'COMPLETED',
                }),
                now
            )
        ).toBe('past')
    })

    it('defaults to the current campaign, then next future, then latest past', () => {
        const now = new Date('2026-05-10T12:00:00.000Z')

        expect(
            selectDefaultAdminCampaignId(
                [
                    buildCampaign({
                        id: 'future',
                        startAt: new Date('2026-07-01T12:00:00.000Z'),
                        endAt: new Date('2026-08-01T12:00:00.000Z'),
                        status: 'SCHEDULED',
                    }),
                    buildCampaign({
                        id: 'current',
                        status: 'ACTIVE',
                    }),
                ],
                now
            )
        ).toBe('current')

        expect(
            selectDefaultAdminCampaignId(
                [
                    buildCampaign({
                        id: 'future-b',
                        startAt: new Date('2026-08-01T12:00:00.000Z'),
                        endAt: new Date('2026-09-01T12:00:00.000Z'),
                        status: 'SCHEDULED',
                    }),
                    buildCampaign({
                        id: 'future-a',
                        startAt: new Date('2026-06-01T12:00:00.000Z'),
                        endAt: new Date('2026-07-01T12:00:00.000Z'),
                        status: 'SCHEDULED',
                    }),
                ],
                now
            )
        ).toBe('future-a')

        expect(
            selectDefaultAdminCampaignId(
                [
                    buildCampaign({
                        id: 'past-a',
                        endAt: new Date('2026-04-01T12:00:00.000Z'),
                        status: 'COMPLETED',
                    }),
                    buildCampaign({
                        id: 'past-b',
                        endAt: new Date('2026-05-01T12:00:00.000Z'),
                        status: 'COMPLETED',
                    }),
                ],
                now
            )
        ).toBe('past-b')
    })

    it('sorts tabs as current, future ascending, then past descending', () => {
        const now = new Date('2026-05-10T12:00:00.000Z')
        const sorted = sortAdminCampaignTabs(
            [
                buildCampaign({
                    id: 'past',
                    endAt: new Date('2026-04-01T12:00:00.000Z'),
                    status: 'COMPLETED',
                }),
                buildCampaign({
                    id: 'future-b',
                    startAt: new Date('2026-08-01T12:00:00.000Z'),
                    endAt: new Date('2026-09-01T12:00:00.000Z'),
                    status: 'SCHEDULED',
                }),
                buildCampaign({
                    id: 'current',
                    status: 'ACTIVE',
                }),
                buildCampaign({
                    id: 'future-a',
                    startAt: new Date('2026-06-01T12:00:00.000Z'),
                    endAt: new Date('2026-07-01T12:00:00.000Z'),
                    status: 'SCHEDULED',
                }),
            ],
            now
        )

        expect(sorted.map((campaign) => campaign.id)).toEqual([
            'current',
            'future-a',
            'future-b',
            'past',
        ])
    })

    it('formats stored campaign dates for date inputs', () => {
        expect(
            formatCampaignDateInput(new Date('2026-05-01T12:00:00.000Z'))
        ).toBe('2026-05-01')
    })
})
