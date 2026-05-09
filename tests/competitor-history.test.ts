import { describe, expect, it } from 'vitest'

import {
    buildCompetitorHistoryViewModel,
    defaultCompetitorHistoryViewModel,
} from '@/lib/competitor-history'

describe('competitor history view model', () => {
    it('defaults to the active campaign timeline and exposes past campaigns', () => {
        const viewModel = buildCompetitorHistoryViewModel({
            participants: [
                {
                    createdAt: new Date('2026-04-01T12:00:00Z'),
                    id: 'participant-active',
                    lastActivityAt: new Date('2026-05-06T12:00:00Z'),
                    campaign: {
                        endAt: new Date('2026-05-20T23:00:00Z'),
                        name: 'Spring Story Sprint',
                        startAt: new Date('2026-04-20T12:00:00Z'),
                        status: 'ACTIVE',
                        timezone: 'UTC',
                    },
                    readingEntries: [
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
                    ],
                    scoringRules: {
                        pointsPerAudiobookMinute: '0.75',
                        pointsPerBook: '1',
                        pointsPerChallengeCompletion: '20',
                        pointsPerPage: '1',
                    },
                    totalAudiobookMinutes: 95,
                    totalBooks: 3,
                    totalChallenges: 1,
                    totalPages: 320,
                    totalPoints: { toString: () => '418.25' },
                },
                {
                    createdAt: new Date('2025-10-01T12:00:00Z'),
                    id: 'participant-past',
                    lastActivityAt: new Date('2025-12-10T12:00:00Z'),
                    campaign: {
                        endAt: new Date('2025-12-20T23:00:00Z'),
                        name: 'Winter Reading Rally',
                        startAt: new Date('2025-11-01T12:00:00Z'),
                        status: 'COMPLETED',
                        timezone: 'UTC',
                    },
                    readingEntries: [
                        {
                            activityDate: new Date('2025-12-10T12:00:00Z'),
                            bookAuthor: null,
                            bookTitle: 'The Secret Garden',
                            challengeCompletion: null,
                            id: 'entry-2',
                            notes: null,
                            type: 'PAGES_READ',
                            value: 30,
                        },
                    ],
                    scoringRules: {
                        pointsPerAudiobookMinute: '0.5',
                        pointsPerBook: '2',
                        pointsPerChallengeCompletion: '10',
                        pointsPerPage: '1',
                    },
                    totalAudiobookMinutes: 30,
                    totalBooks: 4,
                    totalChallenges: 2,
                    totalPages: 410,
                    totalPoints: { toString: () => '456' },
                },
            ],
            selectedParticipantId: null,
        })

        expect(viewModel.hasCampaignHistory).toBe(true)
        expect(viewModel.selectedCampaignName).toBe('Spring Story Sprint')
        expect(viewModel.currentCampaignCard).toBeNull()
        expect(viewModel.timelineEntries[0]).toMatchObject({
            title: 'Audiobook minutes · 45 minutes',
            pointsLabel: '33.75 points',
        })
        expect(viewModel.pastCampaignCards[0]).toMatchObject({
            campaignName: 'Winter Reading Rally',
            href: '/history?campaign=participant-past',
        })
    })

    it('lets the viewer switch to a past campaign timeline', () => {
        const viewModel = buildCompetitorHistoryViewModel({
            participants: [
                {
                    createdAt: new Date('2026-04-01T12:00:00Z'),
                    id: 'participant-active',
                    lastActivityAt: new Date('2026-05-06T12:00:00Z'),
                    campaign: {
                        endAt: new Date('2026-05-20T23:00:00Z'),
                        name: 'Spring Story Sprint',
                        startAt: new Date('2026-04-20T12:00:00Z'),
                        status: 'ACTIVE',
                        timezone: 'UTC',
                    },
                    readingEntries: [],
                    scoringRules: {
                        pointsPerAudiobookMinute: '0.75',
                        pointsPerBook: '1',
                        pointsPerChallengeCompletion: '20',
                        pointsPerPage: '1',
                    },
                    totalAudiobookMinutes: 95,
                    totalBooks: 3,
                    totalChallenges: 1,
                    totalPages: 320,
                    totalPoints: { toString: () => '418.25' },
                },
                {
                    createdAt: new Date('2025-10-01T12:00:00Z'),
                    id: 'participant-past',
                    lastActivityAt: new Date('2025-12-10T12:00:00Z'),
                    campaign: {
                        endAt: new Date('2025-12-20T23:00:00Z'),
                        name: 'Winter Reading Rally',
                        startAt: new Date('2025-11-01T12:00:00Z'),
                        status: 'COMPLETED',
                        timezone: 'UTC',
                    },
                    readingEntries: [
                        {
                            activityDate: new Date('2025-12-10T12:00:00Z'),
                            bookAuthor: null,
                            bookTitle: null,
                            challengeCompletion: {
                                awardedPoints: { toString: () => '10' },
                                challenge: {
                                    title: 'Recommend a book',
                                },
                                evidenceText: 'Passed the book to a cousin.',
                                reviewState: 'APPROVED',
                            },
                            id: 'entry-3',
                            notes: null,
                            type: 'CHALLENGE_COMPLETION',
                            value: 1,
                        },
                    ],
                    scoringRules: {
                        pointsPerAudiobookMinute: '0.5',
                        pointsPerBook: '2',
                        pointsPerChallengeCompletion: '10',
                        pointsPerPage: '1',
                    },
                    totalAudiobookMinutes: 30,
                    totalBooks: 4,
                    totalChallenges: 2,
                    totalPages: 410,
                    totalPoints: { toString: () => '456' },
                },
            ],
            selectedParticipantId: 'participant-past',
        })

        expect(viewModel.selectedCampaignName).toBe('Winter Reading Rally')
        expect(viewModel.selectedCampaignStatusLabel).toBe('Completed campaign')
        expect(viewModel.currentCampaignCard).toMatchObject({
            campaignName: 'Spring Story Sprint',
            href: '/history?campaign=participant-active',
        })
        expect(viewModel.pastCampaignCards[0]).toMatchObject({
            isSelected: true,
            participantId: 'participant-past',
        })
        expect(viewModel.timelineEntries[0]).toMatchObject({
            title: 'Challenge completion · Recommend a book',
            pointsLabel: '10 points',
            statusLabel: 'Approved',
        })
    })

    it('returns the empty model when no history exists', () => {
        const viewModel = buildCompetitorHistoryViewModel(null)

        expect(viewModel).toEqual(defaultCompetitorHistoryViewModel)
    })
})
