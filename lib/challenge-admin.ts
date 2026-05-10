import { Prisma } from '@prisma/client'

export class ChallengeAdminError extends Error {
    code: string

    constructor(code: string, message: string) {
        super(message)
        this.code = code
        this.name = 'ChallengeAdminError'
    }
}

export type ChallengeFormValues = {
    pageMinuteMultiplier: Prisma.Decimal
    pointValue: Prisma.Decimal
    title: string
}

export type ChallengeWriteValues = ChallengeFormValues

export type ChallengeUsageSnapshot = {
    campaignChallenges: number
    challengeCompletions: number
}

export function parseChallengeFormValues(
    formData: FormData
): ChallengeFormValues {
    return {
        pageMinuteMultiplier:
            getOptionalDecimal(
                formData,
                'pageMinuteMultiplier',
                'invalid-page-minute-multiplier'
            ) ?? new Prisma.Decimal(0),
        pointValue:
            getOptionalDecimal(formData, 'pointValue', 'invalid-point-value') ??
            new Prisma.Decimal(0),
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

export function assertChallengeCanDelete(snapshot: ChallengeUsageSnapshot) {
    if (snapshot.campaignChallenges > 0 || snapshot.challengeCompletions > 0) {
        throw new ChallengeAdminError(
            'challenge-in-use',
            'Challenges with historical completions cannot be deleted.'
        )
    }
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
