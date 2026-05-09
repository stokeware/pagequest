import { describe, expect, it, vi } from 'vitest'

import {
    createCampaignLifecycleJobDefinitions,
    runReminderEmailJob,
    selectCampaignStartReminderCandidates,
    selectInactivityNudgeCandidates,
} from '@/lib/jobs/reminders'

type DeliveryStatus = 'FAILED' | 'PENDING' | 'SENDING' | 'SENT'

type TestCampaignParticipant = {
    campaign: {
        createdAt: Date
        endAt: Date
        id: string
        name: string
        startAt: Date
    }
    id: string
    joinedAt: Date | null
    lastActivityAt: Date | null
    user: {
        email: string
    }
}

type TestNotificationDelivery = {
    campaignId?: string
    campaignParticipantId?: string
    failedAt?: Date | null
    id: string
    idempotencyKey: string
    kind: string
    metadata?: Record<string, unknown>
    providerMessageId?: string | null
    recipientEmail: string
    scheduledFor?: Date
    sentAt: Date | null
    startedAt?: Date | null
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
    create: Omit<TestNotificationDelivery, 'id' | 'sentAt'>
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

describe('selectCampaignStartReminderCandidates', () => {
    it('keeps only campaigns that started within the reminder lookback window', () => {
        const now = new Date('2026-05-09T18:00:00.000Z')

        const candidates = selectCampaignStartReminderCandidates(
            [
                {
                    campaignId: 'campaign-1',
                    campaignName: 'Spring Story Sprint',
                    campaignStartAt: new Date('2026-05-09T08:00:00.000Z'),
                    participantId: 'participant-1',
                    recipientEmail: 'reader@example.com',
                },
                {
                    campaignId: 'campaign-2',
                    campaignName: 'Future Quest',
                    campaignStartAt: new Date('2026-05-09T20:00:00.000Z'),
                    participantId: 'participant-2',
                    recipientEmail: 'future@example.com',
                },
                {
                    campaignId: 'campaign-3',
                    campaignName: 'Old Quest',
                    campaignStartAt: new Date('2026-05-08T10:00:00.000Z'),
                    participantId: 'participant-3',
                    recipientEmail: 'old@example.com',
                },
            ],
            now,
            24
        )

        expect(candidates).toEqual([
            expect.objectContaining({
                campaignId: 'campaign-1',
                participantId: 'participant-1',
            }),
        ])
    })
})

describe('selectInactivityNudgeCandidates', () => {
    it('selects active participants once they cross the inactivity threshold and buckets repeated nudges', () => {
        const now = new Date('2026-05-09T18:00:00.000Z')

        const candidates = selectInactivityNudgeCandidates(
            [
                {
                    campaignCreatedAt: new Date('2026-05-01T12:00:00.000Z'),
                    campaignEndsAt: new Date('2026-05-20T12:00:00.000Z'),
                    campaignId: 'campaign-1',
                    campaignName: 'Spring Story Sprint',
                    joinedAt: new Date('2026-05-01T12:00:00.000Z'),
                    lastActivityAt: new Date('2026-05-02T12:00:00.000Z'),
                    participantId: 'participant-1',
                    recipientEmail: 'reader@example.com',
                },
                {
                    campaignCreatedAt: new Date('2026-05-01T12:00:00.000Z'),
                    campaignEndsAt: new Date('2026-05-20T12:00:00.000Z'),
                    campaignId: 'campaign-2',
                    campaignName: 'Fresh Quest',
                    joinedAt: new Date('2026-05-08T12:00:00.000Z'),
                    lastActivityAt: null,
                    participantId: 'participant-2',
                    recipientEmail: 'fresh@example.com',
                },
                {
                    campaignCreatedAt: new Date('2026-05-01T12:00:00.000Z'),
                    campaignEndsAt: new Date('2026-05-08T12:00:00.000Z'),
                    campaignId: 'campaign-3',
                    campaignName: 'Ended Quest',
                    joinedAt: new Date('2026-05-01T12:00:00.000Z'),
                    lastActivityAt: new Date('2026-05-01T12:00:00.000Z'),
                    participantId: 'participant-3',
                    recipientEmail: 'ended@example.com',
                },
            ],
            now,
            {
                cadenceDays: 3,
                thresholdDays: 3,
            }
        )

        expect(candidates).toEqual([
            expect.objectContaining({
                cadenceWindow: 1,
                campaignId: 'campaign-1',
                daysSinceLastEntry: 7,
                participantId: 'participant-1',
            }),
        ])
    })
})

describe('runReminderEmailJob', () => {
    it('sends due reminders once and skips them on a repeated run with the same idempotency keys', async () => {
        const campaignParticipants: TestCampaignParticipant[] = [
            {
                campaign: {
                    createdAt: new Date('2026-05-01T12:00:00.000Z'),
                    endAt: new Date('2026-05-20T12:00:00.000Z'),
                    id: 'campaign-1',
                    name: 'Spring Story Sprint',
                    startAt: new Date('2026-05-09T08:00:00.000Z'),
                },
                id: 'participant-1',
                joinedAt: new Date('2026-05-01T12:00:00.000Z'),
                lastActivityAt: new Date('2026-05-02T12:00:00.000Z'),
                user: {
                    email: 'reader@example.com',
                },
            },
        ]
        const deliveries = new Map<string, TestNotificationDelivery>()
        let nextId = 1
        const participantStore = {
            campaignParticipant: {
                findMany: vi.fn(async () => campaignParticipants),
            },
        }
        const notificationStore = {
            notificationDelivery: {
                update: vi.fn(async (args: Record<string, unknown>) => {
                    const { data, where } = parseUpdateArgs(args)
                    const delivery = [...deliveries.values()].find(
                        (item) => item.id === where.id
                    )

                    if (!delivery) {
                        throw new Error(`Unknown delivery: ${where.id}`)
                    }

                    Object.assign(delivery, data)

                    return delivery
                }),
                updateMany: vi.fn(async (args: Record<string, unknown>) => {
                    const { data, where } = parseUpdateManyArgs(args)
                    const delivery = [...deliveries.values()].find(
                        (item) => item.id === where.id
                    )

                    if (
                        !delivery ||
                        !where.status.in.includes(delivery.status)
                    ) {
                        return { count: 0 }
                    }

                    Object.assign(delivery, data)

                    return { count: 1 }
                }),
                upsert: vi.fn(async (args: Record<string, unknown>) => {
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
                        id: `delivery-${nextId++}`,
                        sentAt: null,
                    } satisfies TestNotificationDelivery

                    deliveries.set(where.idempotencyKey, created)

                    return {
                        id: created.id,
                        sentAt: created.sentAt,
                        status: created.status,
                    }
                }),
            },
        }
        const sendCampaignStartReminderEmail = vi.fn(async () => ({
            id: 'smtp-start-1',
            mode: 'smtp',
        }))
        const sendInactivityNudgeEmail = vi.fn(async () => ({
            id: 'smtp-nudge-1',
            mode: 'smtp',
        }))
        const synchronizeCampaignStatuses = vi.fn(async () => [
            {
                id: 'campaign-1',
                nextStatus: 'ACTIVE',
                previousStatus: 'SCHEDULED',
            },
        ])
        const now = new Date('2026-05-09T18:00:00.000Z')

        const firstRun = await runReminderEmailJob(
            now,
            {},
            {
                appUrl: 'http://127.0.0.1:3000',
                notificationStore: notificationStore as never,
                participantStore: participantStore as never,
                sendCampaignStartReminderEmail,
                sendInactivityNudgeEmail,
                synchronizeCampaignStatuses,
            }
        )

        const secondRun = await runReminderEmailJob(
            now,
            {},
            {
                appUrl: 'http://127.0.0.1:3000',
                notificationStore: notificationStore as never,
                participantStore: participantStore as never,
                sendCampaignStartReminderEmail,
                sendInactivityNudgeEmail,
                synchronizeCampaignStatuses,
            }
        )

        expect(firstRun.campaignStatusUpdates).toHaveLength(1)
        expect(firstRun.campaignStart.sent).toBe(1)
        expect(firstRun.inactivity.sent).toBe(1)
        expect(secondRun.campaignStart.skipped).toBe(1)
        expect(secondRun.inactivity.skipped).toBe(1)
        expect(sendCampaignStartReminderEmail).toHaveBeenCalledTimes(1)
        expect(sendInactivityNudgeEmail).toHaveBeenCalledTimes(1)
    })
})

describe('createCampaignLifecycleJobDefinitions', () => {
    it('registers the lifecycle and reminder jobs on the shared runner contract', () => {
        expect(
            createCampaignLifecycleJobDefinitions().map(
                (definition) => definition.name
            )
        ).toEqual([
            'campaigns.sync-derived-statuses',
            'notifications.send-reminders',
        ])
    })
})
