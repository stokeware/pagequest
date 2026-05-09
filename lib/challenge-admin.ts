import { Prisma, type ChallengeAvailability } from '@prisma/client'

export class ChallengeAdminError extends Error {
    code: string

    constructor(code: string, message: string) {
        super(message)
        this.code = code
        this.name = 'ChallengeAdminError'
    }
}

export type ChallengeFormValues = {
    availability: ChallengeAvailability
    category: string | null
    description: string | null
    evidencePrompt: string | null
    pointValue: Prisma.Decimal | null
    requiresReview: boolean
    title: string
}

export type ChallengeWriteValues = ChallengeFormValues

export type ChallengeUsageSnapshot = {
    challengeCompletions: number
    questChallenges: number
}

const challengeAvailabilityLabels: Record<ChallengeAvailability, string> = {
    ONE_TIME: 'One-time',
    REPEATABLE: 'Repeatable',
}

const oneTimeAvailability = 'ONE_TIME' satisfies ChallengeAvailability
const repeatableAvailability = 'REPEATABLE' satisfies ChallengeAvailability

export function parseChallengeFormValues(
    formData: FormData
): ChallengeFormValues {
    return {
        availability: getChallengeAvailability(formData),
        category: getOptionalString(formData, 'category'),
        description: getOptionalString(formData, 'description'),
        evidencePrompt: getOptionalString(formData, 'evidencePrompt'),
        pointValue: getOptionalDecimal(
            formData,
            'pointValue',
            'invalid-point-value'
        ),
        requiresReview: getBooleanField(formData, 'requiresReview'),
        title: getRequiredString(formData, 'title', 'missing-title'),
    }
}

export function prepareChallengeCreateValues(
    formValues: ChallengeFormValues
): ChallengeWriteValues {
    return formValues
}

export function prepareChallengeUpdateValues(
    formValues: ChallengeFormValues
): ChallengeWriteValues {
    return formValues
}

export function getChallengeAvailabilityLabel(
    availability: ChallengeAvailability
) {
    return challengeAvailabilityLabels[availability]
}

export function getChallengeReviewLabel(requiresReview: boolean) {
    return requiresReview ? 'Manual review' : 'Auto-approved'
}

export function describeChallengeReviewRequirement(requiresReview: boolean) {
    return requiresReview
        ? 'Submissions stay pending until an administrator approves or rejects them.'
        : 'Submissions can be credited immediately without an admin review step.'
}

export function assertChallengeCanDelete(snapshot: ChallengeUsageSnapshot) {
    if (snapshot.questChallenges > 0 || snapshot.challengeCompletions > 0) {
        throw new ChallengeAdminError(
            'challenge-in-use',
            'Challenges linked to quests or historical completions cannot be deleted.'
        )
    }
}

function getChallengeAvailability(formData: FormData) {
    const value = getOptionalString(formData, 'availability')

    if (!value) {
        return oneTimeAvailability
    }

    if (value !== oneTimeAvailability && value !== repeatableAvailability) {
        throw new ChallengeAdminError(
            'invalid-availability',
            'Challenge availability must be one-time or repeatable.'
        )
    }

    return value
}

function getRequiredString(
    formData: FormData,
    fieldName: string,
    errorCode: string
) {
    const value = getOptionalString(formData, fieldName)

    if (!value) {
        throw new ChallengeAdminError(errorCode, `${fieldName} is required.`)
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
        throw new ChallengeAdminError(
            errorCode,
            `${fieldName} must be zero or greater.`
        )
    }

    return decimalValue
}

function getBooleanField(formData: FormData, fieldName: string) {
    return formData.has(fieldName)
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
        throw new ChallengeAdminError(
            errorCode ?? 'invalid-decimal',
            'A numeric value is required.'
        )
    }
}
