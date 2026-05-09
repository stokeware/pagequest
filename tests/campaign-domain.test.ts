import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import {
    calculateEntryPoints,
    calculateParticipantScoreTotals,
    deriveCampaignStatus,
    getDerivedCampaignStatusUpdate,
    getDerivedCampaignStatusUpdates,
    type CampaignScoringRules,
} from '@/lib/campaign-domain'

const scoringRules: CampaignScoringRules = {
    pointsPerBook: new Prisma.Decimal(25),
    pointsPerPage: new Prisma.Decimal(1),
    pointsPerAudiobookMinute: new Prisma.Decimal('0.75'),
    pointsPerChallengeCompletion: new Prisma.Decimal(40),
}

describe('calculateEntryPoints', () => {
    it('calculates audiobook minutes using the campaign scoring rule', () => {
        const points = calculateEntryPoints(
            {
                type: 'AUDIOBOOK_MINUTES',
                value: 90,
            },
            scoringRules
        )

        expect(points.equals(new Prisma.Decimal('67.5'))).toBe(true)
    })

    it('prefers awarded challenge points when provided', () => {
        const points = calculateEntryPoints(
            {
                type: 'CHALLENGE_COMPLETION',
                value: 1,
                awardedPoints: new Prisma.Decimal(55),
            },
            scoringRules
        )

        expect(points.equals(new Prisma.Decimal(55))).toBe(true)
    })
})

describe('calculateParticipantScoreTotals', () => {
    it('aggregates raw metrics, total points, and the latest activity date', () => {
        const totals = calculateParticipantScoreTotals(
            [
                {
                    type: 'BOOK_COMPLETION',
                    value: 1,
                    activityDate: new Date('2026-05-02T12:00:00.000Z'),
                },
                {
                    type: 'PAGES_READ',
                    value: 120,
                    activityDate: new Date('2026-05-04T12:00:00.000Z'),
                },
                {
                    type: 'AUDIOBOOK_MINUTES',
                    value: 60,
                    activityDate: new Date('2026-05-03T12:00:00.000Z'),
                },
                {
                    type: 'CHALLENGE_COMPLETION',
                    value: 1,
                    activityDate: new Date('2026-05-05T12:00:00.000Z'),
                },
            ],
            scoringRules
        )

        expect(totals.totalBooks).toBe(1)
        expect(totals.totalPages).toBe(120)
        expect(totals.totalAudiobookMinutes).toBe(60)
        expect(totals.totalChallenges).toBe(1)
        expect(totals.totalPoints.equals(new Prisma.Decimal(230))).toBe(true)
        expect(totals.lastActivityAt).toEqual(
            new Date('2026-05-05T12:00:00.000Z')
        )
    })
})

describe('deriveCampaignStatus', () => {
    const baseInput = {
        startAt: new Date('2026-05-10T00:00:00.000Z'),
        endAt: new Date('2026-05-20T00:00:00.000Z'),
    }

    it('keeps unpublished campaigns in draft status', () => {
        expect(
            deriveCampaignStatus({
                ...baseInput,
                now: new Date('2026-05-12T00:00:00.000Z'),
            })
        ).toBe('DRAFT')
    })

    it('derives scheduled, active, and completed statuses from the campaign window', () => {
        expect(
            deriveCampaignStatus({
                ...baseInput,
                publishedAt: new Date('2026-05-01T00:00:00.000Z'),
                now: new Date('2026-05-09T23:59:59.000Z'),
            })
        ).toBe('SCHEDULED')

        expect(
            deriveCampaignStatus({
                ...baseInput,
                publishedAt: new Date('2026-05-01T00:00:00.000Z'),
                now: new Date('2026-05-15T00:00:00.000Z'),
            })
        ).toBe('ACTIVE')

        expect(
            deriveCampaignStatus({
                ...baseInput,
                publishedAt: new Date('2026-05-01T00:00:00.000Z'),
                now: new Date('2026-05-21T00:00:00.000Z'),
            })
        ).toBe('COMPLETED')
    })

    it('treats archived campaigns as archived regardless of the date window', () => {
        expect(
            deriveCampaignStatus({
                ...baseInput,
                publishedAt: new Date('2026-05-01T00:00:00.000Z'),
                archivedAt: new Date('2026-05-11T00:00:00.000Z'),
                now: new Date('2026-05-15T00:00:00.000Z'),
            })
        ).toBe('ARCHIVED')
    })

    it('rejects invalid campaign windows', () => {
        expect(() =>
            deriveCampaignStatus({
                startAt: new Date('2026-05-20T00:00:00.000Z'),
                endAt: new Date('2026-05-10T00:00:00.000Z'),
                publishedAt: new Date('2026-05-01T00:00:00.000Z'),
            })
        ).toThrow('Campaign startAt must be on or before endAt.')
    })

    it('builds derived-status updates when stored campaign statuses are stale', () => {
        const now = new Date('2026-05-15T00:00:00.000Z')

        expect(
            getDerivedCampaignStatusUpdate(
                {
                    id: 'campaign-1',
                    status: 'SCHEDULED',
                    startAt: new Date('2026-05-10T00:00:00.000Z'),
                    endAt: new Date('2026-05-20T00:00:00.000Z'),
                    publishedAt: new Date('2026-05-01T00:00:00.000Z'),
                    archivedAt: null,
                },
                now
            )
        ).toEqual({
            id: 'campaign-1',
            nextStatus: 'ACTIVE',
            previousStatus: 'SCHEDULED',
        })

        expect(
            getDerivedCampaignStatusUpdate(
                {
                    id: 'campaign-2',
                    status: 'ACTIVE',
                    startAt: new Date('2026-05-10T00:00:00.000Z'),
                    endAt: new Date('2026-05-20T00:00:00.000Z'),
                    publishedAt: new Date('2026-05-01T00:00:00.000Z'),
                    archivedAt: null,
                },
                now
            )
        ).toBeNull()
    })

    it('collects all stale derived-status updates for a batch of campaigns', () => {
        const updates = getDerivedCampaignStatusUpdates(
            [
                {
                    id: 'campaign-1',
                    status: 'SCHEDULED',
                    startAt: new Date('2026-05-10T00:00:00.000Z'),
                    endAt: new Date('2026-05-20T00:00:00.000Z'),
                    publishedAt: new Date('2026-05-01T00:00:00.000Z'),
                    archivedAt: null,
                },
                {
                    id: 'campaign-2',
                    status: 'ACTIVE',
                    startAt: new Date('2026-05-01T00:00:00.000Z'),
                    endAt: new Date('2026-05-05T00:00:00.000Z'),
                    publishedAt: new Date('2026-04-28T00:00:00.000Z'),
                    archivedAt: null,
                },
                {
                    id: 'campaign-3',
                    status: 'ARCHIVED',
                    startAt: new Date('2026-05-01T00:00:00.000Z'),
                    endAt: new Date('2026-05-05T00:00:00.000Z'),
                    publishedAt: new Date('2026-04-28T00:00:00.000Z'),
                    archivedAt: new Date('2026-05-02T00:00:00.000Z'),
                },
            ],
            new Date('2026-05-15T00:00:00.000Z')
        )

        expect(updates).toEqual([
            {
                id: 'campaign-1',
                nextStatus: 'ACTIVE',
                previousStatus: 'SCHEDULED',
            },
            {
                id: 'campaign-2',
                nextStatus: 'COMPLETED',
                previousStatus: 'ACTIVE',
            },
        ])
    })
})
