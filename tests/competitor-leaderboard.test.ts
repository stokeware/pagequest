import { describe, expect, it } from 'vitest'

import {
    buildCompetitorLeaderboardViewModel,
    defaultCompetitorLeaderboardViewModel,
} from '@/lib/competitor-leaderboard'

describe('competitor leaderboard view model', () => {
    it('builds standings with raw metrics and tie-aware ranks', () => {
        const viewModel = buildCompetitorLeaderboardViewModel(
            {
                participant: {
                    createdAt: new Date('2026-04-01T12:00:00Z'),
                    id: 'participant-2',
                    joinedAt: new Date('2026-04-01T12:00:00Z'),
                    lastActivityAt: new Date('2026-05-06T12:00:00Z'),
                    quest: {
                        endAt: new Date('2026-05-20T23:00:00Z'),
                        id: 'quest-1',
                        name: 'Spring Story Sprint',
                        startAt: new Date('2026-04-20T12:00:00Z'),
                        status: 'ACTIVE',
                        timezone: 'UTC',
                    },
                    totalAudiobookMinutes: 120,
                    totalBooks: 4,
                    totalChallenges: 2,
                    totalPages: 350,
                    totalPoints: { toString: () => '450' },
                },
                recentEntries: [],
                standings: [
                    {
                        createdAt: new Date('2026-04-01T12:00:00Z'),
                        id: 'participant-1',
                        lastActivityAt: new Date('2026-05-07T12:00:00Z'),
                        totalAudiobookMinutes: 120,
                        totalBooks: 4,
                        totalChallenges: 2,
                        totalPages: 350,
                        totalPoints: { toString: () => '450' },
                        user: {
                            email: 'leader@example.com',
                            name: 'Morgan',
                        },
                    },
                    {
                        createdAt: new Date('2026-04-02T12:00:00Z'),
                        id: 'participant-2',
                        lastActivityAt: new Date('2026-05-06T12:00:00Z'),
                        totalAudiobookMinutes: 120,
                        totalBooks: 4,
                        totalChallenges: 2,
                        totalPages: 350,
                        totalPoints: { toString: () => '450' },
                        user: {
                            email: 'reader@example.com',
                            name: 'Avery',
                        },
                    },
                    {
                        createdAt: new Date('2026-04-03T12:00:00Z'),
                        id: 'participant-3',
                        lastActivityAt: null,
                        totalAudiobookMinutes: 95,
                        totalBooks: 3,
                        totalChallenges: 1,
                        totalPages: 320,
                        totalPoints: { toString: () => '418.25' },
                        user: {
                            email: 'third@example.com',
                            name: 'Jordan',
                        },
                    },
                ],
            },
            new Date('2026-05-08T12:00:00Z')
        )

        expect(viewModel.hasQuest).toBe(true)
        expect(viewModel.questStatusLabel).toBe('Active leaderboard')
        expect(viewModel.highlights[0]).toMatchObject({
            label: 'Your rank',
            value: '#1',
        })
        expect(viewModel.rows.map((row) => row.rankLabel)).toEqual([
            '#1',
            '#1',
            '#3',
        ])
        expect(viewModel.rows.map((row) => row.readerLabel)).toEqual([
            'Morgan',
            'Avery (You)',
            'Jordan',
        ])
        expect(viewModel.rows[1]).toMatchObject({
            readerLabel: 'Avery (You)',
            participantHref: '/leaderboard/participant-2',
            pointsLabel: '450 points',
            metricsLabel: '350 pages • 120 minutes • 4 books • 2 challenges',
        })
    })

    it('returns the empty model without a linked quest', () => {
        const viewModel = buildCompetitorLeaderboardViewModel(
            null,
            new Date('2026-05-08T12:00:00Z')
        )

        expect(viewModel).toEqual(defaultCompetitorLeaderboardViewModel)
    })
})
