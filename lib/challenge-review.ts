import { Prisma, type ChallengeReviewState } from '@prisma/client'

const zeroDecimal = new Prisma.Decimal(0)

export class ChallengeReviewError extends Error {
    code: string

    constructor(code: string, message: string) {
        super(message)
        this.code = code
        this.name = 'ChallengeReviewError'
    }
}

export type ChallengeReviewDecision = 'approve' | 'reject'

export type ChallengeReviewFormValues = {
    awardedPointsOverride: Prisma.Decimal | null
    challengeCompletionId: string
    decision: ChallengeReviewDecision
    reviewNotes: string | null
}

export type ChallengeReviewWriteValues = {
    awardedPoints: Prisma.Decimal
    reviewNotes: string | null
    reviewState: ChallengeReviewState
    reviewedAt: Date
    reviewedByUserId: string | null
}

export type ChallengeCompletionDuplicateCheck = {
    existingReviewStates: ChallengeReviewState[]
}

const challengeReviewStateLabels: Record<ChallengeReviewState, string> = {
    APPROVED: 'Approved',
    AUTO_APPROVED: 'Auto-approved',
    PENDING: 'Pending',
    REJECTED: 'Rejected',
}

export function parseChallengeReviewFormValues(
    formData: FormData
): ChallengeReviewFormValues {
    return {
        awardedPointsOverride: getOptionalDecimal(
            formData,
            'awardedPointsOverride',
            'invalid-awarded-points'
        ),
        challengeCompletionId: getRequiredString(
            formData,
            'challengeCompletionId',
            'missing-challenge-completion'
        ),
        decision: getChallengeReviewDecision(formData),
        reviewNotes: getOptionalString(formData, 'reviewNotes'),
    }
}

export function resolveChallengeCompletionDefaultPoints({
    campaignChallengePointValueOverride,
    campaignPointsPerChallengeCompletion,
    challengePointValue,
}: {
    campaignChallengePointValueOverride?:
        | Prisma.Decimal
        | number
        | string
        | null
    campaignPointsPerChallengeCompletion?:
        | Prisma.Decimal
        | number
        | string
        | null
    challengePointValue: Prisma.Decimal | number | string
}) {
    if (
        campaignChallengePointValueOverride !== null &&
        campaignChallengePointValueOverride !== undefined
    ) {
        return toDecimal(campaignChallengePointValueOverride)
    }

    const resolvedChallengePointValue = toDecimal(challengePointValue)

    if (
        !resolvedChallengePointValue.isZero() ||
        campaignPointsPerChallengeCompletion === null ||
        campaignPointsPerChallengeCompletion === undefined
    ) {
        return resolvedChallengePointValue
    }

    return toDecimal(campaignPointsPerChallengeCompletion)
}

export function prepareChallengeReviewDecisionValues({
    decision,
    defaultAwardedPoints,
    now,
    awardedPointsOverride,
    reviewerUserId,
    reviewNotes,
}: {
    decision: ChallengeReviewDecision
    defaultAwardedPoints: Prisma.Decimal | number | string
    now: Date
    awardedPointsOverride: Prisma.Decimal | null
    reviewerUserId: string
    reviewNotes: string | null
}): ChallengeReviewWriteValues {
    if (!reviewerUserId.trim()) {
        throw new ChallengeReviewError(
            'missing-reviewer',
            'A reviewer user id is required for manual decisions.'
        )
    }

    if (decision === 'approve') {
        return {
            awardedPoints:
                awardedPointsOverride ?? toDecimal(defaultAwardedPoints),
            reviewNotes,
            reviewState: 'APPROVED',
            reviewedAt: now,
            reviewedByUserId: reviewerUserId,
        }
    }

    return {
        awardedPoints: zeroDecimal,
        reviewNotes,
        reviewState: 'REJECTED',
        reviewedAt: now,
        reviewedByUserId: reviewerUserId,
    }
}

export function prepareAutoApprovedChallengeCompletionValues({
    awardedPoints,
    now,
}: {
    awardedPoints: Prisma.Decimal | number | string
    now: Date
}) {
    return {
        awardedPoints: toDecimal(awardedPoints),
        reviewNotes: null,
        reviewState: 'AUTO_APPROVED' as const,
        reviewedAt: now,
        reviewedByUserId: null,
    }
}

export function getChallengeReviewStateLabel(state: ChallengeReviewState) {
    return challengeReviewStateLabels[state]
}

export function assertChallengeCompletionAllowed({
    existingReviewStates,
}: ChallengeCompletionDuplicateCheck) {
    const hasBlockingCompletion = existingReviewStates.some(
        (state) => state !== 'REJECTED'
    )

    if (hasBlockingCompletion) {
        throw new ChallengeReviewError(
            'duplicate-challenge-completion',
            'Challenges cannot be completed more than once unless the earlier submission was rejected.'
        )
    }
}

function getChallengeReviewDecision(formData: FormData) {
    const decision = getOptionalString(formData, 'decision')

    if (decision === 'approve' || decision === 'reject') {
        return decision
    }

    throw new ChallengeReviewError(
        'invalid-review-decision',
        'Challenge review decisions must be approve or reject.'
    )
}

function getRequiredString(
    formData: FormData,
    fieldName: string,
    errorCode: string
) {
    const value = getOptionalString(formData, fieldName)

    if (!value) {
        throw new ChallengeReviewError(errorCode, `${fieldName} is required.`)
    }

    return value
}

function getOptionalString(formData: FormData, fieldName: string) {
    const value = formData.get(fieldName)

    if (typeof value !== 'string') {
        return null
    }

    const trimmedValue = value.trim()

    return trimmedValue.length > 0 ? trimmedValue : null
}

function getOptionalDecimal(
    formData: FormData,
    fieldName: string,
    errorCode: string
) {
    const value = getOptionalString(formData, fieldName)

    if (!value) {
        return null
    }

    const decimalValue = toDecimal(value, errorCode)

    if (decimalValue.isNegative()) {
        throw new ChallengeReviewError(
            errorCode,
            `${fieldName} must be zero or greater.`
        )
    }

    return decimalValue
}

function toDecimal(
    value: Prisma.Decimal | number | string,
    errorCode?: string
) {
    try {
        return value instanceof Prisma.Decimal
            ? value
            : new Prisma.Decimal(value)
    } catch {
        throw new ChallengeReviewError(
            errorCode ?? 'invalid-decimal',
            'A numeric value is required.'
        )
    }
}
