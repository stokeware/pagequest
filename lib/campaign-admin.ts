import {
    Prisma,
    type CampaignStatus,
    type CampaignVisibility,
} from '@prisma/client'

import { deriveCampaignStatus } from '@/lib/campaign-domain'

export class CampaignAdminError extends Error {
    code: string

    constructor(code: string, message: string) {
        super(message)
        this.code = code
        this.name = 'CampaignAdminError'
    }
}

export type CampaignFormValues = {
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
    visibility: CampaignVisibility
}

type CampaignLifecycleValues = {
    archivedAt: Date | null
    publishedAt: Date | null
}

type CampaignWritableRecord = CampaignLifecycleValues & {
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
    visibility: CampaignVisibility
}

export type CampaignWriteValues = CampaignFormValues &
    CampaignLifecycleValues & {
        status: CampaignStatus
    }

export type CampaignScoringPreviewItem = {
    description: string
    points: Prisma.Decimal
    title: string
}

export type ActiveCampaignConflict = {
    id: string
    name: string
}

export type CampaignLifecycleSnapshot = {
    archivedAt: Date | null
    endAt: Date
    publishedAt: Date | null
    startAt: Date
    status: CampaignStatus
}

export type CampaignChallengeAssignmentFormValues = {
    challengeId: string
    pointValueOverride: Prisma.Decimal | null
    sortOrder: number
}

export type CampaignChallengeWriteValues =
    CampaignChallengeAssignmentFormValues & {
        isActive: boolean
    }

const inviteOnlyVisibility = 'INVITE_ONLY' satisfies CampaignVisibility

const campaignStatusLabels: Record<CampaignStatus, string> = {
    ACTIVE: 'Active',
    ARCHIVED: 'Archived',
    COMPLETED: 'Completed',
    DRAFT: 'Draft',
    SCHEDULED: 'Scheduled',
}

const campaignVisibilityLabels: Record<CampaignVisibility, string> = {
    INVITE_ONLY: 'Invite only',
}

export function parseCampaignFormValues(
    formData: FormData
): CampaignFormValues {
    const name = getRequiredString(formData, 'name', 'missing-name')
    const timezone = getRequiredString(formData, 'timezone', 'missing-timezone')
    const startAt = getRequiredDate(formData, 'startAt', 'missing-start-at')
    const endAt = getRequiredDate(formData, 'endAt', 'missing-end-at')

    assertValidCampaignWindow(startAt, endAt)

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
        visibility: getCampaignVisibility(formData),
    }
}

export function prepareCampaignCreateValues(
    formValues: CampaignFormValues,
    now?: Date
): CampaignWriteValues {
    return finalizeCampaignWriteValues({
        archivedAt: null,
        formValues,
        now,
        publishedAt: null,
    })
}

export function prepareCampaignUpdateValues({
    archivedAt,
    formValues,
    now,
    publishedAt,
}: {
    archivedAt: Date | null
    formValues: CampaignFormValues
    now?: Date
    publishedAt: Date | null
}): CampaignWriteValues {
    return finalizeCampaignWriteValues({
        archivedAt,
        formValues,
        now,
        publishedAt,
    })
}

export function prepareCampaignPublishValues({
    now,
    campaign,
}: {
    now: Date
    campaign: Pick<
        CampaignWritableRecord,
        'archivedAt' | 'endAt' | 'publishedAt' | 'startAt'
    >
}) {
    if (campaign.archivedAt) {
        throw new CampaignAdminError(
            'campaign-already-archived',
            'Archived campaigns cannot be published.'
        )
    }

    const publishedAt = campaign.publishedAt ?? now

    return {
        archivedAt: null,
        publishedAt,
        status: deriveCampaignStatus({
            archivedAt: null,
            endAt: campaign.endAt,
            now,
            publishedAt,
            startAt: campaign.startAt,
        }),
    } satisfies CampaignLifecycleValues & {
        status: CampaignStatus
    }
}

export function prepareCampaignArchiveValues({
    now,
    campaign,
}: {
    now: Date
    campaign: Pick<
        CampaignWritableRecord,
        'endAt' | 'publishedAt' | 'startAt'
    > & {
        archivedAt: Date | null
    }
}) {
    const archivedAt = campaign.archivedAt ?? now

    return {
        archivedAt,
        publishedAt: campaign.publishedAt,
        status: deriveCampaignStatus({
            archivedAt,
            endAt: campaign.endAt,
            now,
            publishedAt: campaign.publishedAt,
            startAt: campaign.startAt,
        }),
    } satisfies CampaignLifecycleValues & {
        status: CampaignStatus
    }
}

export function prepareCampaignDuplicateValues(
    campaign: Omit<CampaignWritableRecord, keyof CampaignLifecycleValues>,
    now?: Date
): CampaignWriteValues {
    return finalizeCampaignWriteValues({
        archivedAt: null,
        formValues: {
            description: campaign.description,
            endAt: campaign.endAt,
            entryDeleteWindowMinutes: campaign.entryDeleteWindowMinutes,
            entryEditWindowMinutes: campaign.entryEditWindowMinutes,
            name: buildDuplicateCampaignName(campaign.name),
            pointsPerAudiobookMinute: toDecimal(
                campaign.pointsPerAudiobookMinute
            ),
            pointsPerBook: toDecimal(campaign.pointsPerBook),
            pointsPerChallengeCompletion: toDecimal(
                campaign.pointsPerChallengeCompletion
            ),
            pointsPerPage: toDecimal(campaign.pointsPerPage),
            startAt: campaign.startAt,
            timezone: campaign.timezone,
            visibility: campaign.visibility,
        },
        now,
        publishedAt: null,
    })
}

export function getCampaignStatusLabel(status: CampaignStatus) {
    return campaignStatusLabels[status]
}

export function getCampaignVisibilityLabel(visibility: CampaignVisibility) {
    return campaignVisibilityLabels[visibility]
}

export function describeCampaignLifecycle(snapshot: CampaignLifecycleSnapshot) {
    if (snapshot.status === 'ARCHIVED') {
        return snapshot.archivedAt
            ? `Archived on ${snapshot.archivedAt.toISOString()} after the campaign window ended on or after ${snapshot.endAt.toISOString()}.`
            : 'Archived campaigns stay read-only and remain available for historical reporting.'
    }

    if (snapshot.status === 'DRAFT') {
        return 'Draft campaigns are editable and stay off the competitor surface until they are published.'
    }

    if (snapshot.status === 'SCHEDULED') {
        return `Published campaigns stay scheduled until the start window opens at ${snapshot.startAt.toISOString()}.`
    }

    if (snapshot.status === 'ACTIVE') {
        return `The campaign is live now and remains active until ${snapshot.endAt.toISOString()}.`
    }

    return `The campaign window closed on ${snapshot.endAt.toISOString()}, so the lifecycle is now completed unless the campaign is archived.`
}

export function buildCampaignScoringPreviewItems(
    scoringRules: Pick<
        CampaignFormValues,
        | 'pointsPerAudiobookMinute'
        | 'pointsPerBook'
        | 'pointsPerChallengeCompletion'
        | 'pointsPerPage'
    >
): CampaignScoringPreviewItem[] {
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

export function parseCampaignChallengeAssignmentFormValues(
    formData: FormData
): CampaignChallengeAssignmentFormValues {
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

export function prepareCampaignChallengeAssignmentValues(
    formValues: CampaignChallengeAssignmentFormValues
): CampaignChallengeWriteValues {
    return {
        ...formValues,
        isActive: true,
    }
}

export function assertCampaignChallengeNotAssigned({
    challengeId,
    existingChallengeIds,
}: {
    challengeId: string
    existingChallengeIds: string[]
}) {
    if (existingChallengeIds.includes(challengeId)) {
        throw new CampaignAdminError(
            'duplicate-campaign-challenge',
            'That challenge is already assigned to this campaign.'
        )
    }
}

export function assertSingleActiveQuest({
    activeQuest,
    nextStatus,
    campaignId,
}: {
    activeQuest: ActiveCampaignConflict | null
    nextStatus: CampaignStatus
    campaignId?: string
}) {
    if (nextStatus !== 'ACTIVE' || !activeQuest) {
        return
    }

    if (campaignId && activeQuest.id === campaignId) {
        return
    }

    throw new CampaignAdminError(
        'active-campaign-conflict',
        `Only one campaign can be active at a time. Archive or complete ${activeQuest.name} before activating another campaign.`
    )
}

function finalizeCampaignWriteValues({
    archivedAt,
    formValues,
    now,
    publishedAt,
}: {
    archivedAt: Date | null
    formValues: CampaignFormValues
    now?: Date
    publishedAt: Date | null
}): CampaignWriteValues {
    return {
        ...formValues,
        archivedAt,
        publishedAt,
        status: deriveCampaignStatus({
            archivedAt,
            endAt: formValues.endAt,
            now,
            publishedAt,
            startAt: formValues.startAt,
        }),
    }
}

function buildDuplicateCampaignName(name: string) {
    const trimmedName = name.trim()

    return trimmedName.endsWith('Copy')
        ? `${trimmedName} 2`
        : `${trimmedName} Copy`
}

function getCampaignVisibility(formData: FormData): CampaignVisibility {
    const rawValue = getOptionalString(formData, 'visibility')

    if (!rawValue) {
        return inviteOnlyVisibility
    }

    if (rawValue !== inviteOnlyVisibility) {
        throw new CampaignAdminError(
            'invalid-visibility',
            'Only invite-only campaigns are supported right now.'
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
        throw new CampaignAdminError(errorCode, `${fieldName} is required.`)
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
        throw new CampaignAdminError(
            missingErrorCode,
            `${fieldName} is required.`
        )
    }

    const parsedValue = new Date(value)

    if (Number.isNaN(parsedValue.getTime())) {
        throw new CampaignAdminError(
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
        throw new CampaignAdminError(errorCode, `${fieldName} is required.`)
    }

    const decimalValue = toDecimal(value, errorCode)

    if (decimalValue.isNegative()) {
        throw new CampaignAdminError(
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
        throw new CampaignAdminError(
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
        throw new CampaignAdminError(errorCode, `${fieldName} is required.`)
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
        throw new CampaignAdminError(
            errorCode,
            `${fieldName} must be zero or greater.`
        )
    }

    return decimalValue
}

function assertValidCampaignWindow(startAt: Date, endAt: Date) {
    try {
        deriveCampaignStatus({
            endAt,
            startAt,
        })
    } catch {
        throw new CampaignAdminError(
            'invalid-campaign-window',
            'Campaign startAt must be on or before endAt.'
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
        throw new CampaignAdminError(
            errorCode ?? 'invalid-decimal',
            'A numeric value is required.'
        )
    }
}
