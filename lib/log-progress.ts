import type { ReadingEntryType } from '@prisma/client'
import { z } from 'zod'

export type LogProgressFormValues = {
    activityDate: string
    bookAuthor: string
    bookTitle: string
    challengeId: string
    notes: string
    type: ReadingEntryType
    value: string
}

export type ReadingEntryMetadata = {
    bookAuthor: string | null
    bookTitle: string | null
}

export type LogProgressCampaignPolicy = {
    entryDeleteWindowMinutes: number | null
    entryEditWindowMinutes: number | null
    campaignEndAt: string
    campaignStartAt: string
    timezone: string
}

export type ReadingEntryWindowAccess = {
    action: 'delete' | 'edit'
    expiresAt: string | null
    isAllowed: boolean
    message: string
}

export type ReadingMetadataFieldCopy = {
    authorHint: string
    authorLabel: string
    authorPlaceholder: string
    titleHint: string
    titleLabel: string
    titlePlaceholder: string
}

type ValidateLogProgressOptions = {
    availableChallengeIds: string[]
    campaignPolicy: LogProgressCampaignPolicy | null
}

const readingEntryTypes = [
    'BOOK_COMPLETION',
    'PAGES_READ',
    'AUDIOBOOK_MINUTES',
    'CHALLENGE_COMPLETION',
] as const

const quantityLabels: Record<ReadingEntryType, string> = {
    AUDIOBOOK_MINUTES: 'a whole number of audiobook minutes',
    BOOK_COMPLETION: 'a whole number of completed books',
    CHALLENGE_COMPLETION: 'a challenge completion',
    PAGES_READ: 'a whole number of pages',
}

const logProgressFormSchema = z.object({
    activityDate: z.string().trim(),
    bookAuthor: z
        .string()
        .trim()
        .max(160, 'Author must be 160 characters or fewer.'),
    bookTitle: z
        .string()
        .trim()
        .max(160, 'Book title must be 160 characters or fewer.'),
    challengeId: z.string().trim(),
    notes: z.string().trim().max(600, 'Notes must be 600 characters or fewer.'),
    type: z.enum(readingEntryTypes),
    value: z.string().trim(),
})

export function getLogProgressFormDefaults(
    initialChallengeId = ''
): LogProgressFormValues {
    return {
        activityDate: getTodayDateInputValue(),
        bookAuthor: '',
        bookTitle: '',
        challengeId: initialChallengeId,
        notes: '',
        type: 'BOOK_COMPLETION',
        value: '1',
    }
}

export function validateLogProgressFormValues(
    values: LogProgressFormValues,
    { availableChallengeIds, campaignPolicy }: ValidateLogProgressOptions
) {
    return logProgressFormSchema
        .superRefine((candidate, context) => {
            if (!campaignPolicy) {
                context.addIssue({
                    code: 'custom',
                    message:
                        'A campaign assignment is required before you can log progress.',
                    path: ['activityDate'],
                })
            } else if (!candidate.activityDate) {
                context.addIssue({
                    code: 'custom',
                    message: 'Choose the day this reading happened.',
                    path: ['activityDate'],
                })
            } else if (!isValidDateInputValue(candidate.activityDate)) {
                context.addIssue({
                    code: 'custom',
                    message: 'Use a valid calendar date.',
                    path: ['activityDate'],
                })
            } else if (
                !isActivityDateWithinCampaignWindow(
                    candidate.activityDate,
                    campaignPolicy
                )
            ) {
                context.addIssue({
                    code: 'custom',
                    message: `Choose a date from ${getCampaignDateWindowLabel(campaignPolicy)} for this campaign.`,
                    path: ['activityDate'],
                })
            }

            if (candidate.type === 'CHALLENGE_COMPLETION') {
                if (availableChallengeIds.length === 0) {
                    context.addIssue({
                        code: 'custom',
                        message:
                            'This campaign does not have any active challenges to log yet.',
                        path: ['challengeId'],
                    })

                    return
                }

                if (!candidate.challengeId) {
                    context.addIssue({
                        code: 'custom',
                        message: 'Choose the challenge you completed.',
                        path: ['challengeId'],
                    })

                    return
                }

                if (!availableChallengeIds.includes(candidate.challengeId)) {
                    context.addIssue({
                        code: 'custom',
                        message: 'Choose a challenge from this campaign.',
                        path: ['challengeId'],
                    })
                }

                return
            }

            if (!isPositiveWholeNumber(candidate.value)) {
                context.addIssue({
                    code: 'custom',
                    message: `Enter ${quantityLabels[candidate.type]}.`,
                    path: ['value'],
                })
            }
        })
        .safeParse(values)
}

export function getCampaignDateWindowLabel(policy: LogProgressCampaignPolicy) {
    return `${getCampaignBoundaryDateValue(policy.campaignStartAt)} through ${getCampaignBoundaryDateValue(policy.campaignEndAt)}`
}

export function getReadingMetadataFieldCopy(
    type: ReadingEntryType
): ReadingMetadataFieldCopy {
    switch (type) {
        case 'BOOK_COMPLETION':
            return {
                authorHint:
                    'Optional if the finished title is obvious to your household already.',
                authorLabel: 'Author',
                authorPlaceholder: 'Frances Hodgson Burnett',
                titleHint:
                    'Optional, but it helps history views and shared recommendations feel more complete.',
                titleLabel: 'Finished title',
                titlePlaceholder: 'The Secret Garden',
            }
        case 'PAGES_READ':
            return {
                authorHint:
                    'Optional when you are tracking pages from a current read.',
                authorLabel: 'Author (optional)',
                authorPlaceholder: 'Lois Lowry',
                titleHint:
                    'Optional metadata helps attach page totals to the right book later.',
                titleLabel: 'Book title (optional)',
                titlePlaceholder: 'The Giver',
            }
        case 'AUDIOBOOK_MINUTES':
            return {
                authorHint:
                    'Optional when you are logging minutes from an audiobook in progress.',
                authorLabel: 'Author (optional)',
                authorPlaceholder: 'Kate DiCamillo',
                titleHint:
                    'Optional metadata helps history screens show which audiobook session this belonged to.',
                titleLabel: 'Audiobook title (optional)',
                titlePlaceholder: 'Because of Winn-Dixie',
            }
        case 'CHALLENGE_COMPLETION':
            return {
                authorHint: 'Challenge entries do not use book metadata.',
                authorLabel: 'Author',
                authorPlaceholder: '',
                titleHint: 'Challenge entries do not use book metadata.',
                titleLabel: 'Title',
                titlePlaceholder: '',
            }
        default:
            return assertNever(type)
    }
}

export function normalizeReadingEntryMetadata(
    values: Pick<LogProgressFormValues, 'bookAuthor' | 'bookTitle'>
): ReadingEntryMetadata {
    return {
        bookAuthor: normalizeOptionalString(values.bookAuthor),
        bookTitle: normalizeOptionalString(values.bookTitle),
    }
}

export function getReadingEntryMetadataSummary(
    metadata: ReadingEntryMetadata
): string | null {
    if (metadata.bookTitle && metadata.bookAuthor) {
        return `${metadata.bookTitle} by ${metadata.bookAuthor}`
    }

    if (metadata.bookTitle) {
        return metadata.bookTitle
    }

    if (metadata.bookAuthor) {
        return `by ${metadata.bookAuthor}`
    }

    return null
}

export function getCampaignDateWindowHint(
    policy: LogProgressCampaignPolicy | null
) {
    if (!policy) {
        return 'Campaign dates become available after your account joins a campaign.'
    }

    return `Campaign dates: ${getCampaignDateWindowLabel(policy)} (${policy.timezone}).`
}

export function getEntryWindowPolicyLabel({
    action,
    windowMinutes,
}: {
    action: 'delete' | 'edit'
    windowMinutes: number | null
}) {
    const actionLabel = action === 'edit' ? 'Edits' : 'Deletes'

    if (windowMinutes == null) {
        return `${actionLabel} remain open until the campaign policy changes.`
    }

    if (windowMinutes === 0) {
        return `${actionLabel} close immediately after an entry is created.`
    }

    return `${actionLabel} stay open for ${windowMinutes} minutes after an entry is created.`
}

export function resolveReadingEntryWindowAccess({
    action,
    createdAt,
    now = new Date(),
    windowMinutes,
}: {
    action: 'delete' | 'edit'
    createdAt: Date | string
    now?: Date | string
    windowMinutes: number | null
}): ReadingEntryWindowAccess {
    const parsedCreatedAt = toDate(createdAt)
    const parsedNow = toDate(now)

    if (windowMinutes == null) {
        return {
            action,
            expiresAt: null,
            isAllowed: true,
            message: getEntryWindowPolicyLabel({
                action,
                windowMinutes,
            }),
        }
    }

    const expiresAt = new Date(
        parsedCreatedAt.getTime() + windowMinutes * 60 * 1000
    )
    const isAllowed = parsedNow.getTime() <= expiresAt.getTime()
    const actionVerb = action === 'edit' ? 'edited' : 'deleted'

    return {
        action,
        expiresAt: expiresAt.toISOString(),
        isAllowed,
        message: isAllowed
            ? `This entry can still be ${actionVerb} until ${expiresAt.toISOString()}.`
            : `This entry can no longer be ${actionVerb}; the ${action} window closed at ${expiresAt.toISOString()}.`,
    }
}

function isPositiveWholeNumber(value: string) {
    return /^\d+$/.test(value) && Number(value) >= 1
}

function isActivityDateWithinCampaignWindow(
    activityDate: string,
    policy: LogProgressCampaignPolicy
) {
    const minimumDate = getCampaignBoundaryDateValue(policy.campaignStartAt)
    const maximumDate = getCampaignBoundaryDateValue(policy.campaignEndAt)

    return activityDate >= minimumDate && activityDate <= maximumDate
}

function isValidDateInputValue(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false
    }

    const parsedDate = new Date(`${value}T00:00:00Z`)

    return !Number.isNaN(parsedDate.getTime())
}

function getTodayDateInputValue(now = new Date()) {
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

function getCampaignBoundaryDateValue(value: string) {
    const parsedValue = toDate(value)

    return `${parsedValue.getUTCFullYear()}-${String(parsedValue.getUTCMonth() + 1).padStart(2, '0')}-${String(parsedValue.getUTCDate()).padStart(2, '0')}`
}

function normalizeOptionalString(value: string) {
    const trimmedValue = value.trim()

    return trimmedValue.length > 0 ? trimmedValue : null
}

function assertNever(value: never): never {
    throw new Error(`Unhandled value: ${String(value)}`)
}

function toDate(value: Date | string) {
    const parsedValue = value instanceof Date ? value : new Date(value)

    if (Number.isNaN(parsedValue.getTime())) {
        throw new Error('A valid date value is required.')
    }

    return parsedValue
}
