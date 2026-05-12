import { describe, expect, it } from 'vitest'

import {
    buildPersonalGoalChallengeTitle,
    filterChallengesForCompetitorView,
    personalGoalTemplateTitle,
} from '@/lib/challenge-config'

describe('challenge config helpers', () => {
    it('builds a unique stored title for personal goal instances', () => {
        expect(
            buildPersonalGoalChallengeTitle('Alice Redwood', 'participant-1')
        ).toBe("Alice Redwood's Personal Goal (participant-1)")
    })

    it('does not reuse the personal goal template title for instances', () => {
        expect(
            buildPersonalGoalChallengeTitle('Alice Redwood', 'participant-1')
        ).not.toBe(personalGoalTemplateTitle)
    })

    it('shows only the current participant personal goal and hides their own recommendation', () => {
        const visibleChallenges = filterChallengesForCompetitorView(
            [
                {
                    id: 'admin-1',
                    isActive: true,
                    kind: 'ADMIN',
                    ownerParticipantId: null,
                    title: 'Library visit',
                },
                {
                    id: 'goal-mine',
                    isActive: true,
                    kind: 'PERSONAL_GOAL_INSTANCE',
                    ownerParticipantId: 'participant-1',
                    title: "Alice's Personal Goal (participant-1)",
                },
                {
                    id: 'goal-other',
                    isActive: true,
                    kind: 'PERSONAL_GOAL_INSTANCE',
                    ownerParticipantId: 'participant-2',
                    title: "Bob's Personal Goal (participant-2)",
                },
                {
                    id: 'recommendation-1',
                    isActive: true,
                    kind: 'RECOMMENDATION_INSTANCE',
                    ownerParticipantId: 'participant-1',
                    title: "Alice's Recommendation: Dune",
                },
                {
                    id: 'recommendation-2',
                    isActive: true,
                    kind: 'RECOMMENDATION_INSTANCE',
                    ownerParticipantId: 'participant-2',
                    title: "Bob's Recommendation: Dune",
                },
                {
                    id: 'inactive-admin',
                    isActive: false,
                    kind: 'ADMIN',
                    ownerParticipantId: null,
                    title: 'Archived challenge',
                },
            ],
            'participant-1'
        )

        expect(visibleChallenges.map((challenge) => challenge.id)).toEqual([
            'admin-1',
            'goal-mine',
            'recommendation-2',
        ])
    })

    it('hides personal goal instances when no campaign participant is linked', () => {
        const visibleChallenges = filterChallengesForCompetitorView(
            [
                {
                    id: 'goal-mine',
                    isActive: true,
                    kind: 'PERSONAL_GOAL_INSTANCE',
                    ownerParticipantId: 'participant-1',
                    title: "Alice's Personal Goal (participant-1)",
                },
                {
                    id: 'admin-1',
                    isActive: true,
                    kind: 'ADMIN',
                    ownerParticipantId: null,
                    title: 'Library visit',
                },
            ],
            null
        )

        expect(visibleChallenges.map((challenge) => challenge.id)).toEqual([
            'admin-1',
        ])
    })
})
