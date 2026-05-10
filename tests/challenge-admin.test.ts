import { describe, expect, it } from 'vitest'

import {
    assertChallengeCanDelete,
    ChallengeAdminError,
    parseChallengeFormValues,
    prepareChallengeCreateValues,
    prepareChallengeUpdateValues,
} from '@/lib/challenge-admin'

function buildChallengeFormData(overrides?: Record<string, string>) {
    const formData = new FormData()
    const fields = {
        pageMinuteMultiplier: '0',
        pointValue: '15',
        title: 'Biography bonus',
        ...overrides,
    }

    Object.entries(fields).forEach(([key, value]) => {
        formData.set(key, value)
    })
    return formData
}

describe('challenge admin helpers', () => {
    it('parses challenge form values and normalizes optional fields', () => {
        const formData = buildChallengeFormData({
            pointValue: '',
            title: '  Biography bonus  ',
        })

        const values = parseChallengeFormValues(formData)

        expect(values.title).toBe('Biography bonus')
        expect(values.pointValue.toString()).toBe('0')
        expect(values.pageMinuteMultiplier.toString()).toBe('0')
    })

    it('rejects negative point values', () => {
        expect(() =>
            parseChallengeFormValues(
                buildChallengeFormData({
                    pointValue: '-1',
                })
            )
        ).toThrowError(
            expect.objectContaining<Partial<ChallengeAdminError>>({
                code: 'invalid-point-value',
            })
        )
    })

    it('prepares create and update values without reshaping fields', () => {
        const formValues = parseChallengeFormValues(buildChallengeFormData())

        expect(prepareChallengeCreateValues(formValues)).toEqual(formValues)
        expect(prepareChallengeUpdateValues(formValues)).toEqual(formValues)
    })

    it('blocks deletion when a challenge already has usage', () => {
        expect(() =>
            assertChallengeCanDelete({
                challengeCompletions: 1,
            })
        ).toThrowError(
            expect.objectContaining<Partial<ChallengeAdminError>>({
                code: 'challenge-in-use',
            })
        )

        expect(() =>
            assertChallengeCanDelete({
                challengeCompletions: 0,
            })
        ).not.toThrow()
    })
})
