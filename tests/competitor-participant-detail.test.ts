import { describe, expect, it } from 'vitest'

import {
    buildCompetitorParticipantDetailViewModel,
    defaultCompetitorParticipantDetailViewModel,
} from '@/lib/competitor-participant-detail'

describe('competitor participant detail view model', () => {
    it('builds dashboard-style cards and recent activity for a participant on the current leaderboard', () => {
        const viewModel = buildCompetitorParticipantDetailViewModel({
            context: {
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
                recentEntries: [],
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
                        workspaceCompletedBooks: [],
                    },
                    {
                        createdAt: new Date('2026-04-02T12:00:00Z'),
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
                        workspaceCompletedBooks: [],
                    },
                ],
            },
            historyEntries: [
                {
                    activityDate: new Date('2026-05-07T12:00:00Z'),
                    bookAuthor: 'Kate DiCamillo',
                    bookTitle: 'Because of Winn-Dixie',
                    challengeCompletion: null,
                    id: 'entry-0',
                    notes: null,
                    type: 'BOOK_COMPLETION',
                    value: 1,
                },
                {
                    activityDate: new Date('2026-05-06T12:00:00Z'),
                    bookAuthor: 'Kate DiCamillo',
                    bookTitle: 'Because of Winn-Dixie',
                    challengeCompletion: null,
                    id: 'entry-1',
                    notes: 'Listened in the carpool line.',
                    type: 'AUDIOBOOK_MINUTES',
                    value: 45,
                },
                {
                    activityDate: new Date('2026-05-05T12:00:00Z'),
                    bookAuthor: null,
                    bookTitle: null,
                    challengeCompletion: {
                        awardedPoints: { toString: () => '25' },
                        challenge: {
                            title: 'Read outside',
                        },
                        evidenceText: 'Finished this one on the porch swing.',
                        reviewState: 'APPROVED',
                    },
                    id: 'entry-2',
                    notes: null,
                    type: 'CHALLENGE_COMPLETION',
                    value: 1,
                },
                {
                    activityDate: new Date('2026-05-04T12:00:00Z'),
                    bookAuthor: null,
                    bookTitle: null,
                    challengeCompletion: {
                        awardedPoints: null,
                        challenge: {
                            title: 'Recommend a book',
                        },
                        evidenceText:
                            'Told my cousin about the book at dinner.',
                        reviewState: 'PENDING',
                    },
                    id: 'entry-3',
                    notes: null,
                    type: 'CHALLENGE_COMPLETION',
                    value: 1,
                },
            ],
            participantId: 'participant-2',
            scoringRules: {
                pointsPerAudiobookMinute: '0.75',
                pointsPerBook: '1',
                pointsPerChallengeCompletion: '20',
                pointsPerPage: '1',
            },
        })

        expect(viewModel).toMatchObject({
            hasParticipant: true,
            isViewer: true,
            participantId: 'participant-2',
            participantLabel: 'Avery',
            campaignName: 'Spring Story Sprint',
        })
        expect(viewModel.snapshotCards[0]).toMatchObject({
            title: 'Current rank',
            value: '#2',
            description: '14 points behind first place.',
        })
        expect(viewModel.snapshotCards[1]).toMatchObject({
            title: 'Total points',
            value: '418.25 points',
            description:
                '320 pages • 95 audiobook minutes • 3 books • 1 challenge',
        })
        expect(viewModel.recentActivity[0]).toMatchObject({
            title: 'Because of Winn-Dixie',
            completedAtLabel: 'May 7, 2026',
            progressLabel: '45 audiobook minutes',
            isViewer: true,
            pointsLabel: '34.75 points',
        })
    })

    it('falls back to workspace completed books when no reading entries exist', () => {
        const viewModel = buildCompetitorParticipantDetailViewModel({
            context: {
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
                recentEntries: [],
                standings: [
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
                        workspaceCompletedBooks: [
                            {
                                activityDate: new Date('2026-05-06T12:00:00Z'),
                                challengeLabel: 'Read outside',
                                id: 'participant-2:progress-row-1',
                                participantId: 'participant-2',
                                pointsAwarded: 650,
                                readerLabel: 'Avery',
                                totalAudiobookMinutes: 0,
                                totalPages: 500,
                                title: 'Matilda',
                            },
                        ],
                    },
                ],
            },
            historyEntries: [],
            participantId: 'participant-2',
            scoringRules: {
                pointsPerAudiobookMinute: '0.75',
                pointsPerBook: '50',
                pointsPerChallengeCompletion: '20',
                pointsPerPage: '1',
            },
        })

        expect(viewModel.participantSummary).toBe(
            'Avery has 1 completed book tracked for this campaign.'
        )
        expect(viewModel.recentActivity[0]).toMatchObject({
            title: 'Matilda',
            completedAtLabel: 'May 6, 2026',
            progressLabel: '500 pages',
            pointsLabel: '650 points',
            readerLabel: null,
        })
    })

    it('returns the default model when the participant is outside the board', () => {
        const viewModel = buildCompetitorParticipantDetailViewModel(null)

        expect(viewModel).toEqual(defaultCompetitorParticipantDetailViewModel)
    })
})
