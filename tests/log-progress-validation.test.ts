import { describe, expect, it } from 'vitest'

import {
    getLogProgressFormDefaults,
    getReadingEntryMetadataSummary,
    getReadingMetadataFieldCopy,
    normalizeReadingEntryMetadata,
    resolveReadingEntryWindowAccess,
    validateLogProgressFormValues,
} from '@/lib/log-progress'

const activeQuestPolicy = {
    entryDeleteWindowMinutes: 60,
    entryEditWindowMinutes: 180,
    questEndAt: '2026-05-31T23:59:59.000Z',
    questStartAt: '2026-05-01T00:00:00.000Z',
    timezone: 'America/Chicago',
} as const

describe('log progress validation', () => {
    it('accepts a valid pages-read entry', () => {
        const result = validateLogProgressFormValues(
            {
                ...getLogProgressFormDefaults(),
                activityDate: '2026-05-08',
                notes: '  Read during the library sprint.  ',
                type: 'PAGES_READ',
                value: '42',
            },
            {
                availableChallengeIds: [],
                questPolicy: activeQuestPolicy,
            }
        )

        expect(result.success).toBe(true)

        if (result.success) {
            expect(result.data.notes).toBe('Read during the library sprint.')
        }
    })

    it('rejects non-challenge entries without a positive whole number', () => {
        const result = validateLogProgressFormValues(
            {
                ...getLogProgressFormDefaults(),
                activityDate: '2026-05-08',
                type: 'AUDIOBOOK_MINUTES',
                value: '0',
            },
            {
                availableChallengeIds: [],
                questPolicy: activeQuestPolicy,
            }
        )

        expect(result.success).toBe(false)

        if (!result.success) {
            expect(result.error.flatten().fieldErrors.value).toEqual([
                'Enter a whole number of audiobook minutes.',
            ])
        }
    })

    it('rejects challenge completions that do not match an active quest challenge', () => {
        const result = validateLogProgressFormValues(
            {
                ...getLogProgressFormDefaults(),
                activityDate: '2026-05-08',
                challengeId: 'challenge-99',
                type: 'CHALLENGE_COMPLETION',
            },
            {
                availableChallengeIds: ['challenge-1'],
                questPolicy: activeQuestPolicy,
            }
        )

        expect(result.success).toBe(false)

        if (!result.success) {
            expect(result.error.flatten().fieldErrors.challengeId).toEqual([
                'Choose a challenge from this quest.',
            ])
        }
    })

    it('rejects activity dates outside the quest window', () => {
        const result = validateLogProgressFormValues(
            {
                ...getLogProgressFormDefaults(),
                activityDate: '2026-06-02',
                type: 'BOOK_COMPLETION',
                value: '1',
            },
            {
                availableChallengeIds: [],
                questPolicy: activeQuestPolicy,
            }
        )

        expect(result.success).toBe(false)

        if (!result.success) {
            expect(result.error.flatten().fieldErrors.activityDate).toEqual([
                'Choose a date from 2026-05-01 through 2026-05-31 for this quest.',
            ])
        }
    })

    it('computes edit and delete access from the configured time windows', () => {
        const editAccess = resolveReadingEntryWindowAccess({
            action: 'edit',
            createdAt: '2026-05-08T12:00:00.000Z',
            now: '2026-05-08T14:30:00.000Z',
            windowMinutes: activeQuestPolicy.entryEditWindowMinutes,
        })

        const deleteAccess = resolveReadingEntryWindowAccess({
            action: 'delete',
            createdAt: '2026-05-08T12:00:00.000Z',
            now: '2026-05-08T13:30:01.000Z',
            windowMinutes: activeQuestPolicy.entryDeleteWindowMinutes,
        })

        expect(editAccess.isAllowed).toBe(true)
        expect(editAccess.message).toContain('can still be edited')
        expect(deleteAccess.isAllowed).toBe(false)
        expect(deleteAccess.message).toContain('can no longer be deleted')
    })

    it('normalizes optional book metadata and builds a readable summary', () => {
        const metadata = normalizeReadingEntryMetadata({
            bookAuthor: '  Lois Lowry  ',
            bookTitle: '  The Giver ',
        })

        expect(metadata).toEqual({
            bookAuthor: 'Lois Lowry',
            bookTitle: 'The Giver',
        })
        expect(getReadingEntryMetadataSummary(metadata)).toBe(
            'The Giver by Lois Lowry'
        )
    })

    it('returns entry-type specific metadata field copy', () => {
        expect(getReadingMetadataFieldCopy('BOOK_COMPLETION')).toMatchObject({
            titleLabel: 'Finished title',
            titlePlaceholder: 'The Secret Garden',
        })

        expect(getReadingMetadataFieldCopy('AUDIOBOOK_MINUTES')).toMatchObject({
            titleLabel: 'Audiobook title (optional)',
            authorPlaceholder: 'Kate DiCamillo',
        })
    })
})
