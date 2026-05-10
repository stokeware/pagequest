import { describe, expect, it } from 'vitest'

import {
    buildAdminCampaignResultsCsv,
    buildAdminReportsViewModel,
    defaultAdminReportsViewModel,
} from '@/lib/admin-reports'

describe('admin reports view model', () => {
    it('builds a participation summary for the primary reportable campaign', () => {
        const viewModel = buildAdminReportsViewModel({
            auditLogs: [
                {
                    action: 'invitation.created',
                    actor: {
                        email: 'admin@example.com',
                        name: 'Alex Admin',
                    },
                    challenge: null,
                    createdAt: new Date('2026-05-08T10:15:00Z'),
                    entityType: 'Invitation',
                    id: 'audit-1',
                    invitation: {
                        email: 'reader@example.com',
                    },
                    metadata: {
                        email: 'reader@example.com',
                    },
                    campaignParticipant: null,
                },
                {
                    action: 'reading-entry.admin-updated',
                    actor: {
                        email: 'admin@example.com',
                        name: 'Alex Admin',
                    },
                    challenge: null,
                    createdAt: new Date('2026-05-08T12:30:00Z'),
                    entityType: 'ReadingEntry',
                    id: 'audit-2',
                    invitation: null,
                    metadata: {
                        updatedEntry: {
                            type: 'PAGES_READ',
                            value: 24,
                        },
                    },
                    campaignParticipant: {
                        user: {
                            email: 'leader@example.com',
                            name: 'Morgan',
                        },
                    },
                },
            ],
            availableQuests: [
                {
                    createdAt: new Date('2026-03-01T12:00:00Z'),
                    endAt: new Date('2026-04-20T23:00:00Z'),
                    id: 'campaign-archived',
                    name: 'Winter Reading Rally',
                    startAt: new Date('2026-03-20T12:00:00Z'),
                    status: 'ARCHIVED',
                    timezone: 'UTC',
                },
                {
                    createdAt: new Date('2026-04-01T12:00:00Z'),
                    endAt: new Date('2026-05-20T23:00:00Z'),
                    id: 'campaign-active',
                    name: 'Spring Story Sprint',
                    startAt: new Date('2026-04-20T12:00:00Z'),
                    status: 'ACTIVE',
                    timezone: 'UTC',
                },
            ],
            entries: [
                {
                    type: 'PAGES_READ',
                    value: 75,
                },
                {
                    type: 'PAGES_READ',
                    value: 50,
                },
                {
                    type: 'BOOK_COMPLETION',
                    value: 1,
                },
                {
                    type: 'CHALLENGE_COMPLETION',
                    value: 1,
                },
            ],
            invitations: [
                {
                    acceptedAt: new Date('2026-04-10T12:00:00Z'),
                    expiresAt: new Date('2026-04-12T12:00:00Z'),
                    revokedAt: null,
                    status: 'ACCEPTED',
                },
                {
                    acceptedAt: null,
                    expiresAt: new Date('2026-05-14T12:00:00Z'),
                    revokedAt: null,
                    status: 'PENDING',
                },
                {
                    acceptedAt: null,
                    expiresAt: new Date('2026-05-01T12:00:00Z'),
                    revokedAt: null,
                    status: 'PENDING',
                },
                {
                    acceptedAt: null,
                    expiresAt: new Date('2026-05-14T12:00:00Z'),
                    revokedAt: new Date('2026-05-02T12:00:00Z'),
                    status: 'REVOKED',
                },
            ],
            moderationEntries: [
                {
                    activityDate: new Date('2026-05-08T12:00:00Z'),
                    bookAuthor: 'Lois Lowry',
                    bookTitle: 'The Giver',
                    challengeCompletion: null,
                    createdAt: new Date('2026-05-08T12:05:00Z'),
                    id: 'entry-1',
                    notes: 'Original note',
                    campaignParticipant: {
                        user: {
                            email: 'leader@example.com',
                            name: 'Morgan',
                        },
                    },
                    type: 'PAGES_READ',
                    value: 42,
                },
                {
                    activityDate: new Date('2026-05-07T12:00:00Z'),
                    bookAuthor: null,
                    bookTitle: null,
                    challengeCompletion: {
                        challenge: {
                            title: 'Friend recommendation',
                        },
                    },
                    createdAt: new Date('2026-05-07T12:05:00Z'),
                    id: 'entry-2',
                    notes: 'Needs review',
                    campaignParticipant: {
                        user: {
                            email: 'reader@example.com',
                            name: 'Avery',
                        },
                    },
                    type: 'CHALLENGE_COMPLETION',
                    value: 1,
                },
            ],
            now: new Date('2026-05-08T12:00:00Z'),
            participants: [
                {
                    createdAt: new Date('2026-04-01T12:00:00Z'),
                    id: 'participant-1',
                    joinedAt: new Date('2026-04-01T12:00:00Z'),
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
                    joinedAt: new Date('2026-04-02T12:00:00Z'),
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
                    joinedAt: new Date('2026-04-03T12:00:00Z'),
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
            selectedReadingEntryId: null,
            selectedCampaignId: null,
        })

        expect(viewModel.hasQuest).toBe(true)
        expect(viewModel.campaignName).toBe('Spring Story Sprint')
        expect(viewModel.campaignStatusLabel).toBe('Active')
        expect(viewModel.campaignOptions[0]).toMatchObject({
            id: 'campaign-active',
            isSelected: true,
            statusLabel: 'Active',
        })
        expect(viewModel.summaryCards[1]).toMatchObject({
            label: 'Accepted invites',
            value: '1',
            detail: '2 pending • 0 expired • 1 revoked',
        })
        expect(viewModel.summaryCards[4]).toMatchObject({
            label: 'Total points awarded',
            value: '1,318.25 points',
        })
        expect(viewModel.entryBreakdownRows).toEqual([
            {
                entriesLabel: '1 entry',
                key: 'BOOK_COMPLETION',
                label: 'Book completions',
                shareLabel: '25% of logged entries',
                totalLabel: '1 book',
            },
            {
                entriesLabel: '2 entries',
                key: 'PAGES_READ',
                label: 'Pages logged',
                shareLabel: '50% of logged entries',
                totalLabel: '125 pages',
            },
            {
                entriesLabel: '0 entries',
                key: 'AUDIOBOOK_MINUTES',
                label: 'Audiobook entries',
                shareLabel: '0% of logged entries',
                totalLabel: '0 audiobook minutes',
            },
            {
                entriesLabel: '1 entry',
                key: 'CHALLENGE_COMPLETION',
                label: 'Challenge submissions',
                shareLabel: '25% of logged entries',
                totalLabel: '1 completion',
            },
        ])
        expect(viewModel.participantRows.map((row) => row.rankLabel)).toEqual([
            '#1',
            '#1',
            '#3',
        ])
        expect(viewModel.participantRows[0]).toMatchObject({
            pointsLabel: '450 points',
            readerLabel: 'Morgan',
            totalsLabel: '350 pages • 120 minutes • 4 books • 2 challenges',
        })
        expect(viewModel.selectedModerationEntry).toMatchObject({
            activityDate: '2026-05-08',
            entryId: 'entry-1',
            isEditable: true,
            participantLabel: 'Morgan',
            type: 'PAGES_READ',
            value: '42',
        })
        expect(viewModel.moderationRows[1]).toMatchObject({
            editHref: null,
            isEditable: false,
            typeLabel: 'Challenge: Friend recommendation',
        })
        expect(viewModel.auditRows[0]).toMatchObject({
            actionLabel: 'Invitation created',
            actorLabel: 'Alex Admin',
            detailLabel: 'Invitation activity for reader@example.com.',
        })
        expect(viewModel.auditRows[1]).toMatchObject({
            actionLabel: 'Entry corrected',
            detailLabel: 'Morgan correction saved for 24 pages.',
        })
    })

    it('returns the empty model when no campaigns exist', () => {
        const viewModel = buildAdminReportsViewModel({
            auditLogs: [],
            availableQuests: [],
            entries: [],
            invitations: [],
            moderationEntries: [],
            now: new Date('2026-05-08T12:00:00Z'),
            participants: [],
            selectedReadingEntryId: null,
            selectedCampaignId: null,
        })

        expect(viewModel).toEqual(defaultAdminReportsViewModel)
    })
})

describe('admin reports csv export', () => {
    it('builds a csv export with tie-aware ranks and escaped values', () => {
        const csv = buildAdminCampaignResultsCsv({
            participants: [
                {
                    createdAt: new Date('2026-04-01T12:00:00Z'),
                    id: 'participant-1',
                    joinedAt: new Date('2026-04-01T12:00:00Z'),
                    lastActivityAt: new Date('2026-05-07T12:00:00Z'),
                    totalAudiobookMinutes: 120,
                    totalBooks: 4,
                    totalChallenges: 2,
                    totalPages: 350,
                    totalPoints: { toString: () => '450' },
                    user: {
                        email: 'leader@example.com',
                        name: 'Morgan, Reader',
                    },
                },
                {
                    createdAt: new Date('2026-04-02T12:00:00Z'),
                    id: 'participant-2',
                    joinedAt: new Date('2026-04-02T12:00:00Z'),
                    lastActivityAt: new Date('2026-05-06T12:00:00Z'),
                    totalAudiobookMinutes: 120,
                    totalBooks: 4,
                    totalChallenges: 2,
                    totalPages: 350,
                    totalPoints: { toString: () => '450' },
                    user: {
                        email: 'reader@example.com',
                        name: 'Avery "Ace"',
                    },
                },
            ],
            campaign: {
                createdAt: new Date('2026-04-01T12:00:00Z'),
                endAt: new Date('2026-05-20T23:00:00Z'),
                id: 'campaign-active',
                name: 'Spring Story Sprint',
                startAt: new Date('2026-04-20T12:00:00Z'),
                status: 'ACTIVE',
                timezone: 'UTC',
            },
        })

        expect(csv.split('\n')[0]).toBe(
            'campaign_name,campaign_status,campaign_timezone,campaign_start_at,campaign_end_at,rank,reader_name,reader_email,total_points,total_pages,total_audiobook_minutes,total_books,total_challenges,joined_at,last_activity_at'
        )
        expect(csv).toContain(
            'Spring Story Sprint,Active,UTC,2026-04-20T12:00:00.000Z,2026-05-20T23:00:00.000Z,1,"Morgan, Reader",leader@example.com,450,350,120,4,2,2026-04-01T12:00:00.000Z,2026-05-07T12:00:00.000Z'
        )
        expect(csv).toContain(
            'Spring Story Sprint,Active,UTC,2026-04-20T12:00:00.000Z,2026-05-20T23:00:00.000Z,1,"Avery ""Ace""",reader@example.com,450,350,120,4,2,2026-04-02T12:00:00.000Z,2026-05-06T12:00:00.000Z'
        )
    })
})
