import { describe, expect, it } from 'vitest'

import {
    claimNotificationDelivery,
    completeNotificationDelivery,
    failNotificationDelivery,
} from '@/lib/jobs/notification-deliveries'

type DeliveryStatus = 'FAILED' | 'PENDING' | 'SENDING' | 'SENT'

type TestNotificationDelivery = {
    campaignId?: string
    campaignParticipantId?: string
    failedAt: Date | null
    id: string
    idempotencyKey: string
    kind: string
    metadata?: Record<string, unknown>
    providerMessageId: string | null
    recipientEmail: string
    scheduledFor?: Date
    sentAt: Date | null
    startedAt: Date | null
    status: DeliveryStatus
}

type UpdateArgs = {
    data: Partial<TestNotificationDelivery>
    where: {
        id: string
    }
}

type UpdateManyArgs = {
    data: Partial<TestNotificationDelivery>
    where: {
        id: string
        status: {
            in: DeliveryStatus[]
        }
    }
}

type UpsertArgs = {
    create: Omit<
        TestNotificationDelivery,
        'failedAt' | 'id' | 'providerMessageId' | 'sentAt' | 'startedAt'
    >
    update: Partial<TestNotificationDelivery>
    where: {
        idempotencyKey: string
    }
}

function parseUpdateArgs(args: Record<string, unknown>): UpdateArgs {
    return args as UpdateArgs
}

function parseUpdateManyArgs(args: Record<string, unknown>): UpdateManyArgs {
    return args as UpdateManyArgs
}

function parseUpsertArgs(args: Record<string, unknown>): UpsertArgs {
    return args as UpsertArgs
}

function createNotificationStore() {
    const deliveries = new Map<string, TestNotificationDelivery>()
    let nextId = 1

    return {
        notificationDelivery: {
            async update(args: Record<string, unknown>) {
                const { data, where } = parseUpdateArgs(args)
                const delivery = [...deliveries.values()].find(
                    (item) => item.id === where.id
                )

                if (!delivery) {
                    throw new Error(`Unknown delivery: ${where.id}`)
                }

                Object.assign(delivery, data)

                return delivery
            },
            async updateMany(args: Record<string, unknown>) {
                const { data, where } = parseUpdateManyArgs(args)
                const delivery = [...deliveries.values()].find(
                    (item) => item.id === where.id
                )

                if (!delivery) {
                    return { count: 0 }
                }

                if (!where.status.in.includes(delivery.status)) {
                    return { count: 0 }
                }

                Object.assign(delivery, data)

                return { count: 1 }
            },
            async upsert(args: Record<string, unknown>) {
                const { create, update, where } = parseUpsertArgs(args)
                const existing = deliveries.get(where.idempotencyKey)

                if (existing) {
                    Object.assign(existing, update)

                    return {
                        id: existing.id,
                        sentAt: existing.sentAt,
                        status: existing.status,
                    }
                }

                const created = {
                    ...create,
                    failedAt: null,
                    id: `delivery-${nextId++}`,
                    providerMessageId: null,
                    sentAt: null,
                    startedAt: null,
                    status: 'PENDING' as const,
                }

                deliveries.set(where.idempotencyKey, created)

                return {
                    id: created.id,
                    sentAt: created.sentAt,
                    status: created.status,
                }
            },
        },
    }
}

describe('notification delivery idempotency', () => {
    it('claims, completes, and then skips an already-sent reminder', async () => {
        const store = createNotificationStore()
        const now = new Date('2026-05-09T14:00:00.000Z')

        const firstClaim = await claimNotificationDelivery(store, {
            campaignId: 'campaign-1',
            campaignParticipantId: 'participant-1',
            idempotencyKey:
                'campaign-start-reminder:campaign-1:participant-1:2026-05-09',
            kind: 'campaign-start-reminder',
            now,
            recipientEmail: 'reader@example.com',
        })

        expect(firstClaim).toEqual({
            deliveryId: 'delivery-1',
            status: 'claimed',
        })

        await completeNotificationDelivery(store, {
            deliveryId: 'delivery-1',
            now,
            providerMessageId: 'smtp-1',
        })

        const secondClaim = await claimNotificationDelivery(store, {
            campaignId: 'campaign-1',
            campaignParticipantId: 'participant-1',
            idempotencyKey:
                'campaign-start-reminder:campaign-1:participant-1:2026-05-09',
            kind: 'campaign-start-reminder',
            now,
            recipientEmail: 'reader@example.com',
        })

        expect(secondClaim).toEqual({
            deliveryId: 'delivery-1',
            status: 'already-sent',
        })
    })

    it('allows a failed delivery to be reclaimed on a later run', async () => {
        const store = createNotificationStore()
        const now = new Date('2026-05-09T14:00:00.000Z')

        const firstClaim = await claimNotificationDelivery(store, {
            campaignId: 'campaign-1',
            campaignParticipantId: 'participant-1',
            idempotencyKey:
                'inactivity-nudge:campaign-1:participant-1:2026-05-01:0',
            kind: 'inactivity-nudge',
            now,
            recipientEmail: 'reader@example.com',
        })

        await failNotificationDelivery(store, {
            deliveryId: firstClaim.deliveryId!,
            now,
        })

        const secondClaim = await claimNotificationDelivery(store, {
            campaignId: 'campaign-1',
            campaignParticipantId: 'participant-1',
            idempotencyKey:
                'inactivity-nudge:campaign-1:participant-1:2026-05-01:0',
            kind: 'inactivity-nudge',
            now: new Date('2026-05-10T14:00:00.000Z'),
            recipientEmail: 'reader@example.com',
        })

        expect(secondClaim).toEqual({
            deliveryId: firstClaim.deliveryId,
            status: 'claimed',
        })
    })
})
