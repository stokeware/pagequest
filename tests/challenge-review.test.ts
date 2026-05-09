import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import {
    assertChallengeCompletionAllowed,
    ChallengeReviewError,
    getChallengeReviewStateLabel,
    parseChallengeReviewFormValues,
    prepareAutoApprovedChallengeCompletionValues,
    prepareChallengeReviewDecisionValues,
    resolveChallengeCompletionDefaultPoints,
} from '@/lib/challenge-review'

function buildChallengeReviewFormData(overrides?: Record<string, string>) {
    const formData = new FormData()
    const fields = {
        awardedPointsOverride: '55',
        challengeCompletionId: 'completion-1',
        decision: 'approve',
        reviewNotes: 'Verified with the submitted evidence.',
        ...overrides,
    }

    Object.entries(fields).forEach(([key, value]) => {
        formData.set(key, value)
    })

    return formData
}

describe('challenge review helpers', () => {
    it('parses review form values and allows blank point overrides', () => {
        const values = parseChallengeReviewFormValues(
            buildChallengeReviewFormData({
                awardedPointsOverride: '',
                reviewNotes: '  ',
            })
        )

        expect(values).toEqual({
            awardedPointsOverride: null,
            challengeCompletionId: 'completion-1',
            decision: 'approve',
            reviewNotes: null,
        })
    })

    it('rejects invalid review decisions and negative award overrides', () => {
        expect(() =>
            parseChallengeReviewFormValues(
                buildChallengeReviewFormData({
                    decision: 'maybe',
                })
            )
        ).toThrowError(
            expect.objectContaining<Partial<ChallengeReviewError>>({
                code: 'invalid-review-decision',
            })
        )

        expect(() =>
            parseChallengeReviewFormValues(
                buildChallengeReviewFormData({
                    awardedPointsOverride: '-1',
                })
            )
        ).toThrowError(
            expect.objectContaining<Partial<ChallengeReviewError>>({
                code: 'invalid-awarded-points',
            })
        )
    })

    it('prefers quest overrides, then challenge points, then quest defaults', () => {
        expect(
            resolveChallengeCompletionDefaultPoints({
                challengePointValue: new Prisma.Decimal('40'),
                questChallengePointValueOverride: new Prisma.Decimal('60'),
                questPointsPerChallengeCompletion: new Prisma.Decimal('20'),
            }).toString()
        ).toBe('60')

        expect(
            resolveChallengeCompletionDefaultPoints({
                challengePointValue: new Prisma.Decimal('40'),
                questChallengePointValueOverride: null,
                questPointsPerChallengeCompletion: new Prisma.Decimal('20'),
            }).toString()
        ).toBe('40')

        expect(
            resolveChallengeCompletionDefaultPoints({
                challengePointValue: null,
                questChallengePointValueOverride: null,
                questPointsPerChallengeCompletion: new Prisma.Decimal('20'),
            }).toString()
        ).toBe('20')
    })

    it('prepares manual approval and rejection values', () => {
        expect(
            prepareChallengeReviewDecisionValues({
                decision: 'approve',
                defaultAwardedPoints: new Prisma.Decimal('40'),
                now: new Date('2026-05-08T12:00:00.000Z'),
                awardedPointsOverride: new Prisma.Decimal('55'),
                reviewerUserId: 'admin-1',
                reviewNotes: 'Approved with bonus points.',
            })
        ).toMatchObject({
            awardedPoints: new Prisma.Decimal('55'),
            reviewNotes: 'Approved with bonus points.',
            reviewState: 'APPROVED',
            reviewedByUserId: 'admin-1',
        })

        expect(
            prepareChallengeReviewDecisionValues({
                decision: 'reject',
                defaultAwardedPoints: new Prisma.Decimal('40'),
                now: new Date('2026-05-08T12:00:00.000Z'),
                awardedPointsOverride: null,
                reviewerUserId: 'admin-1',
                reviewNotes: 'Evidence did not match the challenge.',
            })
        ).toMatchObject({
            awardedPoints: new Prisma.Decimal(0),
            reviewNotes: 'Evidence did not match the challenge.',
            reviewState: 'REJECTED',
            reviewedByUserId: 'admin-1',
        })
    })

    it('prepares auto-approved completion values and review labels', () => {
        expect(
            prepareAutoApprovedChallengeCompletionValues({
                awardedPoints: new Prisma.Decimal('40'),
                now: new Date('2026-05-08T12:00:00.000Z'),
            })
        ).toMatchObject({
            awardedPoints: new Prisma.Decimal('40'),
            reviewNotes: null,
            reviewState: 'AUTO_APPROVED',
            reviewedByUserId: null,
        })

        expect(getChallengeReviewStateLabel('APPROVED')).toBe('Approved')
        expect(getChallengeReviewStateLabel('AUTO_APPROVED')).toBe(
            'Auto-approved'
        )
        expect(getChallengeReviewStateLabel('REJECTED')).toBe('Rejected')
    })

    it('blocks duplicate completions for one-time challenges unless prior submissions were rejected', () => {
        expect(() =>
            assertChallengeCompletionAllowed({
                availability: 'ONE_TIME',
                existingReviewStates: ['APPROVED'],
            })
        ).toThrowError(
            expect.objectContaining<Partial<ChallengeReviewError>>({
                code: 'duplicate-one-time-challenge-completion',
            })
        )

        expect(() =>
            assertChallengeCompletionAllowed({
                availability: 'ONE_TIME',
                existingReviewStates: ['PENDING'],
            })
        ).toThrowError(
            expect.objectContaining<Partial<ChallengeReviewError>>({
                code: 'duplicate-one-time-challenge-completion',
            })
        )

        expect(() =>
            assertChallengeCompletionAllowed({
                availability: 'ONE_TIME',
                existingReviewStates: ['REJECTED'],
            })
        ).not.toThrow()
    })

    it('allows duplicate completions for repeatable challenges', () => {
        expect(() =>
            assertChallengeCompletionAllowed({
                availability: 'REPEATABLE',
                existingReviewStates: ['APPROVED', 'PENDING'],
            })
        ).not.toThrow()
    })
})
