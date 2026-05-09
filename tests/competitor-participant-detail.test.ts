import { describe, expect, it } from 'vitest'

import {
    buildCompetitorParticipantDetailViewModel,
    defaultCompetitorParticipantDetailViewModel,
} from '@/lib/competitor-participant-detail'

describe('competitor participant detail view model', () => {
    it('builds a full campaign history view for a participant on the current leaderboard', () => {
        const viewModel = buildCompetitorParticipantDetailViewModel({
            context: {
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
                    },
                ],
            },
            historyEntries: [
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
            rankLabel: '#2',
        })
        expect(viewModel.summaryMetrics[0]).toMatchObject({
            label: 'Rank',
            value: '#2',
        })
        expect(viewModel.historyEntries[0]).toMatchObject({
            title: 'Audiobook minutes · 45 minutes',
            description:
                'Because of Winn-Dixie by Kate DiCamillo. Logged May 6, 2026.',
            pointsLabel: '33.75 points',
            note: 'Listened in the carpool line.',
            statusLabel: null,
        })
        expect(viewModel.historyEntries[1]).toMatchObject({
            title: 'Challenge completion · Read outside',
            pointsLabel: '25 points',
            statusLabel: 'Approved',
        })
        expect(viewModel.historyEntries[2]).toMatchObject({
            title: 'Challenge completion · Recommend a book',
            pointsLabel: 'Pending review',
            statusLabel: 'Pending review',
        })
    })

    it('returns the default model when the participant is outside the board', () => {
        const viewModel = buildCompetitorParticipantDetailViewModel(null)

        expect(viewModel).toEqual(defaultCompetitorParticipantDetailViewModel)
    })
})
