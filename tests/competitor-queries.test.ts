import { describe, expect, it } from 'vitest'

import { selectPrimaryCompetitorParticipant } from '@/lib/competitor-queries'

type CompetitorParticipantFixture = {
    campaign: {
        startAt: Date
        status: 'ACTIVE' | 'COMPLETED' | 'SCHEDULED'
    }
    id: string
}

function buildParticipant(
    id: string,
    status: CompetitorParticipantFixture['campaign']['status'],
    startAt: string
): CompetitorParticipantFixture {
    return {
        campaign: {
            startAt: new Date(startAt),
            status,
        },
        id,
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
                    '2026-02-01T12:00:00Z'
                ),
                buildParticipant(
                    'latest-completed',
                    'COMPLETED',
                    '2026-04-25T12:00:00Z'
                ),
                buildParticipant(
                    'oldest-completed',
                    'COMPLETED',
                    '2026-01-01T12:00:00Z'
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
