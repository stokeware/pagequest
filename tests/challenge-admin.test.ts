import { describe, expect, it } from 'vitest'

import {
    assertChallengeCanDelete,
    ChallengeAdminError,
    describeChallengeReviewRequirement,
    getChallengeAvailabilityLabel,
    getChallengeReviewLabel,
    parseChallengeFormValues,
    prepareChallengeCreateValues,
    prepareChallengeUpdateValues,
} from '@/lib/challenge-admin'

function buildChallengeFormData(overrides?: Record<string, string>) {
    const formData = new FormData()
    const fields = {
        availability: 'REPEATABLE',
        category: 'Genre prompt',
        description: 'Read a biography or memoir this week.',
        evidencePrompt: 'Share the title and why it matched the prompt.',
        pointValue: '15',
        title: 'Biography bonus',
        ...overrides,
    }

    Object.entries(fields).forEach(([key, value]) => {
        formData.set(key, value)
    })

    formData.set('requiresReview', 'on')

    return formData
}

describe('challenge admin helpers', () => {
    it('parses challenge form values and normalizes optional fields', () => {
        const formData = buildChallengeFormData({
            category: '  ',
            description: '   ',
            pointValue: '',
            title: '  Biography bonus  ',
        })

        const values = parseChallengeFormValues(formData)

        expect(values.title).toBe('Biography bonus')
        expect(values.description).toBeNull()
        expect(values.category).toBeNull()
        expect(values.pointValue).toBeNull()
        expect(values.requiresReview).toBe(true)
        expect(values.availability).toBe('REPEATABLE')
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

    it('rejects unsupported availability values', () => {
        expect(() =>
            parseChallengeFormValues(
                buildChallengeFormData({
                    availability: 'DAILY',
                })
            )
        ).toThrowError(
            expect.objectContaining<Partial<ChallengeAdminError>>({
                code: 'invalid-availability',
            })
        )
    })

    it('prepares create and update values without reshaping fields', () => {
        const formValues = parseChallengeFormValues(buildChallengeFormData())

        expect(prepareChallengeCreateValues(formValues)).toEqual(formValues)
        expect(prepareChallengeUpdateValues(formValues)).toEqual(formValues)
    })

    it('describes availability and review labels for the admin surface', () => {
        expect(getChallengeAvailabilityLabel('ONE_TIME')).toBe('One-time')
        expect(getChallengeReviewLabel(true)).toBe('Manual review')
        expect(describeChallengeReviewRequirement(false)).toContain(
            'credited immediately'
        )
    })

    it('blocks deletion when a challenge already has usage', () => {
        expect(() =>
            assertChallengeCanDelete({
                challengeCompletions: 0,
                campaignChallenges: 1,
            })
        ).toThrowError(
            expect.objectContaining<Partial<ChallengeAdminError>>({
                code: 'challenge-in-use',
            })
        )

        expect(() =>
            assertChallengeCanDelete({
                challengeCompletions: 0,
                campaignChallenges: 0,
            })
        ).not.toThrow()
    })
})
