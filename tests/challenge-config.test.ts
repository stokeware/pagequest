import { describe, expect, it } from 'vitest'

import {
    buildPersonalGoalChallengeTitle,
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
})
