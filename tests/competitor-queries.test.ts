import { describe, expect, it } from 'vitest'

import {
    selectPrimaryCompetitorParticipant,
    selectVisibleCompetitorCampaign,
} from '@/lib/competitor-queries'

type CompetitorParticipantFixture = {
    campaign: {
        endAt: Date
        startAt: Date
        status: 'ACTIVE' | 'COMPLETED' | 'SCHEDULED'
    }
    id: string
}

type CompetitorCampaignFixture = CompetitorParticipantFixture['campaign'] & {
    id: string
}

function buildParticipant(
    id: string,
    status: CompetitorParticipantFixture['campaign']['status'],
    startAt: string,
    endAt = '2026-05-20T12:00:00Z'
): CompetitorParticipantFixture {
    return {
        campaign: {
            endAt: new Date(endAt),
            startAt: new Date(startAt),
            status,
        },
        id,
    }
}

function buildCampaign(
    id: string,
    status: CompetitorCampaignFixture['status'],
    startAt: string,
    endAt = '2026-05-20T12:00:00Z'
): CompetitorCampaignFixture {
    return {
        endAt: new Date(endAt),
        id,
        startAt: new Date(startAt),
        status,
    }
}

describe('selectPrimaryCompetitorParticipant', () => {
    it('prefers the active campaign when one is available', () => {
        const selected = selectPrimaryCompetitorParticipant(
            [
                buildParticipant(
                    'scheduled',
                    'SCHEDULED',
                    '2026-06-01T12:00:00Z'
                ),
                buildParticipant('active', 'ACTIVE', '2026-05-01T12:00:00Z'),
                buildParticipant(
                    'completed',
                    'COMPLETED',
                    '2026-04-01T12:00:00Z'
                ),
            ],
            new Date('2026-05-11T12:00:00Z')
        )

        expect(selected?.id).toBe('active')
    })

    it('chooses the closest future campaign when none are active', () => {
        const selected = selectPrimaryCompetitorParticipant(
            [
                buildParticipant(
                    'later-scheduled',
                    'SCHEDULED',
                    '2026-07-01T12:00:00Z'
                ),
                buildParticipant(
                    'closest-scheduled',
                    'SCHEDULED',
                    '2026-05-15T12:00:00Z'
                ),
                buildParticipant(
                    'completed',
                    'COMPLETED',
                    '2026-04-01T12:00:00Z'
                ),
            ],
            new Date('2026-05-11T12:00:00Z')
        )

        expect(selected?.id).toBe('closest-scheduled')
    })

    it('falls back to the most recent past campaign when no future or active campaign exists', () => {
        const selected = selectPrimaryCompetitorParticipant(
            [
                buildParticipant(
                    'older-completed',
                    'COMPLETED',
                    '2026-02-01T12:00:00Z',
                    '2026-03-01T12:00:00Z'
                ),
                buildParticipant(
                    'latest-completed',
                    'COMPLETED',
                    '2026-04-01T12:00:00Z',
                    '2026-04-25T12:00:00Z'
                ),
                buildParticipant(
                    'oldest-completed',
                    'COMPLETED',
                    '2026-01-01T12:00:00Z',
                    '2026-01-31T12:00:00Z'
                ),
            ],
            new Date('2026-05-11T12:00:00Z')
        )

        expect(selected?.id).toBe('latest-completed')
    })

    it('returns null when there are no campaign participants', () => {
        const selected = selectPrimaryCompetitorParticipant([], new Date())

        expect(selected).toBeNull()
    })
})

describe('selectVisibleCompetitorCampaign', () => {
    it('chooses the nearest upcoming campaign when none are active', () => {
        const selected = selectVisibleCompetitorCampaign(
            [
                buildCampaign(
                    'later-scheduled',
                    'SCHEDULED',
                    '2026-07-01T12:00:00Z'
                ),
                buildCampaign(
                    'closest-scheduled',
                    'SCHEDULED',
                    '2026-05-15T12:00:00Z'
                ),
                buildCampaign(
                    'completed',
                    'COMPLETED',
                    '2026-04-01T12:00:00Z',
                    '2026-04-20T12:00:00Z'
                ),
            ],
            new Date('2026-05-11T12:00:00Z')
        )

        expect(selected?.id).toBe('closest-scheduled')
    })

    it('falls back to the most recently ended campaign', () => {
        const selected = selectVisibleCompetitorCampaign(
            [
                buildCampaign(
                    'late-start-earlier-end',
                    'COMPLETED',
                    '2026-04-20T12:00:00Z',
                    '2026-04-22T12:00:00Z'
                ),
                buildCampaign(
                    'earlier-start-latest-end',
                    'COMPLETED',
                    '2026-04-01T12:00:00Z',
                    '2026-04-30T12:00:00Z'
                ),
            ],
            new Date('2026-05-11T12:00:00Z')
        )

        expect(selected?.id).toBe('earlier-start-latest-end')
    })
})
