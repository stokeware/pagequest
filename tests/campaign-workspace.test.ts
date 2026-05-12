import { describe, expect, it } from 'vitest'

import {
    calculateCampaignWorkspaceTotals,
    emptyCampaignWorkspaceState,
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
            pointsPerPage: 1,
        })

        expect(totals.hasMeaningfulProgress).toBe(true)
        expect(totals.totalPages).toBe(90)
        expect(totals.totalAudiobookMinutes).toBe(35)
        expect(totals.totalBooks).toBe(2)
        expect(totals.totalChallenges).toBe(2)
        expect(totals.totalPoints.toString()).toBe('191.25')
    })

    it('treats an empty personal goal shell as no meaningful progress', () => {
        const totals = calculateCampaignWorkspaceTotals({
            campaignChallenges: [],
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
})
