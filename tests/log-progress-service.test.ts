import { describe, expect, it, vi } from 'vitest'

import {
    recordLogProgressEntry,
    updateReadingEntryAsAdmin,
} from '@/lib/log-progress-service'

function buildParticipantSnapshot({
    challengePointValue = '15',
}: {
    challengePointValue?: string
} = {}) {
    return {
        id: 'participant-1',
        removedAt: null,
        userId: 'user-1',
        campaign: {
            entryDeleteWindowMinutes: 60,
            entryEditWindowMinutes: 180,
            endAt: new Date('2026-05-31T23:59:59.000Z'),
            id: 'campaign-1',
            challenges: [
                {
                    id: 'challenge-1',
                    kind: 'ADMIN',
                    pageMinuteMultiplier: { toString: () => '0' },
                    pointValue: { toString: () => challengePointValue },
                    templateChallenge: null,
                    title: 'Friend recommendation',
                },
            ],
            pointsPerAudiobookMinute: { toString: () => '0.75' },
            pointsPerBook: { toString: () => '10' },
            pointsPerPage: { toString: () => '1' },
            startAt: new Date('2026-05-01T00:00:00.000Z'),
            timezone: 'America/Chicago',
        },
    }
}

function buildTransaction({
    existingReviewStates = [],
    participant = buildParticipantSnapshot(),
    persistedEntries = [],
}: {
    existingReviewStates?: Array<{
        reviewState: 'APPROVED' | 'AUTO_APPROVED' | 'PENDING' | 'REJECTED'
    }>
    participant?: ReturnType<typeof buildParticipantSnapshot>
    persistedEntries?: Array<{
        activityDate: Date
        challengeCompletion: {
            awardedPoints: { toString(): string } | null
            reviewState: 'APPROVED' | 'AUTO_APPROVED' | 'PENDING' | 'REJECTED'
        } | null
        type:
            | 'BOOK_COMPLETION'
            | 'PAGES_READ'
            | 'AUDIOBOOK_MINUTES'
            | 'CHALLENGE_COMPLETION'
        value: number
    }>
}) {
    return {
        auditLog: {
            create: vi.fn(async () => undefined),
        },
        challengeCompletion: {
            create: vi.fn(async () => ({ id: 'completion-1' })),
            findMany: vi.fn(async () => existingReviewStates),
        },
        campaignParticipant: {
            findUnique: vi.fn(async () => participant),
            update: vi.fn(async () => undefined),
        },
        readingEntry: {
            create: vi.fn(async () => ({ id: 'entry-1' })),
            findUnique: vi.fn(async () => null),
            findMany: vi.fn(async () => persistedEntries),
            update: vi.fn(async () => undefined),
        },
    }
}

describe('recordLogProgressEntry', () => {
    it('recalculates participant totals after saving a standard reading entry', async () => {
        const transaction = buildTransaction({
            persistedEntries: [
                {
                    activityDate: new Date('2026-05-03T12:00:00.000Z'),
                    challengeCompletion: null,
                    type: 'BOOK_COMPLETION',
                    value: 1,
                },
                {
                    activityDate: new Date('2026-05-08T12:00:00.000Z'),
                    challengeCompletion: null,
                    type: 'PAGES_READ',
                    value: 42,
                },
            ],
        })

        const result = await recordLogProgressEntry(transaction, {
            actorUserId: 'user-1',
            formValues: {
                activityDate: '2026-05-08',
                bookAuthor: 'Lois Lowry',
                bookTitle: 'The Giver',
                challengeId: '',
                notes: 'Reading sprint entry',
                type: 'PAGES_READ',
                value: '42',
            },
            now: new Date('2026-05-08T20:00:00.000Z'),
            campaignParticipantId: 'participant-1',
        })

        expect(transaction.readingEntry.create).toHaveBeenCalledWith({
            data: {
                activityDate: new Date('2026-05-08T12:00:00.000Z'),
                bookAuthor: 'Lois Lowry',
                bookTitle: 'The Giver',
                createdByUserId: 'user-1',
                notes: 'Reading sprint entry',
                campaignParticipantId: 'participant-1',
                type: 'PAGES_READ',
                updatedByUserId: 'user-1',
                value: 42,
            },
            select: {
                id: true,
            },
        })
        expect(transaction.auditLog.create).toHaveBeenCalledWith({
            data: {
                action: 'reading-entry.created',
                actorUserId: 'user-1',
                entityId: 'entry-1',
                entityType: 'ReadingEntry',
                metadata: {
                    activityDate: '2026-05-08',
                    bookAuthor: 'Lois Lowry',
                    bookTitle: 'The Giver',
                    hasNotes: true,
                    type: 'PAGES_READ',
                    value: 42,
                },
                campaignId: 'campaign-1',
                campaignParticipantId: 'participant-1',
                readingEntryId: 'entry-1',
            },
        })
        expect(transaction.campaignParticipant.update).toHaveBeenCalledWith({
            data: {
                lastActivityAt: new Date('2026-05-08T12:00:00.000Z'),
                totalAudiobookMinutes: 0,
                totalBooks: 1,
                totalChallenges: 0,
                totalPages: 42,
                totalPoints: expect.objectContaining({
                    toString: expect.any(Function),
                }),
            },
            where: {
                id: 'participant-1',
            },
        })
        expect(result.totals.totalPoints.toString()).toBe('52')
    })

    it('auto-approves eligible challenge completions and includes them in totals', async () => {
        const transaction = buildTransaction({
            persistedEntries: [
                {
                    activityDate: new Date('2026-05-08T12:00:00.000Z'),
                    challengeCompletion: {
                        awardedPoints: { toString: () => '15' },
                        reviewState: 'AUTO_APPROVED',
                    },
                    type: 'CHALLENGE_COMPLETION',
                    value: 1,
                },
            ],
        })

        const result = await recordLogProgressEntry(transaction, {
            actorUserId: 'user-1',
            formValues: {
                activityDate: '2026-05-08',
                bookAuthor: '',
                bookTitle: '',
                challengeId: 'challenge-1',
                notes: 'Completed the recommendation prompt',
                type: 'CHALLENGE_COMPLETION',
                value: '1',
            },
            now: new Date('2026-05-08T20:00:00.000Z'),
            campaignParticipantId: 'participant-1',
        })

        expect(transaction.challengeCompletion.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                challengeId: 'challenge-1',
                campaignParticipantId: 'participant-1',
                reviewState: 'AUTO_APPROVED',
            }),
            select: {
                id: true,
            },
        })
        expect(transaction.auditLog.create).toHaveBeenNthCalledWith(1, {
            data: expect.objectContaining({
                action: 'reading-entry.created',
                entityId: 'entry-1',
                entityType: 'ReadingEntry',
            }),
        })
        expect(transaction.auditLog.create).toHaveBeenNthCalledWith(2, {
            data: {
                action: 'challenge-completion.submitted',
                actorUserId: 'user-1',
                challengeCompletionId: 'completion-1',
                challengeId: 'challenge-1',
                entityId: 'completion-1',
                entityType: 'ChallengeCompletion',
                metadata: {
                    awardedPoints: '15',
                    challengeTitle: 'Friend recommendation',
                    reviewState: 'AUTO_APPROVED',
                    value: 1,
                },
                campaignId: 'campaign-1',
                campaignParticipantId: 'participant-1',
                readingEntryId: 'entry-1',
            },
        })
        expect(result.challengeCompletionId).toBe('completion-1')
        expect(result.totals.totalChallenges).toBe(1)
        expect(result.totals.totalPoints.toString()).toBe('15')
    })
})

describe('updateReadingEntryAsAdmin', () => {
    it('updates a standard reading entry and recalculates totals', async () => {
        const participant = buildParticipantSnapshot()
        const transaction = buildTransaction({
            participant,
            persistedEntries: [
                {
                    activityDate: new Date('2026-05-03T12:00:00.000Z'),
                    challengeCompletion: null,
                    type: 'BOOK_COMPLETION',
                    value: 1,
                },
                {
                    activityDate: new Date('2026-05-08T12:00:00.000Z'),
                    challengeCompletion: null,
                    type: 'PAGES_READ',
                    value: 24,
                },
            ],
        })

        transaction.readingEntry.findUnique.mockResolvedValue({
            activityDate: new Date('2026-05-08T12:00:00.000Z'),
            bookAuthor: 'Lois Lowry',
            bookTitle: 'The Giver',
            createdAt: new Date('2026-05-08T12:05:00.000Z'),
            deletedAt: null,
            id: 'entry-1',
            notes: 'Original note',
            campaignParticipant: participant,
            type: 'PAGES_READ',
            value: 42,
        })

        const result = await updateReadingEntryAsAdmin(transaction, {
            actorUserId: 'admin-1',
            formValues: {
                activityDate: '2026-05-08',
                bookAuthor: 'Lois Lowry',
                bookTitle: 'The Giver',
                challengeId: '',
                notes: 'Corrected by admin',
                type: 'PAGES_READ',
                value: '24',
            },
            now: new Date('2026-05-08T20:00:00.000Z'),
            readingEntryId: 'entry-1',
        })

        expect(transaction.readingEntry.update).toHaveBeenCalledWith({
            data: {
                activityDate: new Date('2026-05-08T12:00:00.000Z'),
                bookAuthor: 'Lois Lowry',
                bookTitle: 'The Giver',
                notes: 'Corrected by admin',
                type: 'PAGES_READ',
                updatedByUserId: 'admin-1',
                value: 24,
            },
            where: {
                id: 'entry-1',
            },
        })
        expect(transaction.auditLog.create).toHaveBeenCalledWith({
            data: {
                action: 'reading-entry.admin-updated',
                actorUserId: 'admin-1',
                entityId: 'entry-1',
                entityType: 'ReadingEntry',
                metadata: {
                    previousEntry: {
                        activityDate: '2026-05-08T12:00:00.000Z',
                        bookAuthor: 'Lois Lowry',
                        bookTitle: 'The Giver',
                        hasNotes: true,
                        type: 'PAGES_READ',
                        value: 42,
                    },
                    updatedEntry: {
                        activityDate: '2026-05-08',
                        bookAuthor: 'Lois Lowry',
                        bookTitle: 'The Giver',
                        hasNotes: true,
                        type: 'PAGES_READ',
                        value: 24,
                    },
                },
                campaignId: 'campaign-1',
                campaignParticipantId: 'participant-1',
                readingEntryId: 'entry-1',
            },
        })
        expect(transaction.campaignParticipant.update).toHaveBeenCalledWith({
            data: {
                lastActivityAt: new Date('2026-05-08T12:00:00.000Z'),
                totalAudiobookMinutes: 0,
                totalBooks: 1,
                totalChallenges: 0,
                totalPages: 24,
                totalPoints: expect.objectContaining({
                    toString: expect.any(Function),
                }),
            },
            where: {
                id: 'participant-1',
            },
        })
        expect(result.totals.totalPoints.toString()).toBe('34')
    })
})
