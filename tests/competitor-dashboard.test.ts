import { describe, expect, it } from 'vitest'

import {
    buildCompetitorDashboardViewModel,
    defaultCompetitorDashboardViewModel,
    rankStandings,
} from '@/lib/competitor-dashboard'

describe('competitor dashboard view model', () => {
    it('builds a live dashboard snapshot from standings and entries', () => {
        const viewModel = buildCompetitorDashboardViewModel(
            {
                campaign: {
                    endAt: new Date('2026-05-20T23:00:00Z'),
                    id: 'campaign-1',
                    name: 'Spring Story Sprint',
                    startAt: new Date('2026-04-20T12:00:00Z'),
                    status: 'ACTIVE',
                    timezone: 'UTC',
                },
                participant: {
                    createdAt: new Date('2026-04-01T12:00:00Z'),
                    id: 'participant-2',
                    joinedAt: new Date('2026-04-01T12:00:00Z'),
                    lastActivityAt: new Date('2026-05-06T12:00:00Z'),
                    campaign: {
                        endAt: new Date('2026-05-20T23:00:00Z'),
                        id: 'campaign-1',
                        name: 'Spring Story Sprint',
                        startAt: new Date('2026-04-20T12:00:00Z'),
                        status: 'ACTIVE',
                        timezone: 'UTC',
                    },
                    totalAudiobookMinutes: 95,
                    totalBooks: 3,
                    totalChallenges: 1,
                    totalPages: 320,
                    totalPoints: { toString: () => '418.25' },
                },
                scoringRules: {
                    pointsPerAudiobookMinute: '0.75',
                    pointsPerBook: '25',
                    pointsPerChallengeCompletion: '40',
                    pointsPerPage: '1',
                },
                recentEntries: [
                    {
                        activityDate: new Date('2026-05-06T12:00:00Z'),
                        bookAuthor: 'Kate DiCamillo',
                        bookTitle: 'Because of Winn-Dixie',
                        challengeCompletion: null,
                        id: 'entry-0',
                        type: 'BOOK_COMPLETION',
                        value: 1,
                    },
                    {
                        activityDate: new Date('2026-05-05T12:00:00Z'),
                        bookAuthor: 'Kate DiCamillo',
                        bookTitle: 'Because of Winn-Dixie',
                        challengeCompletion: null,
                        id: 'entry-1',
                        type: 'PAGES_READ',
                        value: 180,
                    },
                    {
                        activityDate: new Date('2026-05-04T12:00:00Z'),
                        bookAuthor: null,
                        bookTitle: null,
                        challengeCompletion: {
                            challenge: {
                                title: 'Read outside',
                            },
                            reviewState: 'APPROVED',
                        },
                        id: 'entry-2',
                        type: 'CHALLENGE_COMPLETION',
                        value: 1,
                    },
                ],
                standings: [
                    {
                        createdAt: new Date('2026-04-01T12:00:00Z'),
                        id: 'participant-1',
                        lastActivityAt: new Date('2026-05-07T12:00:00Z'),
                        totalAudiobookMinutes: 120,
                        totalBooks: 4,
                        totalChallenges: 2,
                        totalPages: 340,
                        totalPoints: { toString: () => '432.25' },
                        user: {
                            email: 'leader@example.com',
                            name: 'Morgan',
                        },
                    },
                    {
                        createdAt: new Date('2026-04-01T12:00:00Z'),
                        id: 'participant-2',
                        lastActivityAt: new Date('2026-05-06T12:00:00Z'),
                        totalAudiobookMinutes: 95,
                        totalBooks: 3,
                        totalChallenges: 1,
                        totalPages: 320,
                        totalPoints: { toString: () => '418.25' },
                        user: {
                            email: 'reader@example.com',
                            name: 'Avery',
                        },
                    },
                ],
            },
            new Date('2026-05-08T12:00:00Z')
        )

        expect(viewModel.hasQuest).toBe(true)
        expect(viewModel.campaignName).toBe('Spring Story Sprint')
        expect(viewModel.snapshotCards[0]).toMatchObject({
            title: 'Current rank',
            value: '#2',
            description: '14 points behind first place.',
        })
        expect(viewModel.snapshotCards[1]).toMatchObject({
            title: 'Total points',
            value: '418.25 points',
        })
        expect(viewModel.summaryMetrics).toEqual([])
        expect(viewModel.recentActivity[0]).toMatchObject({
            title: 'Because of Winn-Dixie',
            completedAtLabel: 'May 6, 2026',
            progressLabel: '180 pages',
            pointsLabel: '205 points',
        })
        expect(viewModel.shellMetrics[1]).toMatchObject({
            label: 'Current standing',
            value: '#2',
        })
    })

    it('shows the visible campaign even when the viewer is not linked yet', () => {
        const viewModel = buildCompetitorDashboardViewModel(
            {
                campaign: {
                    endAt: new Date('2026-05-20T23:00:00Z'),
                    id: 'campaign-1',
                    name: 'Spring Story Sprint',
                    startAt: new Date('2026-04-20T12:00:00Z'),
                    status: 'ACTIVE',
                    timezone: 'UTC',
                },
                participant: null,
                recentEntries: [],
                scoringRules: {
                    pointsPerAudiobookMinute: '0.75',
                    pointsPerBook: '25',
                    pointsPerChallengeCompletion: '40',
                    pointsPerPage: '1',
                },
                standings: [
                    {
                        createdAt: new Date('2026-04-01T12:00:00Z'),
                        id: 'participant-1',
                        lastActivityAt: new Date('2026-05-07T12:00:00Z'),
                        totalAudiobookMinutes: 120,
                        totalBooks: 4,
                        totalChallenges: 2,
                        totalPages: 340,
                        totalPoints: { toString: () => '432.25' },
                        user: {
                            email: 'leader@example.com',
                            name: 'Morgan',
                        },
                    },
                ],
            },
            new Date('2026-05-08T12:00:00Z')
        )

        expect(viewModel.hasQuest).toBe(true)
        expect(viewModel.campaignName).toBe('Spring Story Sprint')
        expect(viewModel.snapshotCards[0]).toMatchObject({
            title: 'Current rank',
            value: 'Unranked',
        })
        expect(viewModel.shellMetrics[1]).toMatchObject({
            label: 'Current standing',
            value: 'Unranked',
        })
    })

    it('returns the empty default model when no participant is available', () => {
        const viewModel = buildCompetitorDashboardViewModel(
            null,
            new Date('2026-05-08T12:00:00Z')
        )

        expect(viewModel).toEqual(defaultCompetitorDashboardViewModel)
    })

    it('keeps tied participants on the same rank and offsets the next rank', () => {
        const rankedStandings = rankStandings([
            {
                createdAt: new Date('2026-04-01T12:00:00Z'),
                id: 'participant-1',
                totalAudiobookMinutes: 120,
                totalBooks: 4,
                totalPages: 350,
                totalPoints: { toString: () => '450' },
            },
            {
                createdAt: new Date('2026-04-02T12:00:00Z'),
                id: 'participant-2',
                totalAudiobookMinutes: 120,
                totalBooks: 4,
                totalPages: 350,
                totalPoints: { toString: () => '450' },
            },
            {
                createdAt: new Date('2026-04-03T12:00:00Z'),
                id: 'participant-3',
                totalAudiobookMinutes: 95,
                totalBooks: 3,
                totalPages: 320,
                totalPoints: { toString: () => '418.25' },
            },
        ])

        expect(rankedStandings.map((standing) => standing.rankNumber)).toEqual([
            1, 1, 3,
        ])
    })
})
