import { Prisma, type QuestStatus, type QuestVisibility } from '@prisma/client'

import { deriveQuestStatus } from '@/lib/quest-domain'

export class QuestAdminError extends Error {
    code: string

    constructor(code: string, message: string) {
        super(message)
        this.code = code
        this.name = 'QuestAdminError'
    }
}

export type QuestFormValues = {
    description: string | null
    endAt: Date
    entryDeleteWindowMinutes: number | null
    entryEditWindowMinutes: number | null
    name: string
    pointsPerAudiobookMinute: Prisma.Decimal
    pointsPerBook: Prisma.Decimal
    pointsPerChallengeCompletion: Prisma.Decimal
    pointsPerPage: Prisma.Decimal
    startAt: Date
    timezone: string
    visibility: QuestVisibility
}

type QuestLifecycleValues = {
    archivedAt: Date | null
    publishedAt: Date | null
}

type QuestWritableRecord = QuestLifecycleValues & {
    description: string | null
    endAt: Date
    entryDeleteWindowMinutes: number | null
    entryEditWindowMinutes: number | null
    name: string
    pointsPerAudiobookMinute: Prisma.Decimal | number | string
    pointsPerBook: Prisma.Decimal | number | string
    pointsPerChallengeCompletion: Prisma.Decimal | number | string
    pointsPerPage: Prisma.Decimal | number | string
    startAt: Date
    timezone: string
    visibility: QuestVisibility
}

export type QuestWriteValues = QuestFormValues &
    QuestLifecycleValues & {
        status: QuestStatus
    }

export type QuestScoringPreviewItem = {
    description: string
    points: Prisma.Decimal
    title: string
}

export type ActiveQuestConflict = {
    id: string
    name: string
}

export type QuestLifecycleSnapshot = {
    archivedAt: Date | null
    endAt: Date
    publishedAt: Date | null
    startAt: Date
    status: QuestStatus
}

export type QuestChallengeAssignmentFormValues = {
    challengeId: string
    pointValueOverride: Prisma.Decimal | null
    sortOrder: number
}

export type QuestChallengeWriteValues = QuestChallengeAssignmentFormValues & {
    isActive: boolean
}

const inviteOnlyVisibility = 'INVITE_ONLY' satisfies QuestVisibility

const questStatusLabels: Record<QuestStatus, string> = {
    ACTIVE: 'Active',
    ARCHIVED: 'Archived',
    COMPLETED: 'Completed',
    DRAFT: 'Draft',
    SCHEDULED: 'Scheduled',
}

const questVisibilityLabels: Record<QuestVisibility, string> = {
    INVITE_ONLY: 'Invite only',
}

export function parseQuestFormValues(formData: FormData): QuestFormValues {
    const name = getRequiredString(formData, 'name', 'missing-name')
    const timezone = getRequiredString(formData, 'timezone', 'missing-timezone')
    const startAt = getRequiredDate(formData, 'startAt', 'missing-start-at')
    const endAt = getRequiredDate(formData, 'endAt', 'missing-end-at')

    assertValidQuestWindow(startAt, endAt)

    return {
        description: getOptionalString(formData, 'description'),
        endAt,
        entryDeleteWindowMinutes: getOptionalInteger(
            formData,
            'entryDeleteWindowMinutes',
            'invalid-entry-delete-window'
        ),
        entryEditWindowMinutes: getOptionalInteger(
            formData,
            'entryEditWindowMinutes',
            'invalid-entry-edit-window'
        ),
        name,
        pointsPerAudiobookMinute: getRequiredDecimal(
            formData,
            'pointsPerAudiobookMinute',
            'invalid-points-per-audiobook-minute'
        ),
        pointsPerBook: getRequiredDecimal(
            formData,
            'pointsPerBook',
            'invalid-points-per-book'
        ),
        pointsPerChallengeCompletion: getRequiredDecimal(
            formData,
            'pointsPerChallengeCompletion',
            'invalid-points-per-challenge-completion'
        ),
        pointsPerPage: getRequiredDecimal(
            formData,
            'pointsPerPage',
            'invalid-points-per-page'
        ),
        startAt,
        timezone,
        visibility: getQuestVisibility(formData),
    }
}

export function prepareQuestCreateValues(
    formValues: QuestFormValues,
    now?: Date
): QuestWriteValues {
    return finalizeQuestWriteValues({
        archivedAt: null,
        formValues,
        now,
        publishedAt: null,
    })
}

export function prepareQuestUpdateValues({
    archivedAt,
    formValues,
    now,
    publishedAt,
}: {
    archivedAt: Date | null
    formValues: QuestFormValues
    now?: Date
    publishedAt: Date | null
}): QuestWriteValues {
    return finalizeQuestWriteValues({
        archivedAt,
        formValues,
        now,
        publishedAt,
    })
}

export function prepareQuestPublishValues({
    now,
    quest,
}: {
    now: Date
    quest: Pick<
        QuestWritableRecord,
        'archivedAt' | 'endAt' | 'publishedAt' | 'startAt'
    >
}) {
    if (quest.archivedAt) {
        throw new QuestAdminError(
            'quest-already-archived',
            'Archived quests cannot be published.'
        )
    }

    const publishedAt = quest.publishedAt ?? now

    return {
        archivedAt: null,
        publishedAt,
        status: deriveQuestStatus({
            archivedAt: null,
            endAt: quest.endAt,
            now,
            publishedAt,
            startAt: quest.startAt,
        }),
    } satisfies QuestLifecycleValues & {
        status: QuestStatus
    }
}

export function prepareQuestArchiveValues({
    now,
    quest,
}: {
    now: Date
    quest: Pick<QuestWritableRecord, 'endAt' | 'publishedAt' | 'startAt'> & {
        archivedAt: Date | null
    }
}) {
    const archivedAt = quest.archivedAt ?? now

    return {
        archivedAt,
        publishedAt: quest.publishedAt,
        status: deriveQuestStatus({
            archivedAt,
            endAt: quest.endAt,
            now,
            publishedAt: quest.publishedAt,
            startAt: quest.startAt,
        }),
    } satisfies QuestLifecycleValues & {
        status: QuestStatus
    }
}

export function prepareQuestDuplicateValues(
    quest: Omit<QuestWritableRecord, keyof QuestLifecycleValues>,
    now?: Date
): QuestWriteValues {
    return finalizeQuestWriteValues({
        archivedAt: null,
        formValues: {
            description: quest.description,
            endAt: quest.endAt,
            entryDeleteWindowMinutes: quest.entryDeleteWindowMinutes,
            entryEditWindowMinutes: quest.entryEditWindowMinutes,
            name: buildDuplicateQuestName(quest.name),
            pointsPerAudiobookMinute: toDecimal(quest.pointsPerAudiobookMinute),
            pointsPerBook: toDecimal(quest.pointsPerBook),
            pointsPerChallengeCompletion: toDecimal(
                quest.pointsPerChallengeCompletion
            ),
            pointsPerPage: toDecimal(quest.pointsPerPage),
            startAt: quest.startAt,
            timezone: quest.timezone,
            visibility: quest.visibility,
        },
        now,
        publishedAt: null,
    })
}

export function getQuestStatusLabel(status: QuestStatus) {
    return questStatusLabels[status]
}

export function getQuestVisibilityLabel(visibility: QuestVisibility) {
    return questVisibilityLabels[visibility]
}

export function describeQuestLifecycle(snapshot: QuestLifecycleSnapshot) {
    if (snapshot.status === 'ARCHIVED') {
        return snapshot.archivedAt
            ? `Archived on ${snapshot.archivedAt.toISOString()} after the quest window ended on or after ${snapshot.endAt.toISOString()}.`
            : 'Archived quests stay read-only and remain available for historical reporting.'
    }

    if (snapshot.status === 'DRAFT') {
        return 'Draft quests are editable and stay off the competitor surface until they are published.'
    }

    if (snapshot.status === 'SCHEDULED') {
        return `Published quests stay scheduled until the start window opens at ${snapshot.startAt.toISOString()}.`
    }

    if (snapshot.status === 'ACTIVE') {
        return `The quest is live now and remains active until ${snapshot.endAt.toISOString()}.`
    }

    return `The quest window closed on ${snapshot.endAt.toISOString()}, so the lifecycle is now completed unless the quest is archived.`
}

export function buildQuestScoringPreviewItems(
    scoringRules: Pick<
        QuestFormValues,
        | 'pointsPerAudiobookMinute'
        | 'pointsPerBook'
        | 'pointsPerChallengeCompletion'
        | 'pointsPerPage'
    >
): QuestScoringPreviewItem[] {
    return [
        {
            description: 'One completed book',
            points: scoringRules.pointsPerBook,
            title: 'Books',
        },
        {
            description: '100 pages logged',
            points: scoringRules.pointsPerPage.mul(100),
            title: 'Pages',
        },
        {
            description: '60 audiobook minutes logged',
            points: scoringRules.pointsPerAudiobookMinute.mul(60),
            title: 'Audiobook minutes',
        },
        {
            description: 'One challenge completion',
            points: scoringRules.pointsPerChallengeCompletion,
            title: 'Challenges',
        },
    ]
}

export function parseQuestChallengeAssignmentFormValues(
    formData: FormData
): QuestChallengeAssignmentFormValues {
    return {
        challengeId: getRequiredString(
            formData,
            'challengeId',
            'missing-challenge'
        ),
        pointValueOverride: getOptionalDecimal(
            formData,
            'pointValueOverride',
            'invalid-challenge-point-override'
        ),
        sortOrder: getRequiredInteger(
            formData,
            'sortOrder',
            'invalid-challenge-sort-order'
        ),
    }
}

export function prepareQuestChallengeAssignmentValues(
    formValues: QuestChallengeAssignmentFormValues
): QuestChallengeWriteValues {
    return {
        ...formValues,
        isActive: true,
    }
}

export function assertQuestChallengeNotAssigned({
    challengeId,
    existingChallengeIds,
}: {
    challengeId: string
    existingChallengeIds: string[]
}) {
    if (existingChallengeIds.includes(challengeId)) {
        throw new QuestAdminError(
            'duplicate-quest-challenge',
            'That challenge is already assigned to this quest.'
        )
    }
}

export function assertSingleActiveQuest({
    activeQuest,
    nextStatus,
    questId,
}: {
    activeQuest: ActiveQuestConflict | null
    nextStatus: QuestStatus
    questId?: string
}) {
    if (nextStatus !== 'ACTIVE' || !activeQuest) {
        return
    }

    if (questId && activeQuest.id === questId) {
        return
    }

    throw new QuestAdminError(
        'active-quest-conflict',
        `Only one quest can be active at a time. Archive or complete ${activeQuest.name} before activating another quest.`
    )
}

function finalizeQuestWriteValues({
    archivedAt,
    formValues,
    now,
    publishedAt,
}: {
    archivedAt: Date | null
    formValues: QuestFormValues
    now?: Date
    publishedAt: Date | null
}): QuestWriteValues {
    return {
        ...formValues,
        archivedAt,
        publishedAt,
        status: deriveQuestStatus({
            archivedAt,
            endAt: formValues.endAt,
            now,
            publishedAt,
            startAt: formValues.startAt,
        }),
    }
}

function buildDuplicateQuestName(name: string) {
    const trimmedName = name.trim()

    return trimmedName.endsWith('Copy')
        ? `${trimmedName} 2`
        : `${trimmedName} Copy`
}

function getQuestVisibility(formData: FormData) {
    const rawValue = getOptionalString(formData, 'visibility')

    if (!rawValue) {
        return inviteOnlyVisibility
    }

    if (rawValue !== inviteOnlyVisibility) {
        throw new QuestAdminError(
            'invalid-visibility',
            'Only invite-only quests are supported right now.'
        )
    }

    return inviteOnlyVisibility
}

function getRequiredString(
    formData: FormData,
    fieldName: string,
    errorCode: string
) {
    const value = getOptionalString(formData, fieldName)

    if (!value) {
        throw new QuestAdminError(errorCode, `${fieldName} is required.`)
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

function getRequiredDate(
    formData: FormData,
    fieldName: string,
    missingErrorCode: string
) {
    const value = getOptionalString(formData, fieldName)

    if (!value) {
        throw new QuestAdminError(missingErrorCode, `${fieldName} is required.`)
    }

    const parsedValue = new Date(value)

    if (Number.isNaN(parsedValue.getTime())) {
        throw new QuestAdminError(
            `invalid-${fieldName}`,
            `${fieldName} must be a valid date.`
        )
    }

    return parsedValue
}

function getRequiredDecimal(
    formData: FormData,
    fieldName: string,
    errorCode: string
) {
    const value = getOptionalString(formData, fieldName)

    if (!value) {
        throw new QuestAdminError(errorCode, `${fieldName} is required.`)
    }

    const decimalValue = toDecimal(value, errorCode)

    if (decimalValue.isNegative()) {
        throw new QuestAdminError(
            errorCode,
            `${fieldName} must be zero or greater.`
        )
    }

    return decimalValue
}

function getOptionalInteger(
    formData: FormData,
    fieldName: string,
    errorCode: string
) {
    const value = getOptionalString(formData, fieldName)

    if (!value) {
        return null
    }

    const parsedValue = Number.parseInt(value, 10)

    if (!Number.isInteger(parsedValue) || parsedValue < 0) {
        throw new QuestAdminError(
            errorCode,
            `${fieldName} must be a whole number greater than or equal to zero.`
        )
    }

    return parsedValue
}

function getRequiredInteger(
    formData: FormData,
    fieldName: string,
    errorCode: string
) {
    const value = getOptionalInteger(formData, fieldName, errorCode)

    if (value === null) {
        throw new QuestAdminError(errorCode, `${fieldName} is required.`)
    }

    return value
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
        throw new QuestAdminError(
            errorCode,
            `${fieldName} must be zero or greater.`
        )
    }

    return decimalValue
}

function assertValidQuestWindow(startAt: Date, endAt: Date) {
    try {
        deriveQuestStatus({
            endAt,
            startAt,
        })
    } catch {
        throw new QuestAdminError(
            'invalid-quest-window',
            'Quest startAt must be on or before endAt.'
        )
    }
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
        throw new QuestAdminError(
            errorCode ?? 'invalid-decimal',
            'A numeric value is required.'
        )
    }
}
