import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import {
    calculateEntryPoints,
    calculateParticipantScoreTotals,
    deriveQuestStatus,
    type QuestScoringRules,
} from '@/lib/quest-domain'

const scoringRules: QuestScoringRules = {
    pointsPerBook: new Prisma.Decimal(25),
    pointsPerPage: new Prisma.Decimal(1),
    pointsPerAudiobookMinute: new Prisma.Decimal('0.75'),
    pointsPerChallengeCompletion: new Prisma.Decimal(40),
}

describe('calculateEntryPoints', () => {
    it('calculates audiobook minutes using the quest scoring rule', () => {
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

describe('deriveQuestStatus', () => {
    const baseInput = {
        startAt: new Date('2026-05-10T00:00:00.000Z'),
        endAt: new Date('2026-05-20T00:00:00.000Z'),
    }

    it('keeps unpublished quests in draft status', () => {
        expect(
            deriveQuestStatus({
                ...baseInput,
                now: new Date('2026-05-12T00:00:00.000Z'),
            })
        ).toBe('DRAFT')
    })

    it('derives scheduled, active, and completed statuses from the quest window', () => {
        expect(
            deriveQuestStatus({
                ...baseInput,
                publishedAt: new Date('2026-05-01T00:00:00.000Z'),
                now: new Date('2026-05-09T23:59:59.000Z'),
            })
        ).toBe('SCHEDULED')

        expect(
            deriveQuestStatus({
                ...baseInput,
                publishedAt: new Date('2026-05-01T00:00:00.000Z'),
                now: new Date('2026-05-15T00:00:00.000Z'),
            })
        ).toBe('ACTIVE')

        expect(
            deriveQuestStatus({
                ...baseInput,
                publishedAt: new Date('2026-05-01T00:00:00.000Z'),
                now: new Date('2026-05-21T00:00:00.000Z'),
            })
        ).toBe('COMPLETED')
    })

    it('treats archived quests as archived regardless of the date window', () => {
        expect(
            deriveQuestStatus({
                ...baseInput,
                publishedAt: new Date('2026-05-01T00:00:00.000Z'),
                archivedAt: new Date('2026-05-11T00:00:00.000Z'),
                now: new Date('2026-05-15T00:00:00.000Z'),
            })
        ).toBe('ARCHIVED')
    })

    it('rejects invalid quest windows', () => {
        expect(() =>
            deriveQuestStatus({
                startAt: new Date('2026-05-20T00:00:00.000Z'),
                endAt: new Date('2026-05-10T00:00:00.000Z'),
                publishedAt: new Date('2026-05-01T00:00:00.000Z'),
            })
        ).toThrow('Quest startAt must be on or before endAt.')
    })
})
