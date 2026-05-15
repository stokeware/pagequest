import { describe, expect, it } from 'vitest'

import {
    calculateCampaignWorkspaceTotals,
    emptyCampaignWorkspaceState,
    getCompletedCampaignWorkspaceBooks,
    normalizeCampaignWorkspaceRowCompletions,
    parseCampaignWorkspaceState,
    setCampaignWorkspaceRowCompletion,
} from '@/lib/campaign-workspace'

describe('campaign workspace totals', () => {
    it('derives leaderboard totals from saved progress rows', () => {
        const totals = calculateCampaignWorkspaceTotals({
            campaignChallenges: [
                {
                    id: 'challenge-1',
                    pageMinuteMultiplier: 0,
                    pointValue: 25,
                },
                {
                    id: 'challenge-2',
                    pageMinuteMultiplier: 2,
                    pointValue: 0,
                },
            ],
            pointsPerMinute: 0.75,
            pointsPerPage: 1,
            workspaceState: {
                personalGoalTitle: 'Big finish',
                progressRows: [
                    {
                        bookName: 'The Secret Garden',
                        challengeId: 'challenge-1',
                        completed: true,
                        id: 'progress-row-1',
                        minutes: '20',
                        pages: '10',
                        rowType: 'STANDARD',
                    },
                    {
                        bookName: 'A Wrinkle in Time',
                        challengeId: 'challenge-2',
                        completed: true,
                        id: 'progress-row-2',
                        minutes: '0',
                        pages: '50',
                        rowType: 'STANDARD',
                    },
                    {
                        bookName: 'Current chapter book',
                        challengeId: '',
                        completed: false,
                        id: 'progress-row-3',
                        minutes: '15',
                        pages: '30',
                        rowType: 'STANDARD',
                    },
                ],
                recommendationTitle: '',
            },
            pointsPerBook: 10,
            pointsPerPage: 1,
        })

        expect(totals.hasMeaningfulProgress).toBe(true)
        expect(totals.totalPages).toBe(90)
        expect(totals.totalAudiobookMinutes).toBe(35)
        expect(totals.totalBooks).toBe(2)
        expect(totals.totalChallenges).toBe(2)
        expect(totals.totalPoints.toString()).toBe('211.25')
    })

    it('treats an empty personal goal shell as no meaningful progress', () => {
        const totals = calculateCampaignWorkspaceTotals({
            campaignChallenges: [],
            pointsPerBook: 10,
            pointsPerMinute: 0.75,
            pointsPerPage: 1,
            workspaceState: {
                ...emptyCampaignWorkspaceState,
                progressRows: [
                    {
                        bookName: '',
                        challengeId: '',
                        completed: false,
                        id: 'progress-row-personal-goal',
                        minutes: '',
                        pages: '',
                        rowType: 'PERSONAL_GOAL',
                    },
                ],
            },
        })

        expect(totals.hasMeaningfulProgress).toBe(false)
        expect(totals.totalPoints.toString()).toBe('0')
    })

    it('stores the first completion timestamp until a row is unchecked', () => {
        const firstCompletedRow = setCampaignWorkspaceRowCompletion({
            completed: true,
            now: new Date('2026-05-07T12:00:00Z'),
            row: {
                bookName: 'Matilda',
                challengeId: '',
                completed: false,
                id: 'progress-row-1',
                minutes: '30',
                pages: '150',
                rowType: 'STANDARD',
            },
        })

        const preservedCompletedRow = setCampaignWorkspaceRowCompletion({
            completed: true,
            now: new Date('2026-05-10T12:00:00Z'),
            row: firstCompletedRow,
        })
        const uncheckedRow = setCampaignWorkspaceRowCompletion({
            completed: false,
            row: preservedCompletedRow,
        })

        expect(firstCompletedRow.completedAt).toBe('2026-05-07T12:00:00.000Z')
        expect(preservedCompletedRow.completedAt).toBe(
            '2026-05-07T12:00:00.000Z'
        )
        expect(uncheckedRow.completedAt).toBeUndefined()
    })

    it('returns saved completion timestamps for completed workspace books', () => {
        const workspaceState = parseCampaignWorkspaceState({
            personalGoalTitle: '',
            progressRows: [
                {
                    bookName: 'The Penderwicks',
                    challengeId: 'challenge-1',
                    completed: true,
                    completedAt: '2026-05-07T18:30:00.000Z',
                    id: 'progress-row-1',
                    minutes: '0',
                    pages: '340',
                    rowType: 'STANDARD',
                },
            ],
            recommendationTitle: '',
        })

        const books = getCompletedCampaignWorkspaceBooks(workspaceState)

        expect(books).toHaveLength(1)
        expect(books[0]?.completedAt?.toISOString()).toBe(
            '2026-05-07T18:30:00.000Z'
        )
    })

    it('backfills missing completion timestamps for older saved rows', () => {
        const rows = normalizeCampaignWorkspaceRowCompletions({
            now: new Date('2026-05-06T12:00:00Z'),
            rows: [
                {
                    bookName: 'Because of Winn-Dixie',
                    challengeId: '',
                    completed: true,
                    id: 'progress-row-1',
                    minutes: '0',
                    pages: '180',
                    rowType: 'STANDARD',
                },
            ],
        })

        expect(rows[0]?.completedAt).toBe('2026-05-06T12:00:00.000Z')
    })
})
