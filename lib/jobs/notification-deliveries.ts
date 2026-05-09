import type { Prisma, PrismaClient } from '@prisma/client'

export type NotificationDeliveryKind =
    | 'campaign-start-reminder'
    | 'inactivity-nudge'

export type NotificationDeliveryClaimStatus =
    | 'already-processing'
    | 'already-sent'
    | 'claimed'

type NotificationDeliveryStore = Pick<PrismaClient, 'notificationDelivery'>

export type NotificationDeliveryClaim = {
    deliveryId: string | null
    status: NotificationDeliveryClaimStatus
}

export type ClaimNotificationDeliveryInput = {
    campaignId?: string
    campaignParticipantId?: string
    idempotencyKey: string
    kind: NotificationDeliveryKind
    metadata?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput
    now: Date
    recipientEmail: string
    scheduledFor?: Date
}

export type CompleteNotificationDeliveryInput = {
    deliveryId: string
    now: Date
    providerMessageId: string | null
}

export type FailNotificationDeliveryInput = {
    deliveryId: string
    now: Date
}

export function buildCampaignStartReminderIdempotencyKey({
    campaignId,
    campaignParticipantId,
    startAt,
}: {
    campaignId: string
    campaignParticipantId: string
    startAt: Date
}) {
    return [
        'campaign-start-reminder',
        campaignId,
        campaignParticipantId,
        startAt.toISOString(),
    ].join(':')
}

export function buildInactivityNudgeIdempotencyKey({
    campaignId,
    campaignParticipantId,
    cadenceWindow,
    inactivityAnchor,
}: {
    campaignId: string
    campaignParticipantId: string
    cadenceWindow: number
    inactivityAnchor: Date
}) {
    return [
        'inactivity-nudge',
        campaignId,
        campaignParticipantId,
        inactivityAnchor.toISOString(),
        `${cadenceWindow}`,
    ].join(':')
}

export async function claimNotificationDelivery(
    store: NotificationDeliveryStore,
    input: ClaimNotificationDeliveryInput
): Promise<NotificationDeliveryClaim> {
    const delivery = await store.notificationDelivery.upsert({
        create: {
            campaignId: input.campaignId,
            campaignParticipantId: input.campaignParticipantId,
            idempotencyKey: input.idempotencyKey,
            kind: input.kind,
            metadata: input.metadata,
            recipientEmail: input.recipientEmail,
            scheduledFor: input.scheduledFor,
            status: 'PENDING',
        },
        select: {
            id: true,
            sentAt: true,
            status: true,
        },
        update: {
            campaignId: input.campaignId,
            campaignParticipantId: input.campaignParticipantId,
            metadata: input.metadata,
            recipientEmail: input.recipientEmail,
            scheduledFor: input.scheduledFor,
        },
        where: {
            idempotencyKey: input.idempotencyKey,
        },
    })

    if (delivery.status === 'SENT' && delivery.sentAt) {
        return {
            deliveryId: delivery.id,
            status: 'already-sent',
        }
    }

    const claim = await store.notificationDelivery.updateMany({
        data: {
            failedAt: null,
            startedAt: input.now,
            status: 'SENDING',
        },
        where: {
            id: delivery.id,
            status: {
                in: ['FAILED', 'PENDING'],
            },
        },
    })

    if (claim.count === 0) {
        return {
            deliveryId: delivery.id,
            status: 'already-processing',
        }
    }

    return {
        deliveryId: delivery.id,
        status: 'claimed',
    }
}

export async function completeNotificationDelivery(
    store: NotificationDeliveryStore,
    input: CompleteNotificationDeliveryInput
) {
    await store.notificationDelivery.update({
        data: {
            providerMessageId: input.providerMessageId,
            sentAt: input.now,
            status: 'SENT',
        },
        where: {
            id: input.deliveryId,
        },
    })
}

export async function failNotificationDelivery(
    store: NotificationDeliveryStore,
    input: FailNotificationDeliveryInput
) {
    await store.notificationDelivery.update({
        data: {
            failedAt: input.now,
            status: 'FAILED',
        },
        where: {
            id: input.deliveryId,
        },
    })
}
